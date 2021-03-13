import Vuex from 'vuex'
import Vue from 'vue'

import Favorites from './favorites'
import Settings from './settings'
import Recipes from './recipes'

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