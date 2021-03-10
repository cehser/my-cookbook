import { set, getMany, get, del} from 'idb-keyval';
import {ADD_RECIPE, DEL_RECIPE, SET_RECIPE, SET_RECIPES, SET_RECIPE_PICTURES, SET_RECIPES_PICTURES, SET_SETTINGS, SET_FAVORITES} from './mutations';
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
  loadRecipePictures({ commit }) {
    console.log('Read recipe pictures from idb')
    get('recipe_pictures')
      .then((val) => { 
        if(val) {
          commit(SET_RECIPES_PICTURES, val) 
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
  saveRecipePictures({ commit, state }){
    //save to idb first, then commit to store
    set('recipe_pictures', state.recipe_pictures)
      .then(()=>commit(SET_RECIPES_PICTURES, state.recipe_pictures))
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
    //kill all possible references to vue model
    recipe = DeepCopy.deepCopyYaml(recipe)
    commit(SET_RECIPE, {index, recipe})
    dispatch('saveRecipes')
  },
  async getRecipesFromCloud({ commit, state}){
    let recipes_data = await Cloud.getRecipes(state.settings)
    let recipes = RecipeHelper.loadYamlCookbook(recipes_data)
    let images = await Cloud.getRecipeImages(state.settings, recipes)
    commit(SET_RECIPES, recipes);
    commit(SET_RECIPES_PICTURES, images);
  },
  async syncRecipesWithCloud({ commit, state, dispatch}){
    let recipes_data = await Cloud.getRecipes(state.settings)
    let recipes_remote = RecipeHelper.loadYamlCookbook(recipes_data)

    let recipes = RecipeHelper.mergeCoobooks(DeepCopy.deepCopyYaml(state.recipes), recipes_remote, dispatch);
    commit(SET_RECIPES, recipes);
  },
  async downloadRecipePictures({ commit, state}) {
    Cloud.getRecipeImages(state.settings, state.recipes)
      .then(recipe_images =>  {
        commit(SET_RECIPES_PICTURES, recipe_images)
      });
  },
  async downloadSingleRecipePictures({ commit, dispatch, state}, {recipe}) {
    Cloud.getSingleRecipeImages(state.settings, recipe)
      .then(pictures =>  {
        commit(SET_RECIPE_PICTURES, {uuid:recipe.recipe_uuid, pictures})
        dispatch('saveRecipePictures')
      });
  },
  setRecipePicture({commit, dispatch}, {uuid, picture}) {
    commit(SET_RECIPE_PICTURES, {uuid, pictures:[picture]})
    dispatch('saveRecipePictures')
  },
  setFavorites({commit}, {list, favorites}) {
    commit(SET_FAVORITES, {list, favorites})
  }
}
