import { VuexModule, Module, Mutation, Action } from 'vuex-module-decorators'
import { set, getMany, get, del} from 'idb-keyval';
import _ from 'lodash'
import SettingsType from '@/types/settings'


const default_settings:SettingsType =  {
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

@Module({
  namespaced: true
})
export default class Settings extends VuexModule {
  public settings:SettingsType = default_settings

  @Mutation
  setSettings (settings:SettingsType) {
    if(settings) {
      this.settings = settings
    }
  }

  @Action({ commit: 'setSettings' })
  async saveSettings(settings:SettingsType){
    //save to idb first, then commit to store
    //kill all possible references to vue model
    settings = _.cloneDeep(settings)
  
    await set('settings', settings)
    return settings
  }

  @Action({ commit: 'setSettings' })
  async loadSettings() {
    return await get('settings')      
  }
}