import { computed, type Ref } from "vue";
import { useRecipeStore } from "@/store/recipeStore";
import type { Ingredient, Recipe } from "@/types/recipe";

export function useIngredientEditor(recipe: Ref<Recipe | null>) {
  const store = useRecipeStore();

  const ingredient_units = computed(() => {
    const units = new Set(["g", "ml", "Stück"]);
    for (const r of store.recipes) {
      for (const ingredient of r.ingredients || []) {
        for (const amount of ingredient.amounts || []) {
          if (amount.unit) units.add(amount.unit);
        }
      }
    }
    return [...units].sort();
  });

  function addIngredient(section: string) {
    recipe.value?.ingredients.push({
      name: "Neue Zutat",
      amounts: [{ amount: null, unit: "" }],
      section,
    });
  }

  function deleteIngredient(index: number) {
    recipe.value?.ingredients.splice(index, 1);
  }

  function updateIngredient(index: number, ingredient: Ingredient) {
    if (!recipe.value) return;
    recipe.value.ingredients[index] = ingredient;
  }

  function reorderIngredientInSection(
    sectionIndex: number,
    oldLocalIdx: number,
    newLocalIdx: number,
  ) {
    if (!recipe.value) return;
    const section = recipe.value.sections[sectionIndex].section;
    const arr = recipe.value.ingredients;
    const flatIndices: number[] = [];
    const items: Ingredient[] = [];
    arr.forEach((ing, i) => {
      if (ing.section === section) {
        flatIndices.push(i);
        items.push(ing);
      }
    });
    const [moved] = items.splice(oldLocalIdx, 1);
    items.splice(newLocalIdx, 0, moved);
    flatIndices.forEach((flatIdx, i) => {
      arr[flatIdx] = items[i];
    });
  }

  function crossMoveIngredient(
    originalFlatIdx: number,
    targetLocalIdx: number,
    targetSection: string,
  ) {
    if (!recipe.value) return;
    const arr = recipe.value.ingredients;
    const [item] = arr.splice(originalFlatIdx, 1);
    item.section = targetSection;
    let insertAt = arr.length;
    let count = 0;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].section === targetSection) {
        if (count === targetLocalIdx) {
          insertAt = i;
          break;
        }
        count++;
      }
    }
    arr.splice(insertAt, 0, item);
  }

  return {
    ingredient_units,
    addIngredient,
    deleteIngredient,
    updateIngredient,
    reorderIngredientInSection,
    crossMoveIngredient,
  };
}
