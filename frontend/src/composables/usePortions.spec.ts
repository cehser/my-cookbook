import { describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";
import type { Recipe } from "@/types/recipe";
import { PORTIONS_MAX, PORTIONS_MIN, usePortions } from "./usePortions";

function recipe(extra: Partial<Recipe> = {}): Recipe {
  return {
    recipe_uuid: "r1",
    recipe_name: "Test",
    ingredients: [
      { name: "Mehl", amounts: [{ amount: 300, unit: "g" }], section: "" },
    ],
    steps: [],
    sections: [{ section: "" }],
    lastUpdated: "",
    ...extra,
  };
}

describe("usePortions", () => {
  it("startet mit der Portionsangabe des Rezepts", () => {
    const p = usePortions(
      ref(recipe({ yields: [{ value: 6, unit: "Portionen" }] })),
    );
    expect(p.portions.value).toBe(6);
    expect(p.unit.value).toBe("Portionen");
    expect(p.hasYields.value).toBe(true);
    expect(p.factor.value).toBe(1);
  });

  it("skaliert die Mengen, ohne das Rezept zu ändern", () => {
    const r = ref(recipe({ yields: [{ value: 6, unit: "Portionen" }] }));
    const p = usePortions(r);
    p.setPortions(3);
    expect(p.scale(300)).toBe(150);
    expect(p.scale(null)).toBeNull();
    expect(r.value.yields![0].value).toBe(6);
    expect(r.value.ingredients[0].amounts[0].amount).toBe(300);
  });

  it("berücksichtigt recalc_exp", () => {
    const p = usePortions(
      ref(recipe({ yields: [{ value: 1, unit: "Stück" }], recalc_exp: 2 })),
    );
    p.setPortions(2);
    expect(p.factor.value).toBe(4);
  });

  it("nimmt ohne Portionsangabe 1 Portion als Basis (R-10)", () => {
    const p = usePortions(ref(recipe()));
    expect(p.hasYields.value).toBe(false);
    expect(p.portions.value).toBe(1);
    expect(p.unit.value).toBe("Portion");
    p.setPortions(2);
    expect(p.unit.value).toBe("Portionen");
    expect(p.scale(300)).toBe(600);
  });

  it("behandelt 0 oder fehlende Einheit wie fehlende Angabe", () => {
    const p = usePortions(ref(recipe({ yields: [{ value: 0, unit: "" }] })));
    expect(p.hasYields.value).toBe(false);
    expect(p.portions.value).toBe(1);
    const q = usePortions(ref(recipe({ yields: [{ value: 4, unit: " " }] })));
    expect(q.unit.value).toBe("Portionen");
  });

  it("ignoriert Werte außerhalb der Grenzen", () => {
    const p = usePortions(
      ref(recipe({ yields: [{ value: 4, unit: "Portionen" }] })),
    );
    p.setPortions(PORTIONS_MIN - 1);
    p.setPortions(PORTIONS_MAX + 1);
    p.setPortions(Number.NaN);
    expect(p.portions.value).toBe(4);
    p.setPortions(PORTIONS_MAX);
    expect(p.portions.value).toBe(PORTIONS_MAX);
    p.setPortions(PORTIONS_MIN);
    expect(p.portions.value).toBe(PORTIONS_MIN);
  });

  it("setzt bei einem anderen Rezept auf dessen Angabe zurück", async () => {
    const r = ref(recipe({ yields: [{ value: 4, unit: "Portionen" }] }));
    const p = usePortions(r);
    p.setPortions(8);
    r.value = recipe({
      recipe_uuid: "r2",
      yields: [{ value: 2, unit: "Portionen" }],
    });
    await nextTick();
    expect(p.portions.value).toBe(2);
  });
});
