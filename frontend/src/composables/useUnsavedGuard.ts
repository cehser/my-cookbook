import { type Ref, type ComputedRef } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { useEventListener } from "@vueuse/core";

export function useUnsavedGuard(
  isDirty: Ref<boolean> | ComputedRef<boolean>,
): void {
  // Guard: route navigation (Vue Router)
  onBeforeRouteLeave(() => {
    if (isDirty.value) {
      const answer = window.confirm(
        "Es gibt ungespeicherte Änderungen. Seite wirklich verlassen?",
      );
      if (!answer) return false;
    }
  });

  // Guard: tab close / browser navigation (beforeunload)
  useEventListener(window, "beforeunload", (e: BeforeUnloadEvent) => {
    if (isDirty.value) {
      e.preventDefault();
    }
  });
}
