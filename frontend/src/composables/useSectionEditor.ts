import type { Ref } from "vue";
import type { Recipe } from "@/types/recipe";

export function useSectionEditor(recipe: Ref<Recipe | null>) {
  function addSection() {
    recipe.value?.sections.push({ section: "" });
  }

  function updateSectionName(sectionIndex: number, name: string) {
    if (!recipe.value) return;
    const oldName = recipe.value.sections[sectionIndex].section;
    recipe.value.sections[sectionIndex].section = name;
    for (const ing of recipe.value.ingredients) {
      if (ing.section === oldName) ing.section = name;
    }
    for (const step of recipe.value.steps) {
      if (step.section === oldName) step.section = name;
    }
  }

  function deleteSection(sectionIndex: number) {
    if (!recipe.value) return;
    const name = recipe.value.sections[sectionIndex].section;
    recipe.value.sections.splice(sectionIndex, 1);
    recipe.value.ingredients = recipe.value.ingredients.filter(
      (i) => i.section !== name,
    );
    recipe.value.steps = recipe.value.steps.filter((s) => s.section !== name);
  }

  function moveSection(sectionIndex: number, direction: "up" | "down") {
    if (!recipe.value) return;
    const arr = recipe.value.sections;
    const target = direction === "up" ? sectionIndex - 1 : sectionIndex + 1;
    if (target < 0 || target >= arr.length) return;
    [arr[sectionIndex], arr[target]] = [arr[target], arr[sectionIndex]];
  }

  return {
    addSection,
    updateSectionName,
    deleteSection,
    moveSection,
  };
}
