import Vuex from 'vuex'
import Vue from 'vue'


import actions from './actions'
import mutations from './mutations'

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
    favorites: {Favoriten:["5e89e581-0d0a-4eec-a901-c08632c10135", "79714305-b0fd-44a7-87b9-c56d3ac8e3fc"]}
  },
  actions,
  mutations
})