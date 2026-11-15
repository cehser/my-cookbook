import { watch, type Ref } from "vue";
import { onKeyStroke, useDebouncedRefHistory } from "@vueuse/core";

interface UseEditHistoryOptions {
  /**
   * Läuft, nachdem der geladene Zustand als Ausgangspunkt gesetzt ist. Hier
   * z. B. einen Entwurf wiederherstellen und danach `reset()` aufrufen, damit
   * auch der Entwurf nicht rückgängig zu machen ist.
   */
  onLoaded?: () => void;
}

/**
 * Undo/Redo für ein bearbeitetes Objekt: ein Schritt je 500 ms Ruhe,
 * höchstens 50 Schritte. Bis `isLoaded` gilt, ist der Verlauf pausiert;
 * der geladene Zustand ist nicht rückgängig zu machen. Tastenkürzel
 * Strg/Cmd+Z, Strg/Cmd+Y und Strg/Cmd+Umschalt+Z.
 */
export function useEditHistory<T>(
  source: Ref<T>,
  isLoaded: Ref<boolean>,
  options: UseEditHistoryOptions = {},
) {
  const { undo, redo, canUndo, canRedo, pause, resume, clear, commit } =
    useDebouncedRefHistory(source, {
      deep: true,
      debounce: 500,
      capacity: 50,
    });

  /** Aktuellen Zustand als neuen Ausgangspunkt setzen, Verlauf leeren. */
  function reset() {
    commit();
    clear();
  }

  // Reihenfolge entscheidet, ob der Ladezustand rückgängig zu machen ist
  pause();
  watch(
    isLoaded,
    (ready) => {
      if (ready && source.value) {
        reset();
        resume();
        options.onLoaded?.();
      } else {
        pause();
      }
    },
    { immediate: true },
  );

  // Zwei Handler für „z“ absichtlich: ohne Umschalt Undo, mit Umschalt Redo
  onKeyStroke("z", (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && canUndo.value) {
      e.preventDefault();
      undo();
    }
  });
  onKeyStroke("y", (e) => {
    if ((e.ctrlKey || e.metaKey) && canRedo.value) {
      e.preventDefault();
      redo();
    }
  });
  onKeyStroke("z", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && canRedo.value) {
      e.preventDefault();
      redo();
    }
  });

  return { undo, redo, canUndo, canRedo, reset };
}
