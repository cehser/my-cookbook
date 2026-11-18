import { useToast } from "@/composables/useToast";
import { deleteFailedMessage } from "@/js/appendFeedback";
import { useRecipeStore } from "@/store/recipeStore";

/**
 * Rezept löschen und ein Scheitern melden (Toast); das Rezept bleibt dann in
 * der Liste. Ob der Knopf erscheint, entscheidet `store.canDelete`.
 * Nur innerhalb von `BApp` verwenden (`useToast`).
 */
export function useRecipeDelete() {
  const store = useRecipeStore();
  const { toast } = useToast();

  /** `true`, wenn gelöscht; sonst Toast mit Grund. */
  async function deleteRecipe(idOrIndex: string | number): Promise<boolean> {
    const result = await store.deleteRecipe(idOrIndex);
    if (result.status === "failed") {
      toast(deleteFailedMessage(result.error), "danger");
      return false;
    }
    return true;
  }

  return { deleteRecipe };
}
