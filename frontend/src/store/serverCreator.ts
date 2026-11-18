/**
 * Ersteller-Abgleich eines Rezepts auf dem Server (`created_by` ↔ eigener
 * `sub`), für die Anlage mit Client-ID (409) und vor dem `DELETE` eines
 * vorgemerkten, nie bestätigten Rezepts. Die ID kann zufällig einem fremden
 * Rezept gehören; ein Admin dürfte es löschen, deshalb vorher prüfen.
 */

import { ApiError } from "@/api/client";
import { recipeApi, type RecipeDetail } from "@/api/recipes";
import { sameUser } from "@/auth/role";
import { currentUserSub } from "@/auth/session";

/** Hat der angemeldete Nutzer das Rezept angelegt? */
export async function isOwnRecipe(detail: RecipeDetail): Promise<boolean> {
  return sameUser(detail.created_by, await currentUserSub());
}

/**
 * Ersteller per `GET /recipes/{id}`: `missing` (404), `own` oder `foreign`.
 * Wirft bei allen übrigen Fehlern (Ausfall wie Ablehnung) und ohne
 * angemeldeten Nutzer (dann ist „fremd“ nicht entscheidbar); der Aufrufer
 * entscheidet, ob er es später erneut versucht.
 */
export async function serverCreator(
  uuid: string,
): Promise<"missing" | "own" | "foreign"> {
  if (!(await currentUserSub())) throw new Error("Kein angemeldeter Nutzer");
  let detail: RecipeDetail;
  try {
    detail = await recipeApi.get(uuid);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return "missing";
    throw e;
  }
  return (await isOwnRecipe(detail)) ? "own" : "foreign";
}
