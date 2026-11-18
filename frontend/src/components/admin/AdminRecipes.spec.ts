import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import type { Recipe } from "@/types/recipe";

const { store, toast, exportAll, saveBlob } = vi.hoisted(() => ({
  store: {
    recipes: [] as Recipe[],
    canDelete: (() => true) as (r: Recipe) => boolean,
    deleteRecipe: vi.fn(),
    appendRecipe: vi.fn(),
    saveRecipes: vi.fn(),
    saveRecipePictures: vi.fn(),
  },
  toast: vi.fn(),
  exportAll: vi.fn(),
  saveBlob: vi.fn(),
}));

vi.mock("@/store/recipeStore", () => ({ useRecipeStore: () => store }));
vi.mock("@/composables/useToast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/api/admin", () => ({ adminApi: { exportAll } }));
vi.mock("@/js/download", () => ({ saveBlob }));

import { ApiError } from "@/api/client";
import AdminRecipes from "./AdminRecipes.vue";

const recipe = (id: string, recipe_name: string) =>
  ({ recipe_uuid: id, recipe_name }) as Recipe;

function render(isAdmin = false) {
  return mount(AdminRecipes, {
    props: { readOnly: false, expertMode: false, isAdmin },
  });
}

const exportButton = (w: ReturnType<typeof render>) =>
  w.findAll("button").find((b) => b.text().includes("Gesamtexport (ZIP)"));

const deleteButton = (w: ReturnType<typeof render>, name: string) =>
  w.find(`button[aria-label='Rezept „${name}“ löschen']`);

describe("AdminRecipes: Löschen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.recipes = [recipe("r1", "Apfelkuchen"), recipe("r2", "Birnenkuchen")];
    store.canDelete = () => true;
    store.deleteRecipe.mockResolvedValue({ status: "deleted" });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("fragt mit Rezeptname nach, löscht erst nach Bestätigung per ID", async () => {
    const confirm = vi.fn<(message: string) => boolean>(() => false);
    vi.stubGlobal("confirm", confirm);
    const w = render();

    await deleteButton(w, "Birnenkuchen").trigger("click");
    expect(confirm).toHaveBeenCalledWith(
      'Rezept "Birnenkuchen" wirklich löschen?',
    );
    expect(store.deleteRecipe).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await deleteButton(w, "Birnenkuchen").trigger("click");
    expect(store.deleteRecipe).toHaveBeenCalledWith("r2");
  });

  it("meldet ein gescheitertes Löschen", async () => {
    vi.stubGlobal("confirm", () => true);
    store.deleteRecipe.mockResolvedValue({
      status: "failed",
      error: new ApiError(403, ""),
    });
    const w = render();

    await deleteButton(w, "Apfelkuchen").trigger("click");
    await flushPromises();

    expect(toast).toHaveBeenCalledWith(
      "Rezept nicht gelöscht: keine Berechtigung.",
      "danger",
    );
  });

  it("kein × ohne Löschrecht", () => {
    store.canDelete = (r) => r.recipe_uuid === "r1";
    const w = render();
    expect(deleteButton(w, "Apfelkuchen").exists()).toBe(true);
    expect(deleteButton(w, "Birnenkuchen").exists()).toBe(false);
  });
});

describe("AdminRecipes: Gesamtexport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.recipes = [];
  });

  it("nur für Admins sichtbar", () => {
    expect(exportButton(render(false))).toBeUndefined();
    expect(exportButton(render(true))).toBeDefined();
  });

  it("lädt das ZIP und bietet es mit dem Namen vom Server an", async () => {
    const blob = new Blob(["zip"], { type: "application/zip" });
    let resolve!: (v: unknown) => void;
    exportAll.mockReturnValue(new Promise((r) => (resolve = r)));
    const w = render(true);

    await exportButton(w)!.trigger("click");
    expect(exportButton(w)!.attributes("disabled")).toBeDefined();

    resolve({ blob, filename: "my-cookbook-export-2026-11-18.zip" });
    await flushPromises();

    expect(exportAll).toHaveBeenCalledOnce();
    expect(saveBlob).toHaveBeenCalledWith(
      blob,
      "my-cookbook-export-2026-11-18.zip",
    );
    expect(exportButton(w)!.attributes("disabled")).toBeUndefined();
    expect(toast).not.toHaveBeenCalled();
  });

  it("ohne Dateinamen vom Server ein Standardname", async () => {
    const blob = new Blob(["zip"]);
    exportAll.mockResolvedValue({ blob, filename: null });
    const w = render(true);

    await exportButton(w)!.trigger("click");
    await flushPromises();

    expect(saveBlob).toHaveBeenCalledWith(blob, "my-cookbook-export.zip");
  });

  it("meldet einen Fehler und gibt den Knopf wieder frei", async () => {
    exportAll.mockRejectedValue(new ApiError(403, "Forbidden"));
    const w = render(true);

    await exportButton(w)!.trigger("click");
    await flushPromises();

    expect(saveBlob).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      "Gesamtexport fehlgeschlagen: API Error 403: Forbidden",
      "danger",
    );
    expect(exportButton(w)!.attributes("disabled")).toBeUndefined();
  });
});
