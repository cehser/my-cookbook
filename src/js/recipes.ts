import yaml from 'js-yaml'
import UUID from './uuid'
import type { Recipe } from '../types/recipe'

const new_recipe_de = `
ingredients: []
steps: []
sections: []
recipe_name: Neues Rezept
imageurl: 
yields:
  - Portionen: 4
recalc_exp: 1
`

const sample_recipe = `
sections: []
recipe_name: Beispiel
imageurl: 
yields:
  - Portionen: 4
ingredients:
  - apple:
      usda_num: 09003
      amounts:
          - amount: 1
            unit: each
      processing:
          - whole
          - raw
      substitutions:
          - pears:
              usda_num: 09252
              amounts:
                  - amount: 1
                    unit: each
      notes:
          - Use whole apples
          - Apples may be substituted, but produce a different flavor and mouthfeel
  - pear:
      usda_num: 09003
      amounts:
          - amount: 1
            unit: each
      processing:
          - whole
          - raw
      substitutions:
          - pears:
              usda_num: 09252
              amounts:
                  - amount: 1
                    unit: each
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
`

/**
 * Initialize a recipe with default values
 */
export function initRecipe(recipe: Partial<Recipe>): Recipe {
  // Set default values
  const initialized: Recipe = {
    sections: recipe.sections && recipe.sections.length > 0 ? recipe.sections : [{ section: '' }],
    steps: recipe.steps || [],
    ingredients: recipe.ingredients || [],
    recipe_uuid: recipe.recipe_uuid || UUID.generateUUID(),
    lastUpdated: recipe.lastUpdated || new Date().toISOString(),
    recipe_name: recipe.recipe_name || 'Neues Rezept',
    yields: recipe.yields,
    author: recipe.author,
    source_url: recipe.source_url,
    source_book: recipe.source_book,
    bake_time: recipe.bake_time,
    subtitle: recipe.subtitle,
    imageurl: recipe.imageurl,
    recalc_exp: recipe.recalc_exp,
    cloud_images: recipe.cloud_images,
    tags: recipe.tags
  }

  // Ensure all ingredients have a section
  initialized.ingredients.forEach(ingredient => {
    ingredient.section = ingredient.section || ''
  })

  // Ensure all steps have a section
  initialized.steps.forEach(step => {
    step.section = step.section || ''
  })

  return initialized
}

/**
 * Load multiple recipes from YAML content
 */
export function loadYamlCookbook(content: string): Recipe[] {
  const recipes = yaml.load(content) as Recipe[]
  recipes.forEach(recipe => initRecipe(recipe))
  return recipes
}

/**
 * Load the sample recipe
 */
export function loadSample(): Recipe {
  return loadYamlRecipe(sample_recipe)
}

/**
 * Load a new empty recipe
 */
export function loadNewRecipe(): Recipe {
  return loadYamlRecipe(new_recipe_de)
}

/**
 * Load a single recipe from YAML content
 */
export function loadYamlRecipe(content: string): Recipe {
  return initRecipe(yaml.load(content) as Partial<Recipe>)
}

/**
 * Merge local and remote cookbooks
 * Updates local recipes if remote is newer, adds new remote recipes
 */
export function mergeCookbooks(
  local: Recipe[],
  remote: Recipe[],
  dispatch: (action: string, payload: any) => void
): Recipe[] {
  remote.forEach(remoteRecipe => {
    const localIndex = local.findIndex(x => x.recipe_uuid === remoteRecipe.recipe_uuid)
    const localRecipe = local[localIndex]
    
    // Replace if remote is newer or equal (to replace unsaved local changes)
    if (localIndex !== -1 && !(localRecipe.lastUpdated > remoteRecipe.lastUpdated)) {
      local.splice(localIndex, 1, remoteRecipe)
      dispatch('downloadSingleRecipePictures', { recipe: remoteRecipe })
      console.log(localRecipe.lastUpdated)
      console.log(remoteRecipe.lastUpdated)
      console.log('Local not newer: ' + !(localRecipe.lastUpdated > remoteRecipe.lastUpdated))
      console.log('Local replaced')
    } else if (localIndex === -1) {
      console.log('remote pushed')
      local.push(remoteRecipe)
    }
  })
  
  return local
}

/**
 * Compare two files for equality
 */
export function filesEqual(file1: File, file2: File): boolean {
  return (
    file1.name === file2.name &&
    file1.lastModified === file2.lastModified &&
    file1.size === file2.size
  )
}

// Default export for backward compatibility
export default {
  new_recipe_de,
  sample_recipe,
  initRecipe,
  loadYamlCookbook,
  loadSample,
  loadNewRecipe,
  loadYamlRecipe,
  mergeCoobooks: mergeCookbooks, // Keep typo for backward compatibility
  filesEqual
}
