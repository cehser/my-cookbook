import { createStore } from 'vuex'

import actions from './actions'
import mutations from './mutations'
import uiState from './modules/uiState'
import type { Settings } from '@/types/settings'
import type { Recipe, RecipePictures } from '@/types/recipe'

const debug = import.meta.env.MODE !== 'production'

const default_settings = {
  read_only: true,
  expert_mode: false,
  gpt_model: 'gpt-4o-mini',
  role: 'readonly',
} satisfies Settings

export interface RootState {
  recipes: Recipe[]
  settings: Settings
  recipe_pictures: RecipePictures
  favorites: string[]
}

export default createStore<RootState>({
  strict: debug,
  state: {
    recipes: [],
    settings: default_settings,
    recipe_pictures: {},
    favorites: []
  },
  actions,
  mutations,
  modules: {
    uiState
  }
})
