import { ref, watch, onBeforeUnmount, type Ref, type ComputedRef } from "vue";
import { watchDebounced, useEventListener } from "@vueuse/core";
import type { Recipe } from "@/types/recipe";

interface UseDraftReturn {
  hasDraft: Ref<boolean>;
  restoreDraft: () => void;
  discardDraft: () => void;
  clearDraft: () => void;
  pauseDraft: () => void;
  resumeDraft: () => void;
}

export function useDraft(
  recipeUuid: Ref<string> | ComputedRef<string>,
  recipe: Ref<Recipe | null>,
): UseDraftReturn {
  const DRAFT_PREFIX = "draft:";

  const hasDraft = ref(false);
  let pendingFlush: (() => void) | null = null;
  let paused = false;

  // Check for existing draft on init
  const key = DRAFT_PREFIX + recipeUuid.value;
  const stored = localStorage.getItem(key);
  hasDraft.value = stored !== null;

  // Debounced auto-save to LocalStorage
  const { stop: stopWatch } = watchDebounced(
    recipe,
    (val) => {
      if (!val || paused) return;
      const draftKey = DRAFT_PREFIX + recipeUuid.value;
      localStorage.setItem(draftKey, JSON.stringify(val));
      // Don't show banner for drafts written by the current session
    },
    { deep: true, debounce: 2000 },
  );

  // Immediate flush function for beforeUnmount
  function flushNow() {
    if (!recipe.value || paused) return;
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

  // Also flush on page reload/close (Vue lifecycle doesn't fire on F5/close)
  useEventListener(window, "beforeunload", () => {
    if (pendingFlush) {
      pendingFlush();
      pendingFlush = null;
    }
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
    hasDraft.value = false;
  }

  function discardDraft() {
    const draftKey = DRAFT_PREFIX + recipeUuid.value;
    localStorage.removeItem(draftKey);
    hasDraft.value = false;
  }

  function clearDraft() {
    discardDraft();
  }

  function pauseDraft() {
    paused = true;
  }

  function resumeDraft() {
    paused = false;
  }

  return {
    hasDraft,
    restoreDraft,
    discardDraft,
    clearDraft,
    pauseDraft,
    resumeDraft,
  };
}
