import { VuexModule, Module, Mutation, Action} from 'vuex-module-decorators'
import {Recipe} from '@/types/recipe'
import { set, getMany, get, del} from 'idb-keyval';
import _ from 'lodash'
import Cloud from '../js/cloud'

@Module({
  namespaced: true
})
export default class Recipes extends VuexModule {
  public recipes:Array<Recipe> = []
  public recipe_pictures:any = {}
  
  get settings(){
    return this.context.rootGetters.getSettings
  }
  
  @Mutation
  setRecipes (recipes:Array<Recipe>) {
    this.recipes = recipes
  }

  @Mutation
  setRecipe_m({index,recipe}:{index:number, recipe:Recipe}) {
    this.recipes.splice(index, 1, recipe)
  }
  
  @Mutation
  delRecipe(index:number) {
    this.recipes.splice(index, 1)
  }
  
  @Mutation
  addRecipe(recipe:Recipe) {
    this.recipes.push(recipe)
  }
  
  @Mutation
  setRecipesPictures(pictures:any) {
    this.recipe_pictures = pictures
  }

  @Mutation
  setRecipePictures({uuid, pictures}:{uuid:string, pictures:any}) {
    this.recipe_pictures[uuid] = pictures
  }

  @Action({ commit: 'setRecipes' })
  async loadRecipes() {
    console.log('Read recipes from idb')
    return await get('recipes')
  }

  @Action({ commit: 'setRecipesPictures' })
  async loadRecipePictures() {
    console.log('Read recipe pictures from idb')
    return await get('recipe_pictures')
  }

  @Action({ commit: 'setRecipes' })
  async saveRecipes(){
    //save to idb first, then commit to store
    await set('recipes', this.recipes)
    return this.recipes
  }

  @Action({ commit: 'setRecipesPictures' })
  async saveRecipePictures(){
    //save to idb first, then commit to store
    await set('recipe_pictures', this.recipe_pictures)
    return this.recipe_pictures
  }

  @Action({ commit: 'delRecipe' })
  deleteRecipe(index:number) {
    return index
  }

  @Action({ commit: 'addRecipe' })
  appendRecipe(recipe:Recipe) {
    //kill all possible references to vue model
    recipe = _.cloneDeep(recipe)
    return recipe
  }

  @Action
  setRecipe({index, recipe}: {index:number, recipe:Recipe}) {
    //kill all possible references to vue model
    recipe = _.cloneDeep(recipe)
    this.context.commit('setRecipe_m', {index, recipe})
    this.context.dispatch('saveRecipes')
  }

  @Action
  async getRecipesFromCloud(){
    let recipes_data = await Cloud.getRecipes(this.settings) as string
    let recipes = Recipe.createCookbookFromYaml(recipes_data)
    let images = await Cloud.getRecipeImages(this.settings, recipes)
    this.context.commit('setRecipes', recipes)
    this.context.commit('setRecipesPictures', images)
  }

  @Action
  async syncRecipesWithCloud(){
    let recipes_data = await Cloud.getRecipes(this.settings) as string
    let recipes_remote = Recipe.createCookbookFromYaml(recipes_data)

    let recipes = Recipe.mergeCoobooks(_.cloneDeep(this.recipes), recipes_remote, this.context.dispatch);
    this.context.commit('setRecipes', recipes);
  }

  @Action
  async downloadRecipePictures() {
    let recipe_images = await Cloud.getRecipeImages(this.settings, this.recipes)
    this.context.commit('setRecipesPictures', recipe_images)
  }

  @Action
  async downloadSingleRecipePictures(recipe:Recipe) {
    let pictures = await Cloud.getSingleRecipeImages(this.settings, recipe)
    this.context.commit('setRecipePictures', {uuid:recipe.recipe_uuid, pictures})
    this.context.dispatch('saveRecipePictures')
  }

  @Action
  setRecipePicture({uuid, picture}:{uuid:string, picture:File|null}) {
    this.context.commit('setRecipePictures', {uuid, pictures:[picture]})
    this.context.dispatch('saveRecipePictures')
  }
}