<template>
  <div id="administration">
    <Navbar @input="selected=$event" :recipes_list="recipes_list" :selected="selected" :read_only="settings.read_only">
    </Navbar>
    <b-container>
        <h2>Verwaltung</h2>
        <div class="d-flex flex-wrap">
          <b-button v-if="!settings.read_only" class="btn m-2" @click="syncWithWebDAV"><b-icon-arrow-repeat></b-icon-arrow-repeat><br/>Cloud-Abgleich</b-button>
          <b-button class="btn m-2" @click="loadFromWebDAV"><b-icon-cloud-download></b-icon-cloud-download><br/>Cloud-Download</b-button>
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

        <b-button class="btn" @click="saveToLocalStorage"><b-icon-archive-fill></b-icon-archive-fill> Speichern</b-button>
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
        this.webdavclient.putFileContents(this.webdav.filepath, jsyaml.dump(this.recipes))
          .then(() => this.toast('Gespeichert.', 'success')).catch(() => this.toast('Fehlgeschlagen.', 'danger'));
      },
      loadFromWebDAV: async function() {
        this.$store.dispatch('getRecipesFromCloud')
          .then(() => this.toast('Geladen.', 'success'))
          .catch(() => this.toast('Fehler.', 'danger'))
      },
      syncWithWebDAV: async function() {
        this.$store.dispatch('syncRecipesWithCloud')
          .then(() => this.toast('Synchronisiert.', 'success'))
          .catch(() => this.toast('Fehler.', 'danger'))
      },
      saveToLocalStorage: function () {
        this.$store.dispatch('saveRecipes')
          .then(() => this.toast('Gespeichert.', 'success'))
      },
    }
  }
</script>
