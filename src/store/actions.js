import { set, getMany, get, del} from 'idb-keyval';
import {ADD_RECIPE, DEL_RECIPE, SET_RECIPE, SET_RECIPES, SET_SETTINGS} from './mutations';
import RecipeHelper from '../js/recipes'
import DeepCopy from '../js/deepCopy'
import Cloud from '../js/cloud'

export default {
  loadSettings({ commit , state}) {
    get('settings')
      .then((val) => {
        if(val) commit(SET_SETTINGS, val)
        else {
          //fallback to separately stored values
          let val = DeepCopy.deepCopyJSON(state.settings)
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
  saveRecipes({ commit, state }){
    //save to idb first, then commit to store
    set('recipes', state.recipes)
      .then(()=>commit(SET_RECIPES, state.recipes))
  },
  saveSettings({ commit }, settings){
    //save to idb first, then commit to store
    //kill all possible references to vue model
    settings = DeepCopy.deepCopyJSON(settings)
    set('settings', settings)
      .then(()=>commit(SET_SETTINGS, settings))
  },
  deleteRecipe({commit}, index) {
    commit(DEL_RECIPE, index)
  },
  appendRecipe({commit}, recipe) {
    //kill all possible references to vue model
    recipe = DeepCopy.deepCopyYaml(recipe)
    commit(ADD_RECIPE, recipe)
  },
  setRecipe({commit, dispatch}, {index, recipe}) {
    console.log(index)
    console.log(recipe)
    //kill all possible references to vue model
    recipe = DeepCopy.deepCopyYaml(recipe)
    commit(SET_RECIPE, {index, recipe})
    dispatch('saveRecipes')
  },
  async getRecipesFromCloud({ commit, state}){
    let data = await Cloud.getFile(state.settings)
    let recipes = RecipeHelper.loadYamlCookbook(data)
    commit(SET_RECIPES, recipes);
  },
  async syncRecipesWithCloud({ commit, state}){
    let data = await Cloud.getFile(state.settings)
    let recipes_remote = RecipeHelper.loadYamlCookbook(data)
    let recipes = RecipeHelper.mergeCoobooks(DeepCopy.deepCopyYaml(state.recipes), recipes_remote);
    commit(SET_RECIPES, recipes);
  }
}
