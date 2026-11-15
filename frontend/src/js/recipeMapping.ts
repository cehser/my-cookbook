import type { RecipeDetail, RecipeListItem } from "@/api/recipes";
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
