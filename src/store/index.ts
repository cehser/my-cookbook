import Vuex from 'vuex'
import Vue from 'vue'

import Favorites from './modules/favorites'
import Settings from './modules/settings'
import Recipes from './modules/recipes'

const debug = process.env.NODE_ENV !== 'production'

Vue.use(Vuex)

export default new Vuex.Store({
  strict: debug,
  modules: {
    Favorites,
    Settings,
    Recipes
  },
  getters: {
    getSettings: (state) => {
      return state.Settings.settings
    }
  }
})