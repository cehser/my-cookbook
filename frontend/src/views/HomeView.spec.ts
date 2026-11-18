import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import { canEdit } from "@/auth/role";
import type { Recipe } from "@/types/recipe";
import type { Settings } from "@/types/settings";

const store = vi.hoisted(() => ({
  settings: {} as Settings,
  canEdit: false,
  recipes: [] as Recipe[],
  favorites: [] as string[],
  appendRecipe: vi.fn(),
}));

vi.mock("@/store/recipeStore", () => ({ useRecipeStore: () => store }));
vi.mock("@/store/uiStore", () => ({
  useUIStore: () => ({
    restoreUIState: vi.fn(),
    gallerySortBy: "name-asc",
    galleryScrollPosition: 0,
    setGalleryScrollPosition: vi.fn(),
    setGallerySortBy: vi.fn(),
  }),
}));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/composables/useToast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("@/composables/useRecipeHelper", () => ({
  useRecipeHelper: () => ({ recipeThumbnailSrc: () => "" }),
}));
vi.mock("@/composables/useRecentRecipes", () => ({
  useRecentRecipes: () => ({ recentUuids: ref([]) }),
}));
vi.mock("@/composables/useDraftIndex", () => ({
  useDraftIndex: () => ({ hasDraft: () => false, refresh: vi.fn() }),
}));
vi.mock("@/composables/useRecipeDelete", () => ({
  useRecipeDelete: () => ({ deleteRecipe: vi.fn() }),
}));

import HomeView from "./HomeView.vue";

function render(role: string) {
  store.settings = { role };
  store.canEdit = canEdit(role);
  return mount(HomeView, {
    global: {
      stubs: {
        RecipeGrid: true,
        RecipeCard: true,
        AIRecipeImport: true,
        BModal: true,
      },
    },
  });
}

describe("HomeView: FAB nach Rolle", () => {
  it.each([
    ["editor", true],
    ["admin", true],
    ["readonly", false],
  ])("%s → FAB %s", (role, visible) => {
    const w = render(role);
    expect(w.find(".fab-container").exists()).toBe(visible);
    w.unmount();
  });

  it("FAB ohne YAML-Import", async () => {
    const w = render("admin");
    await w.find(".fab-button").trigger("click");
    const items = w.findAll(".fab-menu-item").map((b) => b.text());
    expect(items).toEqual(["Neues Rezept", "AI-Import", "Beispiel"]);
    w.unmount();
  });
});
