import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import type { Recipe } from "@/types/recipe";
import type { Settings } from "@/types/settings";

const { store, push, toast, current } = vi.hoisted(() => ({
  store: {
    settings: {} as Settings,
    favorites: [] as string[],
    recipes: [] as Recipe[],
    canDelete: (() => false) as (r: Recipe) => boolean,
    deleteRecipe: vi.fn(),
    addFavorite: vi.fn(),
    removeFavorite: vi.fn(),
  },
  push: vi.fn(),
  toast: vi.fn(),
  current: {
    recipe_uuid: "r1",
    recipe_name: "Apfelkuchen",
  } as Recipe,
}));

vi.mock("@/store/recipeStore", () => ({ useRecipeStore: () => store }));
vi.mock("@/store/uiStore", () => ({
  useUIStore: () => ({ restoreUIState: vi.fn() }),
}));
vi.mock("@/composables/useToast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/composables/useRecentRecipes", () => ({
  useRecentRecipes: () => ({ trackRecipe: vi.fn() }),
}));
vi.mock("@/composables/useRecipeHelper", () => ({
  useRecipeHelper: () => ({
    current_recipe: ref(current),
    picture_src: ref(""),
  }),
}));
vi.mock("vue-router", () => ({ useRouter: () => ({ push, back: vi.fn() }) }));

import { ApiError } from "@/api/client";
import RecipeView from "./Recipe.vue";

function render(settings: Settings, canDelete = false) {
  store.settings = settings;
  store.canDelete = () => canDelete;
  return mount(RecipeView, {
    props: { id: "r1" },
    global: {
      stubs: {
        RecipeDisplay: { template: "<div />" },
        ShareManager: true,
        SourceImages: true,
      },
    },
  });
}

const starButton = (w: ReturnType<typeof render>) =>
  w.find("button[title='Zu Favoriten hinzufügen']");
const button = (w: ReturnType<typeof render>, text: string) =>
  w.findAll("button").find((b) => b.text().includes(text));

async function openMenu(w: ReturnType<typeof render>) {
  await w.find("button[title='Menü']").trigger("click");
}

describe("Recipe: Stern und Löschen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", () => true);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("readonly mit „Nur lesen“: Stern ja, Menü nein", async () => {
    const w = render({ role: "readonly", read_only: true, expert_mode: false });
    expect(starButton(w).exists()).toBe(true);
    expect(w.find("button[title='Menü']").exists()).toBe(false);
    await starButton(w).trigger("click");
    expect(store.addFavorite).toHaveBeenCalledWith("r1");
  });

  it("Editor ohne Löschrecht: Menü ohne „Löschen“", async () => {
    const w = render({ role: "editor", read_only: false, expert_mode: false });
    await openMenu(w);
    expect(button(w, "Bearbeiten")).toBeDefined();
    expect(button(w, "Löschen")).toBeUndefined();
  });

  it("Löschen gescheitert: Meldung, bleibt auf der Seite", async () => {
    store.deleteRecipe.mockResolvedValue({
      status: "failed",
      error: new ApiError(403, ""),
    });
    const w = render(
      { role: "editor", read_only: false, expert_mode: false },
      true,
    );
    await openMenu(w);
    await button(w, "Löschen")!.trigger("click");
    await flushPromises();

    expect(store.deleteRecipe).toHaveBeenCalledWith("r1");
    expect(toast).toHaveBeenCalledWith(
      "Rezept nicht gelöscht: keine Berechtigung.",
      "danger",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("Löschen erfolgreich: zurück zur Übersicht", async () => {
    store.deleteRecipe.mockResolvedValue({ status: "deleted" });
    const w = render(
      { role: "admin", read_only: false, expert_mode: false },
      true,
    );
    await openMenu(w);
    await button(w, "Löschen")!.trigger("click");
    await flushPromises();

    expect(push).toHaveBeenCalledWith("/");
    expect(toast).not.toHaveBeenCalled();
  });
});
