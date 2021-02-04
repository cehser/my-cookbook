import { set, getMany, get, del} from 'idb-keyval';
import {SET_RECIPES, SET_SETTINGS} from './mutations';
import RecipeHelper from './recipes'

//import { createClient } from 'webdav/web';

export default {
  loadSettings({ commit , state}) {
    get('settings')
      .then((val) => {
        if(val) commit(SET_SETTINGS, val)
        else {
          //fallback to separately stored values
          let val = JSON.parse(JSON.stringify(state.settings))
          getMany(['webdav', 'read_only']).then( ([webdav, read_only]) => {
            if(webdav) {
              val.webdav = webdav;  
            }
            if(read_only != undefined) {
              val.read_only = read_only;  
            }
          })
          //save settings, then remove old keys from idb
          set('settings', val)
            .then(()=>commit(SET_SETTINGS, val))
            .then(()=> {del('webdav');del('read_only') })
        }
      })
  },
  loadRecipes({ commit }) {
    console.log('Read recipes from idb')
    get('recipes')
      .then((val) => { 
        if(val) {
          commit(SET_RECIPES, val) 
        }
        //fallback to local storage instead of idb
        else {
          console.log('Fallback to localstorage')
          let recipes = localStorage.getItem('recipes')
          if (recipes) {
            recipes = RecipeHelper.loadYamlCookbook(localStorage.getItem('recipes'));
            localStorage.removeItem('recipes');
          } 
          else {
            console.log('Fallback to sample')
            recipes = [RecipeHelper.loadSample()]
          }
          console.log(recipes);
          set('recipes',recipes )
          commit(SET_RECIPES, recipes);
        }
      })
  },
  saveRecipes({ commit }, recipes){
    //save to idb first, then commit to store
    set('recipes', recipes)
      .then(()=>commit(SET_RECIPES, recipes))
  },
  saveSettings({ commit }, settings){
    //save to idb first, then commit to store
    set('settings', settings)
      .then(()=>commit(SET_SETTINGS, settings))
  },
  /*getRecipesFromCloud({ commit }, settings){
  }*/
}
