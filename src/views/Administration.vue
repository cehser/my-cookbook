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
  
<script>
  import { mapState } from 'vuex'
  
  import Navbar from '@/components/Navbar.vue'
  import RecipeHelper from '@/mixins/RecipeHelper'
  import Toast from '@/mixins/Toast'
  import UUID from '../js/uuid'
  import DeepCopy from '../js/deepCopy'
  import Recipes from '../js/recipes'
  import Cloud from '../js/cloud'
  
  import $ from 'jquery'
  import jsyaml from 'js-yaml'

  export default {
    name: 'Administration',
    mixins: [RecipeHelper, Toast],
    components: {
      Navbar
    },
    computed: {
      // mix the getters into computed with object spread operator
      ...mapState([
        'settings'
      ])
    },
    mounted() {  
      document.onkeydown = (event) => {
        //ctrl + s
        if(event.ctrlKey && event.code === "KeyS"){ 
          event.preventDefault(); //do not show browser dialog
          this.saveToLocalStorage();
        }
      }
    },
    methods: {
      deleteRecipe: function(index) {
        this.$store.dispatch("deleteRecipe", index);
      },
      copyRecipe: function (index) {
        //deep copy recipe
        let recipe = DeepCopy.deepCopyYaml(this.recipes[index]);
        //new uuid
        recipe.recipe_uuid = UUID.generateUUID();
        //load
        this.$store.dispatch("appendRecipe", recipe);
      },
      newRecipe: function() {
        this.$store.dispatch("appendRecipe", Recipes.loadNewRecipe())
      },
      loadSample: function() {
        this.$store.dispatch("appendRecipe", Recipes.loadSample())
      },
      saveToWebDAV: function() {
        $("#loading-spinner").removeClass('d-none');
        Cloud.putRecipes(this.settings, this.recipes, this.recipe_pictures)
          .then(() => this.toast('Gespeichert.', 'success'))
          .catch(() => this.toast('Fehlgeschlagen.', 'danger'))
          .finally(() => $("#loading-spinner").addClass('d-none'))
      },
      loadFromWebDAV: async function() {
        $("#loading-spinner").removeClass('d-none');
        this.$store.dispatch('getRecipesFromCloud')
          .then(() => this.toast('Geladen.', 'success'))
          .catch(() => this.toast('Fehler.', 'danger'))
          .finally(() => $("#loading-spinner").addClass('d-none'))
      },
      loadPictures: async function() {
        $("#loading-spinner").removeClass('d-none');
        this.$store.dispatch('downloadRecipePictures')
          .then(() => this.toast('Geladen.', 'success'))
          .catch(() => this.toast('Fehler.', 'danger'))
          .finally(() => $("#loading-spinner").addClass('d-none'))
      },
      syncWithWebDAV: async function() {
        $("#loading-spinner").removeClass('d-none');
        this.$store.dispatch('syncRecipesWithCloud')
          .then(() => this.toast('Synchronisiert.', 'success'))
          .catch(() => this.toast('Fehler.', 'danger'))
          .finally(() => $("#loading-spinner").addClass('d-none'))
      },
      saveToLocalStorage: function () {
        this.$store.dispatch('saveRecipes')
        this.$store.dispatch('saveRecipePictures')
          .then(() => this.toast('Gespeichert.', 'success'))
      },
      saveRecipeAsFile: function () {
        let fileNameToSaveAs = "recipe.yaml"
        let textFileAsBlob = new Blob([jsyaml.dump(this.current_recipe)], {type:'text/plain'}); 
        let downloadLink = document.createElement("a");
        downloadLink.download = fileNameToSaveAs;
        downloadLink.innerHTML = "Download File";
        if (window.webkitURL != null)
        {
          // Chrome allows the link to be clicked
          // without actually adding it to the DOM.
          downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
        }
        else
        {
          // Firefox requires the link to be added to the DOM
          // before it can be clicked.
          downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
          downloadLink.onclick = this.destroyClickedElement;
          downloadLink.style.display = "none";
          document.body.appendChild(downloadLink);
        }
      
        downloadLink.click();
      },
      saveCookbookAsFile: function () {
        let fileNameToSaveAs = "cookbook.yaml"
        let blob = new Blob([jsyaml.dump(this.recipes)], {type:'application/octet-stream'}); 
        let url = window.URL.createObjectURL(blob);
        window.URL = window.URL || window.webkitURL;
        

        window.location.href = url;

          if (navigator.userAgent.match(/iPad/i) || navigator.userAgent.match(/iPhone/i)) { //Safari & Opera iOS
            window.location.href = url;
        }
        else {
          let downloadLink = document.createElement("a");
          downloadLink.download = fileNameToSaveAs;
          downloadLink.innerHTML = "Download File";
          downloadLink.href = url;
          downloadLink.onclick = this.destroyClickedElement;
          downloadLink.style.display = "none";
          document.body.appendChild(downloadLink);
          downloadLink.click();  
        }     
      },
      loadFromFile: function (ev) {
        const file = ev.target.files[0];
        const reader = new FileReader();

        reader.onload = (e) => {
          let content = jsyaml.load(e.target.result);
          let recipes=[];

          if(!Array.isArray(content)) {
            recipes = [content];
          }
          else {
            recipes = content;
          }

          recipes.forEach( (recipe) => {
            this.appendRecipe(recipe);
          });
        };
        //reader.onload = e => console.log(e.target.result);

        reader.readAsText(file);    
      },
    }
  }
</script>
