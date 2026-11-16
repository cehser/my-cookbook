/**
 * Ablauf „Rezept importieren“ des AI-Imports: Anlegen → Vorlagen hochladen →
 * Zurücksetzen → Bearbeitung öffnen. Eingabe, Anzeige und Seitenauswahl
 * bleiben in `AIRecipeImport.vue`.
 */

import { ref } from "vue";
import { useRouter } from "vue-router";
import { useRecipeStore } from "@/store/recipeStore";
import { useImportPages } from "@/composables/useImportPages";
import { imageApi } from "@/api/images";
import { generateUUID } from "@/js/uuid";
import { editUrl } from "@/js/slug";
import { appendFailedMessage, LOCAL_PENDING_TEXT } from "@/js/appendFeedback";
import type { Recipe } from "@/types/recipe";

export interface RecipeImportOptions {
  /**
   * Nach dem Anlegen (bzw. lokalen Speichern), vor der Navigation: Die
   * Komponente meldet das Ergebnis und setzt ihre Eingaben zurück.
   * `warnings`: Hinweise (nur lokal, Vorlage nicht oder nur teilweise gespeichert).
   */
  onImported: (recipe: Recipe, warnings: string[]) => void;
}

export function useRecipeImport({ onImported }: RecipeImportOptions) {
  const store = useRecipeStore();
  const router = useRouter();
  const { pages, clearPages } = useImportPages();

  const importing = ref(false);
  /** Fortschritt beim Speichern der Vorlage. */
  const uploadProgress = ref({ done: 0, total: 0 });

  /**
   * Lädt die Seiten als Vorlage (kind=source) in Seitenreihenfolge hoch,
   * nacheinander. Einzelne Fehler brechen nicht ab; gibt die Hinweise zurück.
   */
  const uploadSources = async (
    recipeId: string,
    blobs: Blob[],
  ): Promise<string[]> => {
    uploadProgress.value = { done: 0, total: blobs.length };
    const failed: number[] = [];
    for (const [i, blob] of blobs.entries()) {
      try {
        await imageApi.upload(recipeId, blob, "source");
      } catch (err: unknown) {
        console.warn(`Vorlage Seite ${i + 1} nicht gespeichert`, err);
        failed.push(i + 1);
      }
      uploadProgress.value.done++;
    }
    if (failed.length === 0) return [];
    return [
      `Vorlage: Seite ${failed.join(", ")} von ${blobs.length} konnte nicht gespeichert werden.`,
    ];
  };

  /**
   * Legt `recipe` an; beim Foto-Weg (`from === "images"`) werden die Seiten
   * als Vorlage gespeichert. Liefert bei Ablehnung die Fehlermeldung (keine
   * Navigation, Seiten bleiben für einen neuen Versuch), sonst `null`.
   */
  const importRecipe = async (
    recipe: Recipe,
    from: "images" | "text",
  ): Promise<string | null> => {
    if (importing.value) return null;
    recipe.recipe_uuid ||= generateUUID();
    // Blobs vor clearPages() übernehmen; nur der Foto-Weg hat eine Vorlage
    const sourceBlobs = from === "images" ? pages.value.map((p) => p.blob) : [];

    importing.value = true;
    try {
      // imageurl lädt das Backend beim Speichern selbst herunter
      const result = await store.appendRecipe(recipe);
      if (result.status === "failed") return appendFailedMessage(result.error);

      const warnings: string[] = [];
      let id: string;
      if (result.status === "created") {
        id = result.detail.id;
        if (sourceBlobs.length > 0) {
          warnings.push(...(await uploadSources(id, sourceBlobs)));
        }
      } else {
        id = recipe.recipe_uuid;
        warnings.push(
          sourceBlobs.length > 0
            ? `${LOCAL_PENDING_TEXT} Die Vorlage wurde nicht gespeichert.`
            : LOCAL_PENDING_TEXT,
        );
      }

      onImported(recipe, warnings);
      clearPages();
      // Bearbeitung des neuen Rezepts öffnen (Backend-ID bzw. lokale UUID)
      await router.push(editUrl(id, recipe.recipe_name));
      return null;
    } finally {
      importing.value = false;
      uploadProgress.value = { done: 0, total: 0 };
    }
  };

  return { importing, uploadProgress, importRecipe };
}
