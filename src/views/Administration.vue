<template>
  <div id="administration">
    <Navbar @input="selected=$event" :recipes_list="recipes_list" :selected="selected" :read_only="settings.read_only">
    </Navbar>
    <b-container>
        <h2>Verwaltung</h2>
        <div class="d-flex flex-wrap">
          <b-button v-if="!settings.read_only" class="btn m-2" @click="syncWithWebDAV"><b-icon-arrow-repeat></b-icon-arrow-repeat><br/>Cloud-Abgleich</b-button>
          <b-button class="btn m-2" @click="loadFromWebDAV"><b-icon-cloud-download></b-icon-cloud-download><br/>Cloud-Download</b-button>
          <b-button class="btn m-2" @click="loadPictures"><b-icon-cloud-download></b-icon-cloud-download><br/>Bilder-Download</b-button>
          <b-button v-if="!settings.read_only" class="btn m-2" @click="saveToWebDAV"><b-icon-cloud-upload></b-icon-cloud-upload><br/>Cloud-Upload</b-button>
        </div>

        <div class="d-flex flex-wrap">
          <b-button v-if="!settings.read_only" class="btn m-2" @click="newRecipe"><b-icon-file-earmark-plus></b-icon-file-earmark-plus><br/>Neues Rezept</b-button>
          <b-button v-if="!settings.read_only" class="btn m-2" @click="loadSample"><b-icon-file-earmark-text></b-icon-file-earmark-text><br/>Beispielrezept</b-button> 
        </div>

        <b-list-group flush v-for="(recipe, index) in recipes" :key="index">
          <b-list-group-item>{{ recipe.recipe_name }}
            <b-button v-if="!settings.read_only" class="btn-sm" @click="deleteRecipe(index)"><b-icon-x></b-icon-x></b-button>
            <b-button v-if="!settings.read_only" class="btn-sm" @click="copyRecipe(index)"><b-icon-files></b-icon-files></b-button>
          </b-list-group-item>
        </b-list-group>

        <b-button class="btn mb-4" @click="saveToLocalStorage"><b-icon-archive-fill></b-icon-archive-fill> Speichern</b-button>
    </b-container>
  </div>
</template>
  
<script lang="ts">
  import Navbar from '@/components/Navbar.vue'
  import RecipeHelper from '@/mixins/RecipeHelper'
  import Toast from '@/mixins/Toast'
  import UUID from '../js/uuid'
  import DeepCopy from '../js/deepCopy'
  import Recipes from '../js/recipes'
  import Cloud from '../js/cloud'
  
  import $ from 'jquery'
  import { Component, Mixins } from 'vue-property-decorator'
  import { namespace } from 'vuex-class'

  // eslint-disable-next-line no-unused-vars
  import SettingsType from '@/types/settings'
  const VuexSettings = namespace('Settings')

  @Component({
    components: {
      Navbar
    },
  })
  export default class Administration extends Mixins(RecipeHelper,Toast)  {
    @VuexSettings.State settings!:SettingsType

    mounted() {  
      document.onkeydown = (event) => {
        //ctrl + s
        if(event.ctrlKey && event.code === "KeyS"){ 
          event.preventDefault(); //do not show browser dialog
          this.saveToLocalStorage();
        }
      }
    }
    
    deleteRecipe(index:number) {
      this.$store.dispatch("Recipes/deleteRecipe", index);
    }
    copyRecipe(index:number) {
      //deep copy recipe
      let recipe = DeepCopy.deepCopyYaml(this.recipes ? this.recipes[index] : null);
      //new uuid
      recipe.recipe_uuid = UUID.generateUUID();
      //load
      this.$store.dispatch("Recipes/appendRecipe", recipe);
    }
    newRecipe() {
      this.$store.dispatch("Recipes/appendRecipe", Recipes.loadNewRecipe())
    }
    loadSample() {
      this.$store.dispatch("Recipes/appendRecipe", Recipes.loadSample())
    }
    saveToWebDAV() {
      $("#loading-spinner").removeClass('d-none');
      if(this.recipes) {
        Cloud.putRecipes(this.settings, this.recipes, this.recipe_pictures)
          .then(() => this.toast('Gespeichert.', 'success'))
          .catch(() => this.toast('Fehlgeschlagen.', 'danger'))
          .finally(() => $("#loading-spinner").addClass('d-none'))
      }
    }
    async loadFromWebDAV() {
      $("#loading-spinner").removeClass('d-none');
      this.$store.dispatch('Recipes/getRecipesFromCloud')
        .then(() => this.toast('Geladen.', 'success'))
        .catch(() => this.toast('Fehler.', 'danger'))
        .finally(() => $("#loading-spinner").addClass('d-none'))
    }
    async loadPictures() {
      $("#loading-spinner").removeClass('d-none');
      this.$store.dispatch('Recipes/downloadRecipePictures')
        .then(() => this.toast('Geladen.', 'success'))
        .catch(() => this.toast('Fehler.', 'danger'))
        .finally(() => $("#loading-spinner").addClass('d-none'))
    }
    async syncWithWebDAV() {
      $("#loading-spinner").removeClass('d-none');
      this.$store.dispatch('Recipes/syncRecipesWithCloud')
        .then(() => this.toast('Synchronisiert.', 'success'))
        .catch(() => this.toast('Fehler.', 'danger'))
        .finally(() => $("#loading-spinner").addClass('d-none'))
    }
    saveToLocalStorage() {
      this.$store.dispatch('Recipes/saveRecipes')
      this.$store.dispatch('Recipes/saveRecipePictures')
        .then(() => this.toast('Gespeichert.', 'success'))
    }
  }
</script>
