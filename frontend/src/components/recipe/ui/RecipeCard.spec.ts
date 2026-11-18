import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import type { Settings } from "@/types/settings";
import type { Recipe } from "@/types/recipe";

const store = vi.hoisted(() => ({
  settings: {} as Settings,
  favorites: [] as string[],
  recipes: [] as Recipe[],
  canDelete: (() => false) as (r: Recipe) => boolean,
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  setRecipe: vi.fn(),
}));

vi.mock("@/store/recipeStore", () => ({ useRecipeStore: () => store }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import RecipeCard from "./RecipeCard.vue";

const recipe = {
  recipe_uuid: "r1",
  recipe_name: "Apfelkuchen",
  ingredients: [],
  steps: [],
  sections: [],
} as unknown as Recipe;

function render(
  settings: Settings,
  { readOnly = settings.read_only, canDelete = false } = {},
) {
  store.settings = settings;
  store.canDelete = () => canDelete;
  return mount(RecipeCard, {
    props: { recipe, picture_src: "", index: 0, read_only: readOnly },
    global: { stubs: { RouterLink: { template: "<a><slot /></a>" } } },
  });
}

const star = (w: ReturnType<typeof render>) => w.find(".favorite-star");
const deleteButton = (w: ReturnType<typeof render>) =>
  w.findAll("button").find((b) => b.text().includes("Löschen"));

async function openMenu(w: ReturnType<typeof render>) {
  await w.find("button[aria-label='Aktionen']").trigger("click");
}

describe("RecipeCard", () => {
  it("Stern für readonly mit „Nur lesen“, ohne Aktionsmenü", () => {
    const w = render({ role: "readonly", read_only: true, expert_mode: false });
    expect(star(w).exists()).toBe(true);
    expect(w.find("button[aria-label='Aktionen']").exists()).toBe(false);
  });

  it("kein Stern für pending", () => {
    const w = render({ role: "pending", read_only: true, expert_mode: false });
    expect(star(w).exists()).toBe(false);
  });

  it("Stern setzt den Favoriten", async () => {
    const w = render({ role: "readonly", read_only: true, expert_mode: false });
    await star(w).trigger("click");
    expect(store.addFavorite).toHaveBeenCalledWith("r1");
  });

  it("Löschen nur mit Recht", async () => {
    const editor: Settings = {
      role: "editor",
      read_only: false,
      expert_mode: false,
    };
    const without = render(editor, { canDelete: false });
    await openMenu(without);
    expect(without.text()).toContain("Bearbeiten");
    expect(deleteButton(without)).toBeUndefined();

    const allowed = render(editor, { canDelete: true });
    await openMenu(allowed);
    expect(deleteButton(allowed)).toBeDefined();
  });
});
