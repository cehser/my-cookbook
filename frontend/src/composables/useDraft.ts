import { ref, watch, onBeforeUnmount, type Ref, type ComputedRef } from "vue";
import { watchDebounced, useEventListener } from "@vueuse/core";
import type { Recipe } from "@/types/recipe";

interface UseDraftReturn {
  hasDraft: Ref<boolean>;
  restoreDraft: () => void;
  discardDraft: () => void;
}

export function useDraft(
  recipeUuid: Ref<string> | ComputedRef<string>,
  recipe: Ref<Recipe | null>,
  isDirty: Ref<boolean> | ComputedRef<boolean>,
): UseDraftReturn {
  const DRAFT_PREFIX = "draft:";

  const hasDraft = ref(false);

  // Check for existing draft on init
  const key = DRAFT_PREFIX + recipeUuid.value;
  hasDraft.value = localStorage.getItem(key) !== null;

  // Debounced auto-save — only when user actually changed something
  const { stop: stopWatch } = watchDebounced(
    recipe,
    () => {
      if (!recipe.value || !isDirty.value) return;
      const draftKey = DRAFT_PREFIX + recipeUuid.value;
      localStorage.setItem(draftKey, JSON.stringify(recipe.value));
    },
    { deep: true, debounce: 2000 },
  );

  // Flush on unmount or page close — only if dirty
  function flushIfDirty() {
    if (!recipe.value || !isDirty.value) return;
    const draftKey = DRAFT_PREFIX + recipeUuid.value;
    localStorage.setItem(draftKey, JSON.stringify(recipe.value));
  }

  onBeforeUnmount(() => {
    flushIfDirty();
    stopWatch();
  });

  useEventListener(window, "beforeunload", flushIfDirty);

  // Watch UUID changes (navigation to different recipe)
  watch(
    () => recipeUuid.value,
    () => {
      const draftKey = DRAFT_PREFIX + recipeUuid.value;
      hasDraft.value = localStorage.getItem(draftKey) !== null;
    },
  );

  function restoreDraft() {
    const draftKey = DRAFT_PREFIX + recipeUuid.value;
    const stored = localStorage.getItem(draftKey);
    if (stored && recipe.value) {
      try {
        recipe.value = JSON.parse(stored) as Recipe;
      } catch {
        discardDraft();
      }
    }
    hasDraft.value = false;
  }

  function discardDraft() {
    const draftKey = DRAFT_PREFIX + recipeUuid.value;
    localStorage.removeItem(draftKey);
    hasDraft.value = false;
  }

  return { hasDraft, restoreDraft, discardDraft };
}
