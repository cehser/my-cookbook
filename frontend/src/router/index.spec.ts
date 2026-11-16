import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Router } from "vue-router";

/**
 * Chunk-Fehler-Handler (`vite:preloadError`, Textabgleich, Schleifenschutz).
 * Gescheiterte Lazy-Imports werden durch einen Guard simuliert, der das
 * Vite-Ereignis feuert und wirft: Beides landet wie im Build in
 * `router.onError` mit dem Ziel der Navigation.
 */

const reloadOnce = vi.hoisted(() => vi.fn());
vi.mock("@/js/reload", () => ({ reloadOnce }));
vi.mock("@/views/HomeView.vue", () => ({ default: { template: "<div />" } }));
vi.mock("@/auth/guards", () => ({
  requireAuth: () => true,
  requireRole: () => () => true,
}));
vi.mock("@/auth/session", () => ({ setLoginTargetResolver: vi.fn() }));

let router: Router;
let failWith: { error: Error; preloadEvent: boolean } | null;

const CHROME_CHUNK_ERROR =
  "Failed to fetch dynamically imported module: /assets/Favorites-abc.js";

function firePreloadError() {
  window.dispatchEvent(new Event("vite:preloadError"));
}

async function navigate(path: string) {
  await router.push(path).catch(() => undefined);
}

beforeEach(async () => {
  vi.resetAllMocks();
  sessionStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
  failWith = null;
  vi.resetModules();
  router = (await import("@/router")).default;
  router.beforeEach(() => {
    if (!failWith) return;
    if (failWith.preloadEvent) firePreloadError();
    throw failWith.error;
  });
  await navigate("/");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Chunk-Fehler-Handler", () => {
  it("vite:preloadError während der Navigation → Neuladen auf das Ziel", async () => {
    failWith = { error: new Error("irgendwas"), preloadEvent: true };
    await navigate("/favorites");
    expect(reloadOnce).toHaveBeenCalledWith("/favorites");
  });

  it("Textabgleich als Rückfall ohne Ereignis", async () => {
    failWith = {
      error: new TypeError(CHROME_CHUNK_ERROR),
      preloadEvent: false,
    };
    await navigate("/search?q=x");
    expect(reloadOnce).toHaveBeenCalledWith("/search?q=x");
  });

  it("vite:preloadError außerhalb einer Navigation zählt nicht", async () => {
    firePreloadError(); // z. B. Lazy-Komponente in einem Dialog
    failWith = { error: new Error("anderer Fehler"), preloadEvent: false };
    await navigate("/favorites");
    expect(reloadOnce).not.toHaveBeenCalled();
  });

  it("anderer Navigationsfehler → kein Neuladen", async () => {
    failWith = { error: new Error("Guard kaputt"), preloadEvent: false };
    await navigate("/favorites");
    expect(reloadOnce).not.toHaveBeenCalled();
  });

  it("Schleifenschutz: höchstens ein Neuladen je 10 s", async () => {
    failWith = { error: new Error("x"), preloadEvent: true };
    await navigate("/favorites");
    vi.setSystemTime(new Date("2026-11-15T12:00:09Z"));
    await navigate("/search");
    expect(reloadOnce).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date("2026-11-15T12:00:11Z"));
    await navigate("/settings");
    expect(reloadOnce).toHaveBeenCalledTimes(2);
    expect(reloadOnce).toHaveBeenLastCalledWith("/settings");
  });

  it("Schleifenschutz gilt über ein Neuladen hinweg (sessionStorage)", async () => {
    failWith = { error: new Error("x"), preloadEvent: true };
    await navigate("/favorites");
    expect(sessionStorage.getItem("my-cookbook-chunk-reload")).not.toBeNull();
    const before = reloadOnce.mock.calls.length;
    vi.resetModules();
    router = (await import("@/router")).default;
    router.beforeEach(() => {
      firePreloadError();
      throw new Error("x");
    });
    await navigate("/search");
    expect(reloadOnce.mock.calls.length).toBe(before);
  });
});
