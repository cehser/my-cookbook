<template>
  <div id="administration">
    <Navbar @input="selected=$event" :recipes_list="recipes_list" :selected="selected" :read_only="read_only">
    </Navbar>
    <b-container>
        <h2>Verwaltung</h2>
        <div class="d-flex flex-wrap">
          <b-button v-if="!read_only" class="btn m-2" @click="syncWithWebDAV"><b-icon-arrow-repeat></b-icon-arrow-repeat><br/>Cloud-Abgleich</b-button>
          <b-button class="btn m-2" @click="loadFromWebDAV"><b-icon-cloud-download></b-icon-cloud-download><br/>Cloud-Download</b-button>
          <b-button v-if="!read_only" class="btn m-2" @click="saveToWebDAV"><b-icon-cloud-upload></b-icon-cloud-upload><br/>Cloud-Upload</b-button>
        </div>

        <div class="d-flex flex-wrap">
          <b-button v-if="!read_only" class="btn m-2" @click="newRecipe"><b-icon-file-earmark-plus></b-icon-file-earmark-plus><br/>Neues Rezept</b-button>
          <b-button v-if="!read_only" class="btn m-2" @click="loadSample"><b-icon-file-earmark-text></b-icon-file-earmark-text><br/>Beispielrezept</b-button> 
        </div>

        <b-list-group flush v-for="(recipe, index) in recipes" :key="index">
          <b-list-group-item>{{ recipe.recipe_name }}
            <b-button v-if="!read_only" class="btn-sm" @click="deleteRecipe(index)"><b-icon-x></b-icon-x></b-button>
            <b-button v-if="!read_only" class="btn-sm" @click="copyRecipe(index)"><b-icon-files></b-icon-files></b-button>
          </b-list-group-item>
        </b-list-group>

        <b-button class="btn" @click="saveToLocalStorage"><b-icon-archive-fill></b-icon-archive-fill> Speichern</b-button>
    </b-container>
  </div>
</template>
  
<script>
  import Navbar from '@/components/Navbar.vue'

  import RecipeHelper from '@/mixins/RecipeHelper'
  import Settings from '@/mixins/Settings'
  import Toast from '@/mixins/Toast'

  import jsyaml from 'js-yaml'

  const deepEqual = require('deep-equal')

  export default {
    name: 'Administration',
    mixins: [RecipeHelper, Settings, Toast],
    components: {
      Navbar
    },
    methods: {
      deleteRecipe: function(index) {
        this.recipes.splice(index, 1);
      },
      copyRecipe: function (index) {
        //deep copy recipe
        let recipe = this.deepCopyYaml(this.recipes[index]);
        //new uuid
        recipe.recipe_uuid = this.generateUUID();
        //load
        this.appendRecipe(recipe);
      },
      newRecipe: function() {
        this.loadYamlRecipe(this.new_recipe_de);
      },
      saveToWebDAV: function() {
        this.webdavclient.putFileContents(this.webdav.filepath, jsyaml.dump(this.recipes))
          .then(() => this.toast('Gespeichert.', 'success')).catch(() => this.toast('Fehlgeschlagen.', 'danger'));
      },
      loadFromWebDAV: async function() {
        let data = await this.webdavclient.getFileContents(this.webdav.filepath, { format: "text" });
        this.loadYamlFull(data);
        this.toast('Geladen.', 'success');
      },
      syncWithWebDAV: async function() {
        let data = await this.webdavclient.getFileContents(this.webdav.filepath, { format: "text" });
        let recipes_remote = jsyaml.load(data);
        this.recipes = this.mergeCoobooks(this.recipes, recipes_remote);
        this.toast('Synchronisiert.', 'success');
      },
      saveToLocalStorage: function () {
        //only update if current_recipe is really different
        if(!deepEqual(this.recipes[this.selected], this.current_recipe)) {
          this.current_recipe.lastUpdated = new Date();
          this.recipes[this.selected] = this.deepCopyYaml(this.current_recipe)
        }

        localStorage.setItem('recipes', jsyaml.dump(this.recipes));
        this.toast('Gespeichert.', 'success');
      },
    }
  }
</script>
