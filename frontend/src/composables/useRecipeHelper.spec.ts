import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

vi.mock("@/store/recipeStore", () => ({
  useRecipeStore: () => ({ recipes: [], loadRecipeDetailFromApi: vi.fn() }),
}));
vi.mock("@/js/offlineCache", () => ({ readRecipeDetail: vi.fn() }));
vi.mock("@/auth/session", () => ({ isAuthenticated: vi.fn() }));
vi.mock("@/api/images", () => ({
  imageApi: {
    thumbnailUrl: (id: string) => `/t/${id}`,
    imageUrl: (id: string) => `/i/${id}`,
  },
}));

import { useRecipeHelper } from "@/composables/useRecipeHelper";
import type { Recipe } from "@/types/recipe";

function recipe(over: Partial<Recipe> = {}): Recipe {
  return {
    recipe_uuid: "r1",
    recipe_name: "Test",
    lastUpdated: "",
    ingredients: [
      { name: "Mehl", amounts: [{ amount: 200, unit: "g" }], section: "" },
      { name: "Milch", amounts: [{ amount: 0.5, unit: "l" }], section: "" },
      { name: "Salz", amounts: [{ amount: null, unit: "Prise" }], section: "" },
      { name: "Ei", amounts: [], section: "" },
    ],
    steps: [],
    sections: [{ section: "" }],
    yields: [{ unit: "Portionen", value: 4 }],
    ...over,
  };
}

async function setup(r: Recipe) {
  const h = useRecipeHelper({ recipeId: ref("") });
  await h.loadRecipe(r);
  return h;
}

function amountOf(h: Awaited<ReturnType<typeof setup>>, index: number) {
  return h.current_recipe.value!.ingredients[index].amounts[0]?.amount;
}

describe("useRecipeHelper: Skalierung", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skaliert Mengen linear mit der Portionszahl", async () => {
    const h = await setup(recipe());
    h.setYieldsValue(8);
    expect(amountOf(h, 0)).toBe(400);
    expect(amountOf(h, 1)).toBe(1);
    expect(h.yields_value.value).toBe(8);
  });

  it("skaliert herunter und liefert Dezimalbrüche", async () => {
    const h = await setup(recipe());
    h.setYieldsValue(3);
    expect(amountOf(h, 0)).toBe(150);
    h.setYieldsValue(1);
    expect(amountOf(h, 0)).toBeCloseTo(50);
    expect(amountOf(h, 1)).toBeCloseTo(0.125);
  });

  it("lässt Einheiten unverändert (keine Umrechnung)", async () => {
    const h = await setup(recipe());
    h.setYieldsValue(40);
    const ing = h.current_recipe.value!.ingredients;
    expect(ing[0].amounts[0]).toEqual({ amount: 2000, unit: "g" });
    expect(ing[1].amounts[0].unit).toBe("l");
  });

  it("überspringt Zutaten ohne Menge (null, leer)", async () => {
    const h = await setup(recipe());
    h.setYieldsValue(8);
    const ing = h.current_recipe.value!.ingredients;
    expect(ing[2].amounts[0].amount).toBeNull();
    expect(ing[3].amounts).toEqual([]);
  });

  it("skaliert nur die erste Menge einer Zutat", async () => {
    const h = await setup(
      recipe({
        ingredients: [
          {
            name: "Zucker",
            amounts: [
              { amount: 100, unit: "g" },
              { amount: 5, unit: "EL" },
            ],
            section: "",
          },
        ],
      }),
    );
    h.setYieldsValue(8);
    const a = h.current_recipe.value!.ingredients[0].amounts;
    expect(a[0].amount).toBe(200);
    expect(a[1].amount).toBe(5);
  });

  it("nutzt recalc_exp als Exponenten", async () => {
    const h = await setup(recipe({ recalc_exp: 0.5 }));
    h.setYieldsValue(16);
    // 200 * 16^0.5 / 4^0.5 = 400
    expect(amountOf(h, 0)).toBeCloseTo(400);
  });

  it("rechnet nicht, wenn do_recalc aus ist", async () => {
    const h = await setup(recipe());
    h.do_recalc.value = false;
    h.setYieldsValue(8);
    expect(h.yields_value.value).toBe(8);
    expect(amountOf(h, 0)).toBe(200);
  });

  it("ignoriert Portionszahlen <= 0", async () => {
    const h = await setup(recipe());
    h.setYieldsValue(0);
    h.setYieldsValue(-2);
    expect(h.yields_value.value).toBe(4);
    expect(amountOf(h, 0)).toBe(200);
  });

  it("tut ohne yields nichts und liefert Standardwerte", async () => {
    const h = await setup(recipe({ yields: undefined }));
    h.setYieldsValue(8);
    h.setYieldsUnit("Stück");
    expect(h.yields_value.value).toBe(1);
    expect(h.yields_unit.value).toBe("Units");
    expect(amountOf(h, 0)).toBe(200);
  });

  it("setzt die Einheit der Portionen", async () => {
    const h = await setup(recipe());
    h.setYieldsUnit("Stück");
    expect(h.yields_unit.value).toBe("Stück");
  });

  it("verändert das übergebene Rezept nicht (arbeitet auf Kopie)", async () => {
    const r = recipe();
    const h = await setup(r);
    h.setYieldsValue(8);
    expect(r.ingredients[0].amounts[0].amount).toBe(200);
    expect(r.yields![0].value).toBe(4);
  });
});

describe("useRecipeHelper: swapElements", () => {
  it("tauscht zwei Elemente", () => {
    const h = useRecipeHelper({ recipeId: ref("") });
    const a = [1, 2, 3];
    h.swapElements(a, 0, 2);
    expect(a).toEqual([3, 2, 1]);
  });
});
