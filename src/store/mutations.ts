// Mutation type constants
export const SET_SETTINGS = 'setSettings'
export const SET_RECIPES = 'setRecipes'
export const SET_RECIPE = 'setRecipe'
export const ADD_RECIPE = 'addRecipe'
export const DEL_RECIPE = 'delRecipe'
export const SET_RECIPE_PICTURES = 'setRecipePictures'
export const SET_RECIPES_PICTURES = 'setRecipesPictures'

import type { Recipe, RecipePictures } from '../types/recipe'
import type { Settings } from '../types/settings'

export interface StoreState {
  recipes: Recipe[]
  settings: Settings
  recipe_pictures: RecipePictures
}

export interface SetRecipePayload {
  index: number
  recipe: Recipe
}

export interface SetRecipePicturesPayload {
  uuid: string
  pictures: File[]
}

export default {
  [SET_SETTINGS](state: StoreState, settings: Settings) {
    state.settings = settings
  },
  [SET_RECIPES](state: StoreState, recipes: Recipe[]) {
    state.recipes = recipes
  },
  [SET_RECIPE](state: StoreState, { index, recipe }: SetRecipePayload) {
    state.recipes.splice(index, 1, recipe)
  },
  [DEL_RECIPE](state: StoreState, index: number) {
    state.recipes.splice(index, 1)
  },
  [ADD_RECIPE](state: StoreState, recipe: Recipe) {
    state.recipes.push(recipe)
  },
  [SET_RECIPES_PICTURES](state: StoreState, pictures: RecipePictures) {
    state.recipe_pictures = pictures
  },
  [SET_RECIPE_PICTURES](state: StoreState, { uuid, pictures }: SetRecipePicturesPayload) {
    state.recipe_pictures[uuid] = pictures
  }
}
