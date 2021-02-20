export const SET_SETTINGS = 'setSettings'
export const SET_RECIPES = 'setRecipes'
export const SET_RECIPE = 'setRecipe'
export const ADD_RECIPE = 'addRecipe'
export const DEL_RECIPE = 'delRecipe'
export const SET_RECIPE_PICTURES = 'setRecipePictures'
export const SET_RECIPES_PICTURES = 'setRecipesPictures'

export default {
    [SET_SETTINGS] (state, settings) {
      state.settings = settings
    },
    [SET_RECIPES] (state, recipes) {
      state.recipes = recipes
    },
    [SET_RECIPE] (state, {index, recipe}) {
      state.recipes.splice(index, 1, recipe)
    },
    [DEL_RECIPE] (state, index) {
      state.recipes.splice(index, 1)
    },
    [ADD_RECIPE] (state, recipe) {
      state.recipes.push(recipe)
    },
    [SET_RECIPES_PICTURES] (state, pictures) {
      state.recipe_pictures = pictures
    },
    [SET_RECIPE_PICTURES] (state, {uuid, pictures}) {
      state.recipe_pictures[uuid] = pictures
    },
}