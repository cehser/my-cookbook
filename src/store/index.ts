import { createStore } from 'vuex'

import actions from './actions'
import mutations from './mutations'
import uiState from './modules/uiState'
import type { Settings } from '../types/settings'
import type { Recipe, RecipePictures } from '../types/recipe'

const debug = import.meta.env.MODE !== 'production'

const default_settings = {
  read_only: true,
  autosync: false,
  expert_mode: false,
  webdav: {
    webdav_creds: {
      username: 'user',
      password: 'pass'
    },
    webdav_url: 'https://webdav.server',
    filepath: '/cookbook.yaml'
  },
  ai: {
    openai_api_key: '',
    gpt_id: 'g-692e0d9d69408191bf283eddfbd22e4a'
  }
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
