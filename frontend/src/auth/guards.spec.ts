import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import type { RouteLocationNormalized } from "vue-router";

/** Zustandstabelle, Zeile „Navigation mit Rolle“ (session.ts und api gemockt). */

const s = vi.hoisted(() => ({
  onNavigation: vi.fn(),
  ensureAuth: vi.fn(),
  isAuthenticated: vi.fn(),
  currentUserSub: vi.fn(),
  onRoleUnavailable: vi.fn(),
}));
const apiGet = vi.hoisted(() => vi.fn());

vi.mock("@/auth/session", () => ({ ...s, RENEW_TIMEOUT_SECONDS: 10 }));
vi.mock("@/api/client", () => ({ api: { get: apiGet } }));

type Guards = typeof import("@/auth/guards");
let guards: Guards;

const to = { fullPath: "/edit/1" } as RouteLocationNormalized;
const from = {} as RouteLocationNormalized;

function storeRole(sub: string, role: string) {
  localStorage.setItem("my-cookbook-role", JSON.stringify({ sub, role }));
}

beforeEach(async () => {
  vi.resetAllMocks();
  localStorage.clear();
  s.onNavigation.mockResolvedValue(true);
  s.ensureAuth.mockResolvedValue("valid");
  s.isAuthenticated.mockResolvedValue(true);
  s.currentUserSub.mockResolvedValue("u1");
  apiGet.mockResolvedValue({ oidc_sub: "u1", role: "editor" });
  vi.resetModules();
  guards = await import("@/auth/guards");
});

describe("requireRole", () => {
  it("Navigation abgebrochen (Login) → abbrechen, keine Rollenabfrage", async () => {
    s.onNavigation.mockResolvedValue(false);
    expect(await guards.requireRole("editor")(to, from)).toBe(false);
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("Rolle aus dem Speicher, auch ohne Sitzung (offline)", async () => {
    storeRole("u1", "editor");
    s.ensureAuth.mockResolvedValue("offline");
    s.isAuthenticated.mockResolvedValue(false);
    expect(await guards.requireRole("editor", "admin")(to, from)).toBe(true);
    await flushPromises();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("gespeicherte Rolle wird online einmal je Seite aufgefrischt", async () => {
    storeRole("u1", "editor");
    apiGet.mockResolvedValue({ oidc_sub: "u1", role: "readonly" });
    expect(await guards.requireRole("editor")(to, from)).toBe(true);
    await flushPromises();
    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(await guards.requireRole("editor")(to, from)).toEqual({
      name: "Gallery",
    });
    await flushPromises();
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it("Rolle eines anderen Nutzers zählt nicht", async () => {
    storeRole("u2", "admin");
    s.ensureAuth.mockResolvedValue("offline");
    expect(await guards.requireRole("admin")(to, from)).toEqual({
      name: "Gallery",
    });
  });

  it("ohne bekannte Rolle: /me, höchstens so lange wie die Erneuerung", async () => {
    expect(await guards.requireRole("editor")(to, from)).toBe(true);
    expect(apiGet).toHaveBeenCalledWith("/me", { timeoutMs: 10_000 });
    expect(JSON.parse(localStorage.getItem("my-cookbook-role")!)).toEqual({
      sub: "u1",
      role: "editor",
    });
  });

  it("offline ohne bekannte Rolle → Startseite mit Hinweis", async () => {
    s.ensureAuth.mockResolvedValue("offline");
    expect(await guards.requireRole("editor")(to, from)).toEqual({
      name: "Gallery",
    });
    expect(s.onRoleUnavailable).toHaveBeenCalledWith("offline");
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("rejected ohne bekannte Rolle → Startseite, Hinweis entscheidet session.ts", async () => {
    s.ensureAuth.mockResolvedValue("rejected");
    expect(await guards.requireRole("editor")(to, from)).toEqual({
      name: "Gallery",
    });
    expect(s.onRoleUnavailable).toHaveBeenCalledWith("rejected");
  });

  it("/me scheitert → Startseite", async () => {
    apiGet.mockRejectedValue(new Error("timeout"));
    expect(await guards.requireRole("editor")(to, from)).toEqual({
      name: "Gallery",
    });
  });

  it("falsche Rolle → Startseite", async () => {
    storeRole("u1", "readonly");
    expect(await guards.requireRole("editor")(to, from)).toEqual({
      name: "Gallery",
    });
  });
});

describe("requireAuth", () => {
  it("setzt nur die Entscheidung von onNavigation um", async () => {
    s.onNavigation.mockResolvedValue(false);
    expect(await guards.requireAuth(to, from)).toBe(false);
    expect(s.onNavigation).toHaveBeenCalledWith(to);
  });
});
