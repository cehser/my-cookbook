/**
 * Änderung an einem bestehenden Rezept speichern, ohne die Liste anzufassen.
 *
 * Der Store übernimmt die Änderung erst nach `saved` bzw. `local` in Liste
 * und Cache; bei `failed` bleibt alles beim alten Stand und der Aufrufer
 * meldet den Grund (`saveFailedMessage`).
 */

import { ApiError, OfflineError } from "@/api/client";
import {
  recipeApi,
  type RecipeDetail,
  type RecipeUpdatePayload,
} from "@/api/recipes";
import { ensureAuth, loginFollows, type AuthState } from "@/auth/session";
import { LocalReadError, updatePending } from "@/store/pendingCreates";
import type { Recipe } from "@/types/recipe";

/**
 * Ergebnis von `setRecipe` bzw. `setRecipeTags`:
 * - `saved`: Der Server hat die Änderung (`detail` ist seine Antwort)
 * - `local`: vorgemerktes Rezept, nur in der Vormerkung geändert; wird mit
 *   der Vormerkung übertragen. `stillRejected`: fremdes 409, die Ablehnung
 *   bleibt trotz Bearbeitung
 * - `failed`: nicht gespeichert (`ApiError` 4xx/5xx, `OfflineError` ohne
 *   Verbindung, `ApiTimeoutError`, `TypeError`, 401 bei abgelehnter Sitzung,
 *   `LocalReadError`)
 */
export type SaveResult =
  | { status: "saved"; detail?: RecipeDetail }
  | { status: "local"; stillRejected?: boolean }
  | { status: "failed"; error: unknown };

/** Fehler ohne gültige Sitzung: Login folgt → 401, sonst offline. */
export function sessionError(auth: AuthState): Error {
  return loginFollows(auth)
    ? new ApiError(401, "Sitzung abgelaufen")
    : new OfflineError();
}

/**
 * Vorgemerkt: nur die Vormerkung ändern (das Backend kennt das Rezept noch
 * nicht). Ist die Vormerkung nicht lesbar, scheitert das nur für ein bekannt
 * vorgemerktes Rezept (`knownPending`), sonst geht es zur API. Sonst `PUT`
 * mit `payload`, nur mit gültiger Sitzung (offline kein stilles lokales
 * Speichern, 12.1).
 */
export async function saveChange(
  recipe: Recipe,
  payload: RecipeUpdatePayload,
  knownPending: boolean,
): Promise<SaveResult> {
  const uuid = recipe.recipe_uuid;
  if (!uuid) return { status: "failed", error: new Error("Rezept ohne ID") };
  try {
    const updated = await updatePending(recipe);
    if (updated) {
      return updated.stillRejected
        ? { status: "local", stillRejected: true }
        : { status: "local" };
    }
  } catch (e) {
    if (knownPending) {
      return { status: "failed", error: new LocalReadError(e) };
    }
  }
  const auth = await ensureAuth();
  if (auth !== "valid") return { status: "failed", error: sessionError(auth) };
  try {
    return { status: "saved", detail: await recipeApi.update(uuid, payload) };
  } catch (e) {
    console.warn("Failed to update recipe via API", e);
    return { status: "failed", error: e };
  }
}
