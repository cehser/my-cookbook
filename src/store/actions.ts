import { set, get } from 'idb-keyval'
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
import { loadYamlCookbook, loadSample } from '@/js/recipes'
import { deepCopyJSON, deepCopyYaml } from '@/js/deepCopy'
import { serializeRecipePictures, deserializeRecipePictures } from '@/js/fileStorage'
import recipeApi from '@/api/recipes'
import imageApi from '@/api/images'
import { isAuthenticated } from '@/auth/oidc'
import type { Recipe, RecipePictures } from '@/types/recipe'
import type { Settings } from '@/types/settings'

interface ActionContext {
  commit: (type: string, payload?: any) => void
  dispatch: (type: string, payload?: any) => Promise<any>
  state: StoreState
}

export default {
  async loadSettings({ commit }: ActionContext) {
    // Try to load settings from API if authenticated
    if (await isAuthenticated()) {
      try {
        const { default: api } = await import('@/api/client')
        const settings = await api.get<Settings>('/me/settings')
        commit(SET_SETTINGS, settings)
        // Cache in IDB for offline
        set('settings', settings)
        return
      } catch (e) {
        console.warn('Failed to load settings from API, falling back to IDB', e)
      }
    }

    // Fallback: IDB
    const val: Settings | undefined = await get('settings')
    if (val) {
      commit(SET_SETTINGS, val)
    }
  },

  async loadRecipes({ commit, dispatch }: ActionContext) {
    // If the user is authenticated, load from the API
    if (await isAuthenticated()) {
      console.log('Authenticated – loading recipes from API')
      try {
        await dispatch('loadRecipesFromApi')
        return
      } catch (e) {
        console.warn('API load failed, falling back to IDB', e)
      }
    }

    // Fallback: load from IndexedDB / localStorage
    console.log('Read recipes from idb')
    get('recipes').then((val: Recipe[] | undefined) => {
      if (val) {
        commit(SET_RECIPES, val)
      } else {
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

  async loadFavorites({ commit }: ActionContext) {
    if (await isAuthenticated()) {
      try {
        const { default: favoritesApi } = await import('@/api/favorites')
        const favorites = await favoritesApi.list()
        commit(SET_FAVORITES, favorites)
        // Cache in IDB for offline
        set('favorites', favorites)
        return
      } catch (e) {
        console.warn('Failed to load favorites from API, falling back to IDB', e)
      }
    }
    // Fallback: IDB
    const val: string[] | undefined = await get('favorites')
    if (val) {
      commit(SET_FAVORITES, val)
    }
  },

  async addFavorite({ commit }: ActionContext, uuid: string) {
    commit(ADD_FAVORITE, uuid)
    if (await isAuthenticated()) {
      try {
        const { default: favoritesApi } = await import('@/api/favorites')
        await favoritesApi.add(uuid)
      } catch (e) {
        console.warn('Failed to add favorite via API', e)
      }
    }
    // Always cache in IDB
    const favorites = [...(await get('favorites') as string[] || [])]
    if (!favorites.includes(uuid)) favorites.push(uuid)
    set('favorites', favorites)
  },

  async removeFavorite({ commit }: ActionContext, uuid: string) {
    commit(REMOVE_FAVORITE, uuid)
    if (await isAuthenticated()) {
      try {
        const { default: favoritesApi } = await import('@/api/favorites')
        await favoritesApi.remove(uuid)
      } catch (e) {
        console.warn('Failed to remove favorite via API', e)
      }
    }
    // Always cache in IDB
    const favorites = ((await get('favorites') as string[] || []).filter((id: string) => id !== uuid))
    set('favorites', favorites)
  },

  saveRecipes({ commit, state }: ActionContext) {
    // Save to idb first, then commit to store
    // Kill all possible references to vue model and proxies
    const recipes = deepCopyYaml(state.recipes)
    set('recipes', recipes).then(() => commit(SET_RECIPES, state.recipes))
  },

  async saveSettings({ commit }: ActionContext, settings: Settings) {
    commit(SET_SETTINGS, settings)
    // Persist to API if authenticated
    if (await isAuthenticated()) {
      try {
        const { default: api } = await import('@/api/client')
        const updated = await api.put<Settings>('/me/settings', {
          read_only: settings.read_only,
          expert_mode: settings.expert_mode,
          gpt_model: settings.gpt_model,
        })
        commit(SET_SETTINGS, updated)
        set('settings', updated)
        return
      } catch (e) {
        console.warn('Failed to save settings to API', e)
      }
    }
    // Fallback: IDB only
    set('settings', deepCopyJSON(settings))
  },

  async saveRecipePictures({ commit, state }: ActionContext) {
    // Save to idb first, then commit to store
    // Serialize File objects to preserve blob data
    const serialized = await serializeRecipePictures(state.recipe_pictures)
    set('recipe_pictures', serialized).then(() => commit(SET_RECIPES_PICTURES, state.recipe_pictures))
  },

  async deleteRecipe({ commit, dispatch, state }: ActionContext, idOrIndex: string | number) {
    let index: number
    let uuid: string | undefined
    if (typeof idOrIndex === 'string') {
      index = state.recipes.findIndex(r => r.recipe_uuid === idOrIndex)
      uuid = idOrIndex
    } else {
      index = idOrIndex
      uuid = state.recipes[index]?.recipe_uuid
    }
    if (index < 0) return
    commit(DEL_RECIPE, index)
    if (await isAuthenticated() && uuid) {
      try {
        await recipeApi.delete(uuid)
      } catch (e) {
        console.warn('Failed to delete recipe via API', e)
      }
    }
    dispatch('saveRecipes')
  },

  async appendRecipe({ commit, dispatch }: ActionContext, recipe: Recipe) {
    const recipeCopy = deepCopyYaml(recipe)
    if (await isAuthenticated()) {
      try {
        const { recipe_uuid, recipe_name, lastUpdated, ingredients, steps, sections, tags, ...rest } = recipeCopy
        const detail = await recipeApi.create({
          recipe_name,
          data: { ingredients, steps, sections, ...rest },
          tags: tags || [],
        })
        // Reload from API to get server-generated ID and timestamps
        await dispatch('loadRecipesFromApi')
        return detail
      } catch (e) {
        console.warn('Failed to create recipe via API, saving locally', e)
      }
    }
    commit(ADD_RECIPE, recipeCopy)
    dispatch('saveRecipes')
  },

  async setRecipe({ commit, dispatch, state }: ActionContext, { index, recipe }: SetRecipePayload) {
    const recipeCopy = deepCopyYaml(recipe)
    commit(SET_RECIPE, { index, recipe: recipeCopy })
    if (await isAuthenticated() && recipeCopy.recipe_uuid) {
      try {
        const { recipe_uuid, recipe_name, lastUpdated, ingredients, steps, sections, tags, ...rest } = recipeCopy
        await recipeApi.update(recipe_uuid, {
          recipe_name,
          data: { ingredients, steps, sections, ...rest },
          tags: tags || [],
        })
        // Update IDB cache for this recipe
        set(`recipe:${recipe_uuid}`, recipeCopy)
      } catch (e) {
        console.warn('Failed to update recipe via API', e)
      }
    }
    dispatch('saveRecipes')
  },

  async setRecipePicture(
    { commit, dispatch }: ActionContext,
    { uuid, picture }: { uuid: string; picture: File | null }
  ) {
    if (picture && await isAuthenticated()) {
      try {
        await imageApi.upload(uuid, picture)
        // No need to store locally — images are served from API
        return
      } catch (e) {
        console.warn('Failed to upload image to API, saving locally', e)
      }
    }
    // Delete from API if picture is null
    if (!picture && await isAuthenticated()) {
      try {
        const images = await imageApi.list(uuid)
        for (const img of images) {
          await imageApi.delete(uuid, img.id)
        }
        return
      } catch (e) {
        console.warn('Failed to delete images via API', e)
      }
    }
    // Fallback: local IDB storage
    commit(SET_RECIPE_PICTURES, { uuid, pictures: picture ? [picture] : [] })
    dispatch('saveRecipePictures')
  },

  // -----------------------------------------------------------------------
  // API-backed actions (used when authenticated against the backend)
  // -----------------------------------------------------------------------

  async loadRecipesFromApi({ commit, dispatch }: ActionContext) {
    const res = await recipeApi.list({ page_size: 200 })
    // Convert API list items to Recipe-compatible objects for the store
    const recipes: Recipe[] = res.items.map((item) => ({
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
    }))
    commit(SET_RECIPES, recipes)
    // Cache lightweight list in IDB for offline gallery
    set('recipes', deepCopyYaml(recipes))

    // Prefetch full details into recipe:{uuid} keys for offline recipe view
    dispatch('prefetchRecipeDetails', recipes)
  },

  async loadRecipeDetailFromApi(_ctx: ActionContext, id: string) {
    const detail = await recipeApi.get(id)
    // Merge data fields into a Recipe-shaped object
    const recipe: Recipe = {
      recipe_uuid: detail.id,
      recipe_name: detail.recipe_name,
      lastUpdated: detail.updated_at,
      first_image_id: detail.first_image_id ?? undefined,
      ingredients: [],
      steps: [],
      sections: [],
      tags: detail.tags,
      ...(detail.data as Record<string, unknown>),
    }
    // Cache full detail in IDB for offline access
    set(`recipe:${recipe.recipe_uuid}`, recipe)
    return recipe
  },

  async prefetchRecipeDetails(_ctx: ActionContext, recipes: Recipe[]) {
    // Fetch full details and cache each under recipe:{uuid} in IDB
    let fetched = 0
    const batchSize = 5
    for (let i = 0; i < recipes.length; i += batchSize) {
      const batch = recipes.slice(i, i + batchSize)
      await Promise.allSettled(
        batch.map(async (r) => {
          try {
            const cached: Recipe | undefined = await get(`recipe:${r.recipe_uuid}`)
            // Re-fetch if not cached, timestamp changed, or cached data is incomplete
            const isComplete = cached?.ingredients?.some(i => i.amounts?.length > 0)
            if (cached && cached.lastUpdated === r.lastUpdated && isComplete) {
              fetched++
              return
            }
            const detail = await recipeApi.get(r.recipe_uuid)
            const full: Recipe = {
              recipe_uuid: detail.id,
              recipe_name: detail.recipe_name,
              lastUpdated: detail.updated_at,
              first_image_id: detail.first_image_id ?? undefined,
              ingredients: [],
              steps: [],
              sections: [],
              tags: detail.tags,
              ...(detail.data as Record<string, unknown>),
            }
            set(`recipe:${full.recipe_uuid}`, full)
            fetched++
          } catch (e) {
            // Best-effort — skip on error
          }
        })
      )
    }
    console.log(`Prefetched ${fetched}/${recipes.length} recipe details for offline use`)
  },

  async searchRecipesApi({ commit }: ActionContext, query: string) {
    const res = await recipeApi.list({ q: query, page_size: 200 })
    const recipes: Recipe[] = res.items.map((item) => ({
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
    }))
    return recipes
  },
}
