import { set, getMany, get, del } from 'idb-keyval'
import {
  ADD_RECIPE,
  DEL_RECIPE,
  SET_RECIPE,
  SET_RECIPES,
  SET_RECIPE_PICTURES,
  SET_RECIPES_PICTURES,
  SET_SETTINGS,
  ADD_FAVORITE,
  REMOVE_FAVORITE,
  SET_FAVORITES,
  type StoreState,
  type SetRecipePayload,
  type SetRecipePicturesPayload
} from './mutations'
import { loadYamlCookbook, loadSample, mergeCookbooks } from '@/js/recipes'
import { deepCopyJSON, deepCopyYaml } from '@/js/deepCopy'
import { serializeRecipePictures, deserializeRecipePictures } from '@/js/fileStorage'
import Cloud from '@/js/cloud'
import type { Recipe, RecipePictures } from '@/types/recipe'
import type { Settings } from '@/types/settings'

interface ActionContext {
  commit: (type: string, payload?: any) => void
  dispatch: (type: string, payload?: any) => Promise<any>
  state: StoreState
}

export default {
  loadSettings({ commit, state }: ActionContext) {
    get('settings').then((val: Settings | undefined) => {
      if (val) {
        commit(SET_SETTINGS, val)
      } else {
        // Fallback to separately stored values
        const fallbackSettings = deepCopyJSON(state.settings)
        getMany(['webdav', 'read_only']).then(([webdav, read_only]: [any, boolean | undefined]) => {
          if (webdav) {
            fallbackSettings.webdav = webdav
          }
          if (read_only !== undefined) {
            fallbackSettings.read_only = read_only
          }
        })
        // Save settings, then remove old keys from idb
        set('settings', fallbackSettings)
          .then(() => commit(SET_SETTINGS, fallbackSettings))
          .then(() => {
            del('webdav')
            del('read_only')
          })
      }
    })
  },

  loadRecipes({ commit }: ActionContext) {
    console.log('Read recipes from idb')
    get('recipes').then((val: Recipe[] | undefined) => {
      if (val) {
        commit(SET_RECIPES, val)
      } else {
        // Fallback to local storage instead of idb
        console.log('Fallback to localstorage')
        let recipes: Recipe[]
        const recipesStr = localStorage.getItem('recipes')
        
        if (recipesStr) {
          recipes = loadYamlCookbook(recipesStr)
          localStorage.removeItem('recipes')
        } else {
          console.log('Fallback to sample')
          recipes = [loadSample()]
        }
        
        console.log(recipes)
        set('recipes', recipes)
        commit(SET_RECIPES, recipes)
      }
    })
  },

  loadRecipePictures({ commit }: ActionContext) {
    console.log('Read recipe pictures from idb')
    get('recipe_pictures').then((val: any) => {
      if (val) {
        const pictures = deserializeRecipePictures(val)
        commit(SET_RECIPES_PICTURES, pictures)
      }
    })
  },

  loadFavorites({ commit }: ActionContext) {
    console.log('Read favorites from idb')
    get('favorites').then((val: string[] | undefined) => {
      if (val) {
        commit(SET_FAVORITES, val)
      }
    })
  },

  saveFavorites({ commit, state }: ActionContext) {
    const favorites = [...state.favorites]
    set('favorites', favorites).then(() => commit(SET_FAVORITES, state.favorites))
  },

  addFavorite({ commit, dispatch }: ActionContext, uuid: string) {
    commit(ADD_FAVORITE, uuid)
    dispatch('saveFavorites')
  },

  removeFavorite({ commit, dispatch }: ActionContext, uuid: string) {
    commit(REMOVE_FAVORITE, uuid)
    dispatch('saveFavorites')
  },

  saveRecipes({ commit, state }: ActionContext) {
    // Save to idb first, then commit to store
    // Kill all possible references to vue model and proxies
    const recipes = deepCopyYaml(state.recipes)
    set('recipes', recipes).then(() => commit(SET_RECIPES, state.recipes))
  },

  saveSettings({ commit }: ActionContext, settings: Settings) {
    // Save to idb first, then commit to store
    // Kill all possible references to vue model
    const settingsCopy = deepCopyJSON(settings)
    set('settings', settingsCopy).then(() => commit(SET_SETTINGS, settings))
  },

  async saveRecipePictures({ commit, state }: ActionContext) {
    // Save to idb first, then commit to store
    // Serialize File objects to preserve blob data
    const serialized = await serializeRecipePictures(state.recipe_pictures)
    set('recipe_pictures', serialized).then(() => commit(SET_RECIPES_PICTURES, state.recipe_pictures))
  },

  deleteRecipe({ commit }: ActionContext, index: number) {
    commit(DEL_RECIPE, index)
  },

  appendRecipe({ commit }: ActionContext, recipe: Recipe) {
    // Kill all possible references to vue model
    const recipeCopy = deepCopyYaml(recipe)
    commit(ADD_RECIPE, recipeCopy)
  },

  setRecipe({ commit, dispatch }: ActionContext, { index, recipe }: SetRecipePayload) {
    // Kill all possible references to vue model
    const recipeCopy = deepCopyYaml(recipe)
    commit(SET_RECIPE, { index, recipe: recipeCopy })
    dispatch('saveRecipes')
  },

  async getRecipesFromCloud({ commit, state }: ActionContext) {
    const recipes_data = await Cloud.getRecipes(state.settings)
    const recipes = loadYamlCookbook(recipes_data)
    const images = await Cloud.getRecipeImages(state.settings, recipes)
    commit(SET_RECIPES, recipes)
    commit(SET_RECIPES_PICTURES, images)
  },

  async syncRecipesWithCloud({ commit, state, dispatch }: ActionContext) {
    const recipes_data = await Cloud.getRecipes(state.settings)
    const recipes_remote = loadYamlCookbook(recipes_data)

    const recipes = mergeCookbooks(
      deepCopyYaml(state.recipes),
      recipes_remote,
      (action: string, payload: any) => dispatch(action, payload)
    )
    commit(SET_RECIPES, recipes)
  },

  async downloadRecipePictures({ commit, dispatch, state }: ActionContext) {
    Cloud.getRecipeImages(state.settings, state.recipes).then((recipe_images: RecipePictures) => {
      commit(SET_RECIPES_PICTURES, recipe_images)
      dispatch('saveRecipePictures')
    })
  },

  async downloadSingleRecipePictures(
    { commit, dispatch, state }: ActionContext,
    { recipe }: { recipe: Recipe }
  ) {
    Cloud.getSingleRecipeImages(state.settings, recipe).then((pictures: File[]) => {
      commit(SET_RECIPE_PICTURES, { uuid: recipe.recipe_uuid, pictures })
      dispatch('saveRecipePictures')
    })
  },

  setRecipePicture(
    { commit, dispatch }: ActionContext,
    { uuid, picture }: { uuid: string; picture: File }
  ) {
    commit(SET_RECIPE_PICTURES, { uuid, pictures: [picture] })
    dispatch('saveRecipePictures')
  }
}
