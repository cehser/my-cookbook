import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import type { Recipe } from "@/types/recipe";

const { store, toast } = vi.hoisted(() => ({
  store: {
    recipes: [] as Recipe[],
    canDelete: (() => true) as (r: Recipe) => boolean,
    deleteRecipe: vi.fn(),
    appendRecipe: vi.fn(),
    saveRecipes: vi.fn(),
    saveRecipePictures: vi.fn(),
  },
  toast: vi.fn(),
}));

vi.mock("@/store/recipeStore", () => ({ useRecipeStore: () => store }));
vi.mock("@/composables/useToast", () => ({ useToast: () => ({ toast }) }));

import { ApiError } from "@/api/client";
import AdminRecipes from "./AdminRecipes.vue";

const recipe = (id: string, recipe_name: string) =>
  ({ recipe_uuid: id, recipe_name }) as Recipe;

function render() {
  return mount(AdminRecipes, {
    props: { readOnly: false, expertMode: false },
  });
}

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
