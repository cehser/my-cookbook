import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const replace = vi.fn();
vi.mock("vue-router", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/auth/oidc", () => ({
  handleCallback: vi.fn(),
  requestLogin: vi.fn(),
  resetLoginAttempts: vi.fn(),
}));

import { handleCallback, requestLogin, resetLoginAttempts } from "@/auth/oidc";
import Callback from "@/views/Callback.vue";

describe("Callback.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("leitet nach Erfolg zum gespeicherten Ziel und räumt es auf", async () => {
    sessionStorage.setItem("oidc-return-url", "/recipe/abc");
    vi.mocked(handleCallback).mockResolvedValue(true);
    const w = mount(Callback);
    await flushPromises();
    expect(handleCallback).toHaveBeenCalledWith("/recipe/abc");
    expect(replace).toHaveBeenCalledWith("/recipe/abc");
    expect(sessionStorage.getItem("oidc-return-url")).toBeNull();
    expect(w.find("[role=alert]").exists()).toBe(false);
  });

  it("nimmt ohne gespeichertes Ziel die Startseite", async () => {
    vi.mocked(handleCallback).mockResolvedValue(true);
    mount(Callback);
    await flushPromises();
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("zeigt bei Fehler eine Meldung und leitet nicht weiter", async () => {
    sessionStorage.setItem("oidc-return-url", "/recipe/abc");
    vi.mocked(handleCallback).mockResolvedValue(false);
    const w = mount(Callback);
    await flushPromises();
    expect(replace).not.toHaveBeenCalled();
    expect(w.find("[role=alert]").text()).toContain("Anmeldung fehlgeschlagen");
    expect(sessionStorage.getItem("oidc-return-url")).toBe("/recipe/abc");
  });

  it("zeigt bis zum Ergebnis den Spinner", async () => {
    vi.mocked(handleCallback).mockReturnValue(new Promise(() => undefined));
    const w = mount(Callback);
    await flushPromises();
    expect(w.find(".spinner-border").exists()).toBe(true);
    expect(w.find("[role=alert]").exists()).toBe(false);
  });

  it("verarbeitet den Code pro Anzeige nur einmal, auch bei Neuzeichnen", async () => {
    vi.mocked(handleCallback).mockResolvedValue(false);
    const w = mount(Callback);
    await flushPromises();
    await w.vm.$forceUpdate();
    await flushPromises();
    expect(handleCallback).toHaveBeenCalledTimes(1);
  });

  it("startet den Login nach Klick neu und setzt die Versuche zurück", async () => {
    sessionStorage.setItem("oidc-return-url", "/favorites");
    vi.mocked(handleCallback).mockResolvedValue(false);
    const w = mount(Callback);
    await flushPromises();
    await w.find("button").trigger("click");
    expect(resetLoginAttempts).toHaveBeenCalledTimes(1);
    expect(requestLogin).toHaveBeenCalledWith("/favorites");
  });
});
