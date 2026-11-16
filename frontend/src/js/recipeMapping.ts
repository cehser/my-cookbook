import type {
  RecipeCreatePayload,
  RecipeDetail,
  RecipeListItem,
} from "@/api/recipes";
import type { Recipe } from "@/types/recipe";

/** Listeneintrag der API als Rezept ohne Zutaten, Schritte und Abschnitte. */
export function listItemToRecipe(item: RecipeListItem): Recipe {
  return {
    recipe_uuid: item.id,
    recipe_name: item.recipe_name,
    author: item.author ?? undefined,
    subtitle: item.subtitle ?? undefined,
    tags: item.tags,
    imageurl: item.imageurl ?? undefined,
    first_image_id: item.first_image_id ?? undefined,
    lastUpdated: item.updated_at,
    ingredients: [],
    steps: [],
    sections: [],
  };
}

/** Detailantwort der API als vollständiges Rezept. */
export function detailToRecipe(detail: RecipeDetail): Recipe {
  const { first_image_id: _fii, ...data } = (detail.data ?? {}) as Record<
    string,
    unknown
  >;
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
  };
}

/**
 * Rezept als Nutzlast für `POST`/`PUT`: ID, Zeitstempel und Titelbild sind
 * keine Rezeptdaten (die ID schickt `recipeApi.create` getrennt mit).
 */
export function recipeToPayload(recipe: Recipe): RecipeCreatePayload {
  const {
    recipe_uuid: _uuid,
    recipe_name,
    lastUpdated: _updated,
    first_image_id: _fii,
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
