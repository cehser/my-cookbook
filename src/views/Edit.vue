<template>
  <div id="edit">
    <Navbar @input="selected=$event" :recipes_list="recipes_list" :selected="selected" :read_only="settings.read_only">
      <li>
        <form class="form-inline">
          <b-button @click="saveRecipe"><b-icon-archive-fill></b-icon-archive-fill></b-button>
        </form>
      </li>
    </Navbar>
    <b-container> 
      <b-form-datalist id="ingredient-units-list" :options="ingredient_units"></b-form-datalist>
      <h2>Rezept</h2>

      <div>
        <b-row class="my-1">
          <b-col sm="2">
            <label for="input-name">Titel:</label>
          </b-col>
          <b-col sm="10">
            <b-form-input id="input-name" size="sm" placeholder="Namen eingeben" v-model="current_recipe.recipe_name"></b-form-input>
          </b-col>
        </b-row>
         <b-row class="my-1">
          <b-col sm="2">
            <label for="input-subtitle">Untertitel:</label>
          </b-col>
          <b-col sm="10">
            <b-form-input id="input-subtitle" size="sm" placeholder="Untertitel eingeben" v-model="current_recipe.subtitle"></b-form-input>
          </b-col>
        </b-row>
        <b-row class="my-1">
          <b-col sm="2">
            <label for="input-yields-value">Ergibt Menge:</label>
          </b-col>
          <b-col sm="10">
            <b-form-input id="input-yields-value" size="sm" type="number" min="0.001" step="0.001" placeholder="100.0" v-model.number="yields_value"></b-form-input>
            <div class="custom-control custom-switch">
              <input type="checkbox" class="custom-control-input" id="recalc-switch" v-model="do_recalc">
              <label class="custom-control-label" for="recalc-switch">Umrechnen</label>
            </div>
          </b-col>
        </b-row>
        <b-row class="my-1">
          <b-col sm="2">
            <label for="input-yields">Ergibt Einheiten:</label>
          </b-col>
          <b-col sm="10">
            <b-form-input id="input-yields" size="sm" placeholder="Enter a name" v-model="yields_unit"></b-form-input>
          </b-col>
        </b-row>
        <b-row class="my-1">
          <b-col sm="2">
            <label for="input-recalc_exp">Umrechnungsexponent:</label>
          </b-col>
          <b-col sm="10">
            <b-form-input id="input-recalc_exp" type="number" min="1" step="1" size="sm" placeholder="1" v-model.number="current_recipe.recalc_exp"></b-form-input>
          </b-col>
        </b-row>
        <b-row class="my-1">
          <b-col sm="2">
            <label for="input-name">Web-Foto:</label>
          </b-col>
          <b-col sm="10">
            <b-form-input id="input-name" size="sm" placeholder="https://..." v-model="current_recipe.imageurl"></b-form-input>
          </b-col>
        </b-row>
        <b-row class="my-1" v-if="recipe_pictures[current_recipe.recipe_uuid]">
          <b-col sm="2">
            <label for="input-name">Gespeichertes Foto:</label>
          </b-col>
          <b-col sm="10">
            <img :src="picture_src" height="100">
            <div class="custom-control custom-switch">
              <input type="checkbox" class="custom-control-input" id="delete_image-switch" v-model="delete_image">
              <label class="custom-control-label" for="delete_image-switch">Löschen</label>
            </div>
          </b-col>
        </b-row>
        <b-row class="my-1">
          <b-col sm="2">
            <label for="input-foto">Foto-Upload:</label>
          </b-col>
          <b-col sm="10">
            <b-input-group size="sm">
              <b-input-group-prepend>
                <b-button size="sm" @click="clearFile"><b-icon-x></b-icon-x></b-button>
              </b-input-group-prepend>
            
              <b-form-file size="sm" id="input-foto" ref="input-foto" accept="image/*" placeholder="Datei auswählen oder ablegen" drop-placeholder="Hier ablegen" browse-text="Durchsuchen" v-model="file"></b-form-file>
            </b-input-group>
          </b-col>
        </b-row>
        <b-row>
          <b-col sm="2">
            Upload-Vorschau
          </b-col>
          <b-col sm="10">
            <img id="image-preview" height="100">
          </b-col>
        </b-row> 
      </div>
      
        <h2>Abschnitte <b-button @click="current_recipe.sections.push({section:''})"><b-icon icon="plus"></b-icon></b-button></h2>
        <div>
          <b-form-row v-for="(section, index_s) in current_recipe.sections" :key="index_s">
            <b-col cols="11"><b-form-input size="sm" placeholder="Neuer Abschnitt" v-model="section.section"></b-form-input></b-col>
            <b-col cols="1">
              <b-button @click="current_recipe.sections.splice(index_s, 1)" size="sm"><b-icon icon="trash"></b-icon></b-button>
              <array-reorder-btn-group :array="current_recipe.sections" :index="index_s"></array-reorder-btn-group>
            </b-col>
          </b-form-row>
        </div> 

      <h2>Zutaten <b-button @click="addIngredient"><b-icon icon="plus"></b-icon></b-button></h2>
      <div v-for="(section, index) in current_recipe.sections" :key="'sectiona-'+index">
        <section-ingredients-edit :section="section.section" :sections="section_names" v-model="current_recipe.ingredients"></section-ingredients-edit>
      </div>

      <h2>Zubereitung <b-button @click="current_recipe.steps.push({step:'', section:''})"><b-icon icon="plus"></b-icon></b-button></h2>
      <div v-for="(section, index) in current_recipe.sections" :key="'sectionb-'+index">
        <h3>{{ section.section }}</h3>
        <div v-for="(step, stepindex) in current_recipe.steps" :key="stepindex" >
          <step-edit v-model="current_recipe.steps[stepindex]" :steps="current_recipe.steps" :sections="section_names" :index="stepindex" v-if="step.section == section.section" @delete="current_recipe.steps.splice(stepindex, 1)"></step-edit>
        </div>  
      </div>
    
      <h2>Code</h2>
      <b-form-row>
        <b-form-textarea readonly rows="10" :value="yaml" class="mb-3"></b-form-textarea>
      </b-form-row>
    </b-container>
  </div>

</template>

<script lang="ts">
// @ is an alias to /src
import StepEdit from '@/components/StepEdit.vue'
import SectionIngredientsEdit from '@/components/SectionIngredientsEdit.vue'
import ArrayReorderBtnGroup from '@/components/ArrayReorderBtnGroup.vue'
import Navbar from '@/components/Navbar.vue'

import RecipeHelper from '@/mixins/RecipeHelper'
import Toast from '@/mixins/Toast'

import jsyaml from 'js-yaml'

import { Component, Mixins, Watch } from 'vue-property-decorator/'
import { namespace } from 'vuex-class'

// eslint-disable-next-line no-unused-vars
import SettingsType from '@/types/settings'
// eslint-disable-next-line no-unused-vars
import { Recipe } from '@/types/recipe'

import _ from 'lodash'

const VuexSettings = namespace('Settings')
const VuexRecipes = namespace('Recipes')

@Component({
  components: {
    StepEdit,
    SectionIngredientsEdit,
    ArrayReorderBtnGroup,
    Navbar
  },
})
export default class Edit extends Mixins(RecipeHelper,Toast) {
  public file:(File|null) = null
  public do_recalc:boolean = false
  public delete_image:boolean = false

  @VuexSettings.State settings!:SettingsType

  @VuexRecipes.Action setRecipePicture!: ({uuid, picture}:{ uuid: string, picture: File | null}) => Promise<void>
  @VuexRecipes.Action setRecipe!: ({index, recipe}:{ index: number, recipe: Recipe }) => Promise<void>


  get yaml() {
    return jsyaml.dump(this.current_recipe)
  }

  get ingredient_units() {
    let units = new Set(['g', 'ml', 'Stück']);

    let dyn_units = this.recipes.reduce((retVal:Set<string>, recipe) => {
      let arr:Set<string> = _.reduce(recipe.ingredients, (retVal:Set<string>, ingredient) => {
        let ing:any = (Object.entries(ingredient)[0][1])
        
        return retVal.add(ing.amounts[0].unit)
      },new Set([]))

      return new Set([...retVal, ...arr])
    }, new Set([]))

    console.log(dyn_units);
    
    units = new Set([...units, ...dyn_units])
    return [...units].sort(); //convert to array
  }

  mounted() {  
    document.onkeydown = (event) => {
      //ctrl + s
      if(event.ctrlKey && event.code === "KeyS") { 
        event.preventDefault(); //do not show browser dialog
        this.saveRecipe();
      }
    }
  }

  @Watch('file')
  preview_image(file:File) {
    let preview = document.querySelector('#image-preview') as HTMLImageElement
    if(file) {
        preview.src = URL.createObjectURL(file)
    }
    else {
      preview.src = ""
    }
  }

  clearFile() {
    let elem = this.$refs['input-foto'] as HTMLFormElement
    elem.reset()
  }
  
  saveRecipe() {
    //only update if current_recipe is really different
    console.log(this.file)
    if(this.recipes && !_.isEqual(this.recipes[this.selected], this.current_recipe) || this.file || this.delete_image) {
      this.current_recipe.lastUpdated = new Date();
      console.log(this.current_recipe.lastUpdated)
  
      if(this.file) {
        this.current_recipe.cloud_images = [this.file.name]
        this.setRecipePicture({ uuid: this.current_recipe.recipe_uuid, picture: this.file })
          .catch(() => this.toast('Bildfehler.', 'danger'))
      }

      if(this.delete_image) {
        this.current_recipe.cloud_images = []
        this.setRecipePicture({ uuid: this.current_recipe.recipe_uuid, picture: null })
          .then(() => this.delete_image = false)
          .catch(() => this.toast('Bildfehler.', 'danger'))
      }
      console.log(this.current_recipe.cloud_images)
      this.setRecipe({ index: this.selected, recipe: this.current_recipe })
        .then(() => this.toast('Gespeichert.', 'success'))
        .catch(() => this.toast('Fehler.', 'danger'))
    }
    else {
      this.toast('Unverändert.', 'success');
    }
  }
  updateCurrentRecipe() {
    if(this.recipes) {
      let replace_recipe = this.recipes[this.selected]
      if(replace_recipe) {
          document.title = "Kochbuch: " + replace_recipe.recipe_name;  
          this.current_recipe = _.cloneDeep(replace_recipe);
      }
    }
  }
  addIngredient() {
    this.current_recipe.ingredients.push({'Neue Zutat':{amounts:[{amount: null,unit:''}]},section:""});
  }

}
</script>
