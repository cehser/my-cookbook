import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const { toast, ApiError } = vi.hoisted(() => ({
  toast: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      public detail: string,
    ) {
      super(`API Error ${status}: ${detail}`);
    }
  },
}));

vi.mock("@/api/admin", () => ({
  adminApi: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    testAiConnection: vi.fn(),
  },
}));
vi.mock("@/api/client", () => ({ ApiError }));
vi.mock("@/composables/useToast", () => ({ useToast: () => ({ toast }) }));

import { adminApi } from "@/api/admin";
import AdminSettings from "./AdminSettings.vue";

const stored = {
  max_share_days: 30,
  ai_model_text: "modell-text",
  ai_model_image: "modell-bild",
  openai_key_configured: true,
};

async function mountSettings(settings: object = stored) {
  vi.mocked(adminApi.getSettings).mockResolvedValue(settings as typeof stored);
  const w = mount(AdminSettings);
  await flushPromises();
  return w;
}

function button(w: Awaited<ReturnType<typeof mountSettings>>, text: string) {
  return w.findAll("button").find((b) => b.text().includes(text))!;
}

describe("AdminSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("speichert die Share-Laufzeit allein (Backend übernimmt nur gesendete Felder)", async () => {
    vi.mocked(adminApi.updateSettings).mockResolvedValue(stored);
    const w = await mountSettings();
    const input = w.find("input[type=number]");
    await input.setValue(14);
    await input.trigger("change");
    await flushPromises();
    // Modelle mitzuschicken löste deren Prüfung bei OpenAI aus
    expect(adminApi.updateSettings).toHaveBeenCalledWith({
      max_share_days: 14,
    });
    expect(toast).toHaveBeenCalledWith("Einstellungen gespeichert", "success");
    w.unmount();
  });

  it("speichert beide Modelle zusammen", async () => {
    vi.mocked(adminApi.updateSettings).mockResolvedValue({
      ...stored,
      ai_model_text: "neu-text",
      ai_model_image: "neu-bild",
    });
    const w = await mountSettings();
    await w.find("#ai-model-text").setValue(" neu-text ");
    await w.find("#ai-model-image").setValue("neu-bild");
    await button(w, "Modelle speichern").trigger("click");
    await flushPromises();
    expect(adminApi.updateSettings).toHaveBeenCalledWith({
      ai_model_text: "neu-text",
      ai_model_image: "neu-bild",
    });
    w.unmount();
  });

  it("setzt die Modelle nach Ablehnung auf den gespeicherten Stand zurück", async () => {
    vi.mocked(adminApi.updateSettings).mockRejectedValue(
      new ApiError(422, JSON.stringify({ detail: "Modell unbekannt" })),
    );
    const w = await mountSettings();
    await w.find("#ai-model-text").setValue("gibt-es-nicht");
    await button(w, "Modelle speichern").trigger("click");
    await flushPromises();
    expect(toast).toHaveBeenCalledWith("Modell unbekannt", "danger");
    expect((w.find("#ai-model-text").element as HTMLInputElement).value).toBe(
      "modell-text",
    );
    w.unmount();
  });

  it("zeigt den Key-Status, nie einen Key", async () => {
    // Selbst wenn die API einen Key mitliefern würde, erscheint er nicht
    const w = await mountSettings({ ...stored, openai_api_key: "sk-geheim" });
    expect(w.text()).toContain("OpenAI-Key konfiguriert:");
    expect(w.find("strong").text()).toBe("ja");
    expect(w.html()).not.toContain("sk-geheim");
    w.unmount();

    const ohne = await mountSettings({
      ...stored,
      openai_key_configured: false,
    });
    expect(ohne.find("strong").text()).toBe("nein");
    expect(
      button(ohne, "Verbindung testen").attributes("disabled"),
    ).toBeDefined();
    ohne.unmount();
  });

  it("zeigt den Fehler des Verbindungstests", async () => {
    vi.mocked(adminApi.testAiConnection).mockRejectedValue(
      new ApiError(503, JSON.stringify({ detail: "OpenAI nicht erreichbar" })),
    );
    const w = await mountSettings();
    await button(w, "Verbindung testen").trigger("click");
    await flushPromises();
    expect(w.find(".alert-danger").text()).toBe("OpenAI nicht erreichbar");
    w.unmount();
  });

  it("zeigt einen Standardtext, wenn der Fehler keine Detailmeldung hat", async () => {
    vi.mocked(adminApi.testAiConnection).mockRejectedValue(
      new Error("Netz weg"),
    );
    const w = await mountSettings();
    await button(w, "Verbindung testen").trigger("click");
    await flushPromises();
    expect(w.find(".alert-danger").text()).toBe(
      "Verbindungstest fehlgeschlagen",
    );
    w.unmount();
  });
});
