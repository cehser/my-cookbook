import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const replace = vi.fn();
vi.mock("vue-router", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/auth/session", () => ({
  onCallback: vi.fn(),
  retryLoginFromCallback: vi.fn(),
}));

import { onCallback, retryLoginFromCallback } from "@/auth/session";
import Callback from "@/views/Callback.vue";

describe("Callback.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("leitet nach Erfolg zum gespeicherten Ziel und räumt es auf", async () => {
    sessionStorage.setItem("oidc-return-url", "/recipe/abc");
    vi.mocked(onCallback).mockResolvedValue(true);
    const w = mount(Callback);
    await flushPromises();
    expect(onCallback).toHaveBeenCalledWith("/recipe/abc");
    expect(replace).toHaveBeenCalledWith("/recipe/abc");
    expect(sessionStorage.getItem("oidc-return-url")).toBeNull();
    expect(w.find("[role=alert]").exists()).toBe(false);
  });

  it("nimmt ohne gespeichertes Ziel die Startseite", async () => {
    vi.mocked(onCallback).mockResolvedValue(true);
    mount(Callback);
    await flushPromises();
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("zeigt bei Fehler eine Meldung und leitet nicht weiter", async () => {
    sessionStorage.setItem("oidc-return-url", "/recipe/abc");
    vi.mocked(onCallback).mockResolvedValue(false);
    const w = mount(Callback);
    await flushPromises();
    expect(replace).not.toHaveBeenCalled();
    expect(w.find("[role=alert]").text()).toContain("Anmeldung fehlgeschlagen");
    expect(sessionStorage.getItem("oidc-return-url")).toBe("/recipe/abc");
  });

  it("zeigt bis zum Ergebnis den Spinner", async () => {
    vi.mocked(onCallback).mockReturnValue(new Promise(() => undefined));
    const w = mount(Callback);
    await flushPromises();
    expect(w.find(".spinner-border").exists()).toBe(true);
    expect(w.find("[role=alert]").exists()).toBe(false);
  });

  it("verarbeitet den Code pro Anzeige nur einmal, auch bei Neuzeichnen", async () => {
    vi.mocked(onCallback).mockResolvedValue(false);
    const w = mount(Callback);
    await flushPromises();
    await w.vm.$forceUpdate();
    await flushPromises();
    expect(onCallback).toHaveBeenCalledTimes(1);
  });

  it("startet den Login nach Klick neu", async () => {
    sessionStorage.setItem("oidc-return-url", "/favorites");
    vi.mocked(onCallback).mockResolvedValue(false);
    const w = mount(Callback);
    await flushPromises();
    await w.find("button").trigger("click");
    expect(retryLoginFromCallback).toHaveBeenCalledWith("/favorites");
  });
});
