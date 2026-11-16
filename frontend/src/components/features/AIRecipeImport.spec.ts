import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";

const store = vi.hoisted(() => ({
  settings: { expert_mode: false },
  appendRecipe: vi.fn(),
}));
const push = vi.hoisted(() => vi.fn());

vi.mock("@/store/recipeStore", () => ({ useRecipeStore: () => store }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/api/images", () => ({ imageApi: { upload: vi.fn() } }));
vi.mock("@/api/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/ai")>();
  return {
    ...actual,
    aiApi: { importImages: vi.fn(), importText: vi.fn() },
  };
});

vi.mock("@/js/imageResize", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/js/imageResize")>();
  return { ...actual, resizeImage: vi.fn() };
});

import { imageApi } from "@/api/images";
import { ImageResizeError, resizeImage } from "@/js/imageResize";
import { aiApi } from "@/api/ai";
import { useImportPages } from "@/composables/useImportPages";
import AIRecipeImport from "./AIRecipeImport.vue";

const aiRecipe = { recipe: { recipe_name: "Apfelkuchen" }, model: "m" };
const page = (text: string) => new Blob([text], { type: "image/jpeg" });

function button(w: VueWrapper, label: string) {
  const b = w.findAll("button").find((x) => x.text().includes(label));
  if (!b) throw new Error(`Button „${label}“ fehlt`);
  return b;
}

/** Zwei Seiten aufnehmen, erkennen lassen, importieren. */
async function importTwoPages() {
  const { addPage } = useImportPages();
  const blobs = [page("1"), page("2")];
  blobs.forEach((b) => addPage(b, page("t")));
  vi.mocked(aiApi.importImages).mockResolvedValue(aiRecipe);

  const w = mount(AIRecipeImport);
  await button(w, "Rezept erkennen").trigger("click");
  await flushPromises();
  await button(w, "Rezept importieren").trigger("click");
  await flushPromises();
  return { w, blobs };
}

const created = (id: string) => ({ status: "created", detail: { id } });

// Ablauf im Detail: composables/useRecipeImport.spec.ts. Hier die Verdrahtung.
describe("AIRecipeImport: Rezept importieren", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useImportPages().clearPages();
  });

  it("legt das Rezept an, speichert die Seiten als Vorlage und öffnet die Bearbeitung", async () => {
    store.appendRecipe.mockResolvedValue(created("neu-1"));
    vi.mocked(imageApi.upload).mockResolvedValue({} as never);

    const { w, blobs } = await importTwoPages();

    expect(store.appendRecipe).toHaveBeenCalledOnce();
    expect(vi.mocked(imageApi.upload).mock.calls).toEqual([
      ["neu-1", blobs[0], "source"],
      ["neu-1", blobs[1], "source"],
    ]);
    expect(w.emitted("imported")?.[0]?.[1]).toEqual([]);
    expect(push).toHaveBeenCalledWith("/edit/neu-1/apfelkuchen");
    expect(useImportPages().pages.value).toEqual([]);
    expect(w.text()).not.toContain("Rezept erfolgreich erkannt");
    w.unmount();
  });

  it("abgelehnt: Meldung im Dialog, Ergebnis und Seiten bleiben", async () => {
    store.appendRecipe.mockResolvedValue({
      status: "failed",
      error: new Error("403"),
    });

    const { w } = await importTwoPages();

    expect(w.emitted("imported")).toBeUndefined();
    expect(push).not.toHaveBeenCalled();
    expect(w.find(".alert-danger").text()).toContain("nicht angelegt");
    expect(w.text()).toContain("Rezept importieren");
    expect(useImportPages().pages.value).toHaveLength(2);
    w.unmount();
  });

  it("Text-Import öffnet die Bearbeitung ohne Upload", async () => {
    store.appendRecipe.mockResolvedValue(created("neu-3"));
    vi.mocked(aiApi.importText).mockResolvedValue(aiRecipe);
    // Seiten aus dem Foto-Weg dürfen beim Text-Import nicht hochgeladen werden
    useImportPages().addPage(page("1"), page("t"));

    const w = mount(AIRecipeImport);
    await w.find("textarea").setValue("Apfelkuchen: 3 Äpfel …");
    await button(w, "Rezept extrahieren").trigger("click");
    await flushPromises();
    await button(w, "Rezept importieren").trigger("click");
    await flushPromises();

    expect(imageApi.upload).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/edit/neu-3/apfelkuchen");
    w.unmount();
  });

  it("setzt die Hinweise der Seitenauswahl nach dem Import zurück", async () => {
    store.appendRecipe.mockResolvedValue(created("neu-4"));
    vi.mocked(imageApi.upload).mockResolvedValue({} as never);
    vi.mocked(aiApi.importImages).mockResolvedValue(aiRecipe);
    vi.mocked(resizeImage)
      .mockResolvedValueOnce({ blob: page("1"), thumbnail: page("t") })
      .mockRejectedValueOnce(new ImageResizeError("HEIC nicht lesbar"));

    const w = mount(AIRecipeImport);
    const input = w.find('input[type="file"]');
    Object.defineProperty(input.element, "files", {
      value: [new File(["a"], "a.jpg"), new File(["b"], "b.heic")],
      configurable: true,
    });
    await input.trigger("change");
    await flushPromises();
    expect(w.find(".alert-warning").text()).toContain("HEIC nicht lesbar");

    // Analyse und Import (der Hinweis bleibt bis dahin stehen)
    await button(w, "Rezept erkennen").trigger("click");
    await flushPromises();
    await button(w, "Rezept importieren").trigger("click");
    await flushPromises();

    expect(w.find(".alert-warning").exists()).toBe(false);
    w.unmount();
  });
});
