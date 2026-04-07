import { ref, watch, onBeforeUnmount, type Ref, type ComputedRef } from "vue";
import { watchDebounced } from "@vueuse/core";
import type { Recipe } from "@/types/recipe";

interface UseDraftReturn {
  hasDraft: Ref<boolean>;
  restoreDraft: () => void;
  discardDraft: () => void;
  clearDraft: () => void;
}

export function useDraft(
  recipeUuid: Ref<string> | ComputedRef<string>,
  recipe: Ref<Recipe | null>,
): UseDraftReturn {
  const DRAFT_PREFIX = "draft:";

  const hasDraft = ref(false);
  let pendingFlush: (() => void) | null = null;

  // Check for existing draft on init
  const key = DRAFT_PREFIX + recipeUuid.value;
  const stored = localStorage.getItem(key);
  hasDraft.value = stored !== null;

  // Debounced auto-save to LocalStorage
  const { stop: stopWatch } = watchDebounced(
    recipe,
    (val) => {
      if (!val) return;
      const draftKey = DRAFT_PREFIX + recipeUuid.value;
      localStorage.setItem(draftKey, JSON.stringify(val));
      hasDraft.value = true;
    },
    { deep: true, debounce: 2000 },
  );

  // Immediate flush function for beforeUnmount
  function flushNow() {
    if (!recipe.value) return;
    const draftKey = DRAFT_PREFIX + recipeUuid.value;
    localStorage.setItem(draftKey, JSON.stringify(recipe.value));
  }

  // Track pending flush via sync watch (fires before debounced)
  const stopSyncWatch = watch(
    recipe,
    () => {
      pendingFlush = flushNow;
    },
    { deep: true },
  );

  onBeforeUnmount(() => {
    // Flush any pending debounced save
    if (pendingFlush) {
      pendingFlush();
      pendingFlush = null;
    }
    stopWatch();
    stopSyncWatch();
  });

  // Watch UUID changes (navigation to different recipe)
  watch(
    () => recipeUuid.value,
    () => {
      const draftKey = DRAFT_PREFIX + recipeUuid.value;
      const existing = localStorage.getItem(draftKey);
      hasDraft.value = existing !== null;
    },
  );

  function restoreDraft() {
    const draftKey = DRAFT_PREFIX + recipeUuid.value;
    const stored = localStorage.getItem(draftKey);
    if (stored && recipe.value) {
      try {
        const parsed = JSON.parse(stored) as Recipe;
        Object.assign(recipe.value, parsed);
      } catch {
        discardDraft();
      }
    }
  }

  function discardDraft() {
    const draftKey = DRAFT_PREFIX + recipeUuid.value;
    localStorage.removeItem(draftKey);
    hasDraft.value = false;
  }

  function clearDraft() {
    discardDraft();
  }

  return {
    hasDraft,
    restoreDraft,
    discardDraft,
    clearDraft,
  };
}
