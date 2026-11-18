import type {
  RecipeCreatePayload,
  RecipeDetail,
  RecipeListItem,
} from "@/api/recipes";
import type { Recipe } from "@/types/recipe";

/**
 * Speichern bzw. Anlegen abgelehnt: Die Fassung stammt nur aus der
 * Listenzeile (`listOnly`), ihr fehlen Zutaten, Schritte und Notizen.
 */
export class IncompleteRecipeError extends Error {
  constructor() {
    super("Rezept nicht vollständig geladen");
    this.name = "IncompleteRecipeError";
  }
}

/**
 * Listeneintrag der API als Rezept ohne Zutaten, Schritte und Abschnitte,
 * gekennzeichnet als `listOnly` (darf nie als `data` gespeichert werden).
 */
export function listItemToRecipe(item: RecipeListItem): Recipe {
  return {
    listOnly: true,
    recipe_uuid: item.id,
    recipe_name: item.recipe_name,
    author: item.author ?? undefined,
    subtitle: item.subtitle ?? undefined,
    tags: item.tags,
    imageurl: item.imageurl ?? undefined,
    first_image_id: item.first_image_id ?? undefined,
    created_by: item.created_by ?? undefined,
    lastUpdated: item.updated_at,
    ingredients: [],
    steps: [],
    sections: [],
  };
}

/** Detailantwort der API als vollständiges Rezept. */
export function detailToRecipe(detail: RecipeDetail): Recipe {
  const {
    first_image_id: _fii,
    created_by: _cb,
    listOnly: _lo,
    ...data
  } = (detail.data ?? {}) as Record<string, unknown>;
  return {
    recipe_uuid: detail.id,
    recipe_name: detail.recipe_name,
    lastUpdated: detail.updated_at,
    ingredients: [],
    steps: [],
    sections: [],
    tags: detail.tags,
    ...data,
    first_image_id: detail.first_image_id ?? undefined,
    created_by: detail.created_by ?? undefined,
  };
}

/**
 * Listenzeile aus dem Cache (Kennzeichen wird nicht gespeichert, siehe
 * `withoutListOnly`): ohne Zutaten und Schritte und nicht vorgemerkt. Ein
 * vollständiges Rezept ohne beides gilt damit ebenfalls als Listenzeile;
 * das kostet nur einen Detailabruf beim Öffnen.
 */
export function looksLikeListRow(recipe: Recipe): boolean {
  return !recipe.ingredients?.length && !recipe.steps?.length;
}

/** Kopie ohne `listOnly` (für IndexedDB: das Kennzeichen lebt nur im Speicher). */
export function withoutListOnly(recipe: Recipe): Recipe {
  if (!("listOnly" in recipe)) return recipe;
  const { listOnly: _lo, ...rest } = recipe;
  return rest;
}

/**
 * Rezept als Nutzlast für `POST`/`PUT`: ID, Zeitstempel, Titelbild,
 * Ersteller und das Kennzeichen `listOnly` sind keine Rezeptdaten (die ID
 * schickt `recipeApi.create` getrennt mit).
 */
export function recipeToPayload(recipe: Recipe): RecipeCreatePayload {
  const {
    recipe_uuid: _uuid,
    recipe_name,
    lastUpdated: _updated,
    first_image_id: _fii,
    created_by: _cb,
    listOnly: _lo,
    ingredients,
    steps,
    sections,
    tags,
    ...rest
  } = recipe;
  return {
    recipe_name,
    data: { ingredients, steps, sections, ...rest },
    tags: tags || [],
  };
}
