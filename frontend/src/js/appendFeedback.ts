/**
 * Meldungen und Ziel-ID nach `recipeStore.appendRecipe` für alle Aufrufer.
 */

import { ApiError } from "@/api/client";
import type { AppendResult } from "@/store/recipeStore";
import type { Recipe } from "@/types/recipe";

/** Kein späteres Hochladen versprechen: Lokale Rezepte werden nie übertragen. */
export const LOCAL_ONLY_TEXT =
  "Nur auf diesem Gerät gespeichert, nicht auf dem Server.";

/** Fehlermeldung, wenn das Backend das Anlegen abgelehnt hat (4xx). */
export function appendFailedMessage(error: unknown): string {
  let reason = "unbekannter Fehler";
  if (error instanceof ApiError) {
    if (error.status === 403) reason = "keine Berechtigung";
    else if (error.status === 422) reason = "Rezeptdaten ungültig";
    else reason = `Fehler ${error.status}`;
  }
  return `Rezept nicht angelegt: ${reason}.`;
}

/** Toast zum Ergebnis: Erfolg, Hinweis „nur auf diesem Gerät“ oder Fehler. */
export function appendToast(
  result: AppendResult,
  successText: string,
): { message: string; variant: "success" | "warning" | "danger" } {
  switch (result.status) {
    case "created":
      return { message: successText, variant: "success" };
    case "local":
      return {
        message: `${successText} ${LOCAL_ONLY_TEXT}`,
        variant: "warning",
      };
    case "failed":
      return { message: appendFailedMessage(result.error), variant: "danger" };
  }
}

/**
 * ID für Navigation und Upload: bei `created` die Backend-ID, sonst die
 * lokale UUID; bei `failed` `null` (nicht navigieren).
 */
export function appendedId(
  result: AppendResult,
  recipe: Recipe,
): string | null {
  if (result.status === "created") return result.detail.id;
  if (result.status === "local") return recipe.recipe_uuid;
  return null;
}
