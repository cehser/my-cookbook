import type { Ref } from "vue";
import type { Recipe } from "@/types/recipe";

export function useStepEditor(recipe: Ref<Recipe | null>) {
  function addStep(section: string) {
    recipe.value?.steps.push({ step: "", section });
  }

  function deleteStep(index: number) {
    recipe.value?.steps.splice(index, 1);
  }

  function updateStepText(index: number, text: string) {
    if (!recipe.value) return;
    recipe.value.steps[index].step = text;
  }

  function updateStepNotes(index: number, notes: string[]) {
    if (!recipe.value) return;
    recipe.value.steps[index].notes = notes;
  }

  function reorderStepInSection(
    sectionIndex: number,
    oldLocalIdx: number,
    newLocalIdx: number,
  ) {
    if (!recipe.value) return;
    const section = recipe.value.sections[sectionIndex].section;
    const arr = recipe.value.steps;
    const flatIndices: number[] = [];
    const items: typeof arr = [];
    arr.forEach((step, i) => {
      if (step.section === section) {
        flatIndices.push(i);
        items.push(step);
      }
    });
    const [moved] = items.splice(oldLocalIdx, 1);
    items.splice(newLocalIdx, 0, moved);
    flatIndices.forEach((flatIdx, i) => {
      arr[flatIdx] = items[i];
    });
  }

  function crossMoveStep(
    originalFlatIdx: number,
    targetLocalIdx: number,
    targetSection: string,
  ) {
    if (!recipe.value) return;
    const arr = recipe.value.steps;
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
    addStep,
    deleteStep,
    updateStepText,
    updateStepNotes,
    reorderStepInSection,
    crossMoveStep,
  };
}
