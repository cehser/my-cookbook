import { createStore } from 'vuex'

import actions from './actions'
import mutations from './mutations'
import uiState from './modules/uiState'

const debug = import.meta.env.MODE !== 'production'

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

export default createStore({
  strict: debug,
  state: {
    recipes: [],
    settings: default_settings,
    recipe_pictures: {}
  },
  actions,
  mutations,
  modules: {
    uiState
  }
})