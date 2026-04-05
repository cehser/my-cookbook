import yaml from "js-yaml";
import { generateUUID } from "./uuid";
import type { Recipe } from "@/types/recipe";

const new_recipe_de = `
ingredients: []
steps: []
sections: []
recipe_name: Neues Rezept
imageurl: 
yields:
  - unit: Portionen
    value: 4
recalc_exp: 1
`;

const sample_recipe = `
sections: []
recipe_name: Beispiel
imageurl: 
yields:
  - unit: Portionen
    value: 4
ingredients:
  - name: apple
    amounts:
      - amount: 1
        unit: each
    section: ""
    notes:
      - Use whole apples
      - Apples may be substituted, but produce a different flavor and mouthfeel
  - name: pear
    amounts:
      - amount: 1
        unit: each
    section: ""
    notes:
      - Use whole pears
      - Pears may be substituted, but produce a different flavor and mouthfeel
steps:
  - step:
        Gather the apples.
    haccp:
        control_point: The apples must be clean
    notes:
        - Some people like green
        - Some people like red
  - step:
        Hand out the apples.
    haccp:
        critical_control_point: Wash hands with soap and warm water before distributing.
`;

/**
 * Coerce a value to a number. Returns null if not possible.
 */
function toNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Initialize a recipe with default values and coerce types
 */
export function initRecipe(recipe: Partial<Recipe>): Recipe {
  // Set default values
  const initialized: Recipe = {
    sections:
      recipe.sections && recipe.sections.length > 0
        ? recipe.sections
        : [{ section: "" }],
    steps: recipe.steps || [],
    ingredients: recipe.ingredients || [],
    recipe_uuid: recipe.recipe_uuid || generateUUID(),
    lastUpdated: recipe.lastUpdated || new Date().toISOString(),
    recipe_name: recipe.recipe_name || "Neues Rezept",
    yields: recipe.yields,
    author: recipe.author,
    source_url: recipe.source_url,
    source_book: recipe.source_book,
    bake_time: recipe.bake_time,
    subtitle: recipe.subtitle,
    imageurl: recipe.imageurl,
    recalc_exp: recipe.recalc_exp,
    tags: recipe.tags,
  };

  // Ensure all ingredients have required fields and numeric amounts
  initialized.ingredients.forEach((ingredient) => {
    ingredient.name = ingredient.name || "";
    ingredient.section = ingredient.section || "";
    ingredient.amounts = ingredient.amounts || [{ amount: null, unit: "" }];
    ingredient.amounts.forEach((amt) => {
      amt.amount = toNumber(amt.amount);
    });
  });

  // Ensure all steps have a section
  initialized.steps.forEach((step) => {
    step.section = step.section || "";
  });

  // Coerce yields values to numbers
  if (initialized.yields) {
    initialized.yields.forEach((yld) => {
      yld.unit = yld.unit || "Portionen";
      const num = toNumber(yld.value);
      if (num !== null) yld.value = num;
    });
  }

  return initialized;
}

/**
 * Load multiple recipes from YAML content
 */
export function loadYamlCookbook(content: string): Recipe[] {
  const recipes = yaml.load(content) as Recipe[];
  recipes.forEach((recipe) => initRecipe(recipe));
  return recipes;
}

/**
 * Load the sample recipe
 */
export function loadSample(): Recipe {
  return loadYamlRecipe(sample_recipe);
}

/**
 * Load a new empty recipe
 */
export function loadNewRecipe(): Recipe {
  return loadYamlRecipe(new_recipe_de);
}

/**
 * Load a single recipe from YAML content
 */
export function loadYamlRecipe(content: string): Recipe {
  return initRecipe(yaml.load(content) as Partial<Recipe>);
}

/**
 * Merge local and remote cookbooks
 * Updates local recipes if remote is newer, adds new remote recipes
 */
export function mergeCookbooks(
  local: Recipe[],
  remote: Recipe[],
  dispatch: (action: string, payload: unknown) => void,
): Recipe[] {
  remote.forEach((remoteRecipe) => {
    const localIndex = local.findIndex(
      (x) => x.recipe_uuid === remoteRecipe.recipe_uuid,
    );
    const localRecipe = local[localIndex];

    // Replace if remote is newer or equal (to replace unsaved local changes)
    if (
      localIndex !== -1 &&
      !(localRecipe.lastUpdated > remoteRecipe.lastUpdated)
    ) {
      local.splice(localIndex, 1, remoteRecipe);
      dispatch("downloadSingleRecipePictures", { recipe: remoteRecipe });
    } else if (localIndex === -1) {
      local.push(remoteRecipe);
    }
  });

  return local;
}

/**
 * Compare two files for equality
 */
export function filesEqual(file1: File, file2: File): boolean {
  return (
    file1.name === file2.name &&
    file1.lastModified === file2.lastModified &&
    file1.size === file2.size
  );
}
