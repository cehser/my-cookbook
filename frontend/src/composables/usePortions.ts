import { computed, ref, watch, type Ref } from "vue";
import type { Recipe } from "@/types/recipe";

export const PORTIONS_MIN = 1;
export const PORTIONS_MAX = 100;

/**
 * Gewählte Portionen eines Rezepts, nur für die Anzeige.
 *
 * Das Rezept bleibt unverändert (früher wurden `yields` und Mengen direkt
 * geändert, in der Editor-Vorschau also der Entwurf). Ohne Portionsangabe
 * gilt 1 Portion als Basis (R-10).
 */
export function usePortions(recipe: Ref<Recipe>) {
  const hasYields = computed(() => {
    const v = recipe.value.yields?.[0]?.value;
    return typeof v === "number" && v > 0;
  });
  const base = computed(() =>
    hasYields.value ? (recipe.value.yields![0].value as number) : 1,
  );

  const portions = ref(base.value);
  watch([() => recipe.value.recipe_uuid, base], () => {
    portions.value = base.value;
  });

  const unit = computed(() => {
    const u = hasYields.value ? recipe.value.yields![0].unit?.trim() : "";
    if (u) return u;
    return portions.value === 1 ? "Portion" : "Portionen";
  });

  const factor = computed(() => {
    const exp = recipe.value.recalc_exp || 1;
    return Math.pow(portions.value / base.value, exp);
  });

  function setPortions(value: number) {
    if (!Number.isFinite(value)) return;
    if (value < PORTIONS_MIN || value > PORTIONS_MAX) return;
    portions.value = value;
  }

  function scale(amount: number | null | undefined) {
    return typeof amount === "number" ? amount * factor.value : amount;
  }

  return { portions, unit, factor, hasYields, setPortions, scale };
}
