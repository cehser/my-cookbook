import Vuex from 'vuex'
import Vue from 'vue'


import actions from './actions'
import mutations from './mutations'

import Favorites from './favorites'

const debug = process.env.NODE_ENV !== 'production'

const default_settings =  {
  read_only: true,
  autosync: false,
  webdav: {
    webdav_creds: {
      username: "user",
      password: "pass"
    },
    webdav_url: "https://webdav.server",
    filepath: "/cookbook.yaml"
  }
}

Vue.use(Vuex)

export default new Vuex.Store({
  strict: debug,
  state: {
    recipes: [],
    settings: default_settings,
    recipe_pictures: {},
  },
  actions,
  mutations,
  modules: {
    Favorites
  }
})