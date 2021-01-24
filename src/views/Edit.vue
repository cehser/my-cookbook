<template>
  <div id="edit">
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark sticky-top">
      <a class="navbar-brand" href="#">Kochbuch</a>
      <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#mainmenu" aria-controls="mainmenu" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
      </button>
      <div id="mainmenu" class="collapse navbar-collapse">
          <ul class="navbar-nav">
              <li class="nav-item">
                  <router-link class="nav-link" to="/">Home</router-link>
              </li>
              <li class="nav-item active">
                  <router-link class="nav-link" to="/edit">Bearbeiten</router-link>
              </li>
              <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="#" role="button" id="dropdownMenuButton" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                  Organisation
                </a>
                <div class="dropdown-menu" aria-labelledby="dropdownMenuButton">
                  <a class="dropdown-item" href="#" @click="saveToLocalStorage"><b-icon-archive-fill></b-icon-archive-fill> Speichern</a>

                  <div class="dropdown-divider"></div>
                  <a class="dropdown-item" href="#" @click="newRecipe"><b-icon-file-earmark-plus></b-icon-file-earmark-plus> Neues Rezept</a>
                  <a class="dropdown-item" href="#" @click="copyRecipe"><b-icon-files></b-icon-files> Rezept kopieren</a>
                  <a class="dropdown-item" href="#" @click="deleteSelected"><b-icon-trash></b-icon-trash> Rezept löschen</a>
                  <a class="dropdown-item" href="#" @click="loadSample"><b-icon-file-earmark-text></b-icon-file-earmark-text> Beispielrezept</a>
                  <div class="dropdown-divider"></div>
                  <a class="dropdown-item" href="#" @click="saveRecipeAsFile"><b-icon-file-earmark-arrow-down></b-icon-file-earmark-arrow-down> Rezept exportieren</a>
                  <a class="dropdown-item" href="#" @click="fileUploadButton.click()"><b-icon-file-earmark-arrow-up></b-icon-file-earmark-arrow-up> Rezept importieren</a>
                  
                  <div class="dropdown-divider"></div>
                  <a class="dropdown-item" href="#" @click="saveToWebDAV"><b-icon-cloud-upload></b-icon-cloud-upload> Cloud-Upload</a>
                  <a class="dropdown-item" href="#" @click="loadFromWebDAV"><b-icon-cloud-download></b-icon-cloud-download> Cloud-Download</a>
                  <a class="dropdown-item" href="#" @click="syncWithWebDAV"><b-icon-arrow-repeat></b-icon-arrow-repeat> Cloud-Abgleich</a>

                  <div class="dropdown-divider"></div>
                  <a class="dropdown-item" href="#" @click="saveCookbookAsFile"><b-icon-journal-arrow-down></b-icon-journal-arrow-down> Kochbuch exportieren</a>
                  <a class="dropdown-item" href="#" @click="fileUploadButton.click()"><b-icon-journal-arrow-up></b-icon-journal-arrow-up> Kochbuch importieren</a>
                 </div>
                </li>
          </ul>
          <form class="form-inline">
              <b-button data-toggle="modal" data-target="#settings"><b-icon-gear></b-icon-gear></b-button>
          
              <b-form-select class="form-control mr-sm-2" v-model.number="selected" :options="recipes_list"></b-form-select>
          
              <b-button @click="saveToLocalStorage"><b-icon-archive-fill></b-icon-archive-fill></b-button>
          </form>      
      </div>
    </nav>
    <b-container> 
      <b-form-datalist id="ingredient-units-list" :options="ingredient_units"></b-form-datalist>
      <h2>Rezept</h2>

      <b-container fluid>
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
            <label for="input-name">Untertitel:</label>
          </b-col>
          <b-col sm="10">
            <b-form-input id="input-name" size="sm" placeholder="Untertitel eingeben" v-model="current_recipe.subtitle"></b-form-input>
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
            <label for="input-name">Abbildung:</label>
          </b-col>
          <b-col sm="10">
            <b-form-input id="input-name" size="sm" placeholder="Enter a name" v-model="current_recipe.imageurl"></b-form-input>
          </b-col>
        </b-row>
      </b-container>
      <b-container fluid>
        <h2>Abschnitte</h2>
        <div>
          <b-form-row v-for="(section, index_s) in current_recipe.sections" :key="index_s">
            <b-col cols="11"><b-form-input size="sm" placeholder="Neuer Abschnitt" v-model="section.section"></b-form-input></b-col>
            <b-col cols="1">
              <b-button @click="current_recipe.sections.splice(index_s, 1)" size="sm"><b-icon icon="trash"></b-icon></b-button>
              <array-reorder-btn-group :array="current_recipe.sections" :index="index_s"></array-reorder-btn-group>
            </b-col>
          </b-form-row>
        </div> 
        <b-form-row>
          <b-button @click="current_recipe.sections.push({section:''})"><b-icon icon="plus"></b-icon></b-button>
        </b-form-row> 
      </b-container>
      <h2>Zutaten</h2>
      <div v-for="(section, index) in current_recipe.sections" :key="'sectiona-'+index">
        <section-ingredients-edit :section="section.section" :sections="section_names" v-model="current_recipe.ingredients"></section-ingredients-edit>
      </div>
      <b-form-row>
        <b-button @click="addIngredient"><b-icon icon="plus"></b-icon></b-button>
      </b-form-row>
      <h2>Zubereitung</h2>
      <div v-for="(section, index) in current_recipe.sections" :key="'sectionb-'+index">
        <h3>{{ section.section }}</h3>
        <div v-for="(step, stepindex) in current_recipe.steps" :key="stepindex" >
          <step-edit v-model="current_recipe.steps[stepindex]" :steps="current_recipe.steps" :sections="section_names" :index="stepindex" v-if="step.section == section.section" @delete="current_recipe.steps.splice(stepindex, 1)"></step-edit>
        </div>  
      </div>
      
      <b-form-row>
        <b-button @click="current_recipe.steps.push({step:'', section:''})"><b-icon icon="plus"></b-icon></b-button>
      </b-form-row>
      <h2>Code</h2>
      <b-form-row>
        <b-form-textarea readonly rows="10" :value="yaml"></b-form-textarea>
      </b-form-row>
      
      <b-collapse id="collapse-file-upload">
        <b-form-file hidden="hidden" id="fileUploadButton" @change="loadFromFile" v-model="file" placeholder="Choose a file or drop it here..." drop-placeholder="Drop file here..." accept=".yaml"></b-form-file>
      </b-collapse>

      <div class="modal fade" id="settings" tabindex="-1" role="dialog" aria-labelledby="exampleModalLabel" aria-hidden="true">
        <div class="modal-dialog" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="exampleModalLabel">Cloud-Konfiguration (WebDAV)</h5>
              <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div class="modal-body">
              <form>
                <div class="form-group">
                  <label for="webdav_url" class="col-form-label">URL</label>
                  <input type="text" class="form-control" id="webdav_url" v-model="webdav.webdav_url" autocorrect="off">
                </div>
                <div class="form-group">
                  <label for="webdav_username" class="col-form-label">User</label>
                  <input type="text" class="form-control" id="webdav_username" v-model="webdav.webdav_creds.username" autocorrect="off"> 
                </div>
                <div class="form-group">
                  <label for="webdav_password" class="col-form-label">Passwort</label>
                  <input type="text" class="form-control" id="webdav_password" v-model="webdav.webdav_creds.password" autocorrect="off">
                </div>
                <div class="form-group">
                  <label for="webdav_filepath" class="col-form-label">Pfad</label>
                  <input type="text" class="form-control" id="webdav_filepath" v-model="webdav.filepath" autocorrect="off">
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
              <button type="button" class="btn btn-primary" data-dismiss="modal" @click="saveWebDAVConfig">Save changes</button>
            </div>
          </div>
        </div>
      </div>
    </b-container>
  </div>

</template>

<script>
// @ is an alias to /src
import StepEdit from '@/components/StepEdit.vue'
import SectionIngredientsEdit from '@/components/SectionIngredientsEdit.vue'
import ArrayReorderBtnGroup from '@/components/ArrayReorderBtnGroup.vue'

import helper from '../mixins/helper'
import $ from 'jquery'
import jsyaml from 'js-yaml'
const jp = require('jsonpath')
import { createClient } from "webdav/web";

export default {
  name: 'Edit',
  mixins: [helper],
  components: {
    StepEdit,
    SectionIngredientsEdit,
    ArrayReorderBtnGroup
  },
  data() {
    return {
        recipes: [{}],
        file:null,     //used for file upload
        selected: 0,
        current_recipe: null,
        do_recalc: true, //enable amounts recalculation
        
        webdav: {
          webdav_creds: {
            username: "user",
            password: "pass"
          }
        },
        webdav_url: "https://webdav.server",
        filepath: "/cookbook.yaml"
      }
    },
    created() {
      if (localStorage.getItem('recipes')) {
        try {
          this.loadYamlFull(localStorage.getItem('recipes'));
        } catch(e) {
          localStorage.removeItem('recipes');
          this.loadSample();
        }
      }
      else  {
        this.loadSample();
      }
      if (localStorage.getItem('selected')) {
        this.selected  = Math.min(localStorage.getItem('selected'), this.recipes.length - 1);
      } 

      if (localStorage.getItem('webdav')) {
        this.webdav  = JSON.parse(localStorage.getItem('webdav'));
      } 

      this.recipes[this.selected].sections = this.recipes[this.selected].sections || [];

      this.current_recipe = this.deepCopyYaml(this.recipes[this.selected]);
  },
  mounted() {
    //do login
    document.onreadystatechange = () => { 
        if (document.readyState == "complete") { 
            this.webdavclient = createClient(this.webdav.webdav_url, this.webdav.webdav_creds);
        } 
    }
    
    document.onkeydown = (event) => {
      //ctrl + s
      if(event.ctrlKey && event.which === 83){ 
        event.preventDefault(); //do not show browser dialog
         this.saveToLocalStorage();
      }
    }
      
  },

  computed: {
    yaml: function () {
        return jsyaml.dump(this.current_recipe)
    },
    ingredient_units:  function () {
      var units = new Set(['g', 'ml', 'each']);
      var dyn_units = jp.query(this.current_recipe, 'ingredients[*].*.amounts[*].unit');
      //console.log(dyn_units);
      
      if(dyn_units) {
        dyn_units.forEach(item => units.add(item))
      }
        return [...units].sort(); //convert to array
    },
    recipes_list: function() {
      //return this.recipes.map((val,idx) => {value: idx, text: val.recipe_name});
      return this.recipes.map((val,idx) => ({value: idx, text: val.recipe_name}));
    },
    yields_unit: { 
      get() {
      if(!!this.current_recipe && !!(this.current_recipe.yields)) {
        return Object.keys(this.current_recipe.yields[0])[0];          
        } else {
          return 'Units'
        }
      }, set(newUnit) {
        if(!!this.current_recipe && !!(this.current_recipe.yields)) {
          var oldUnit = Object.keys(this.current_recipe.yields[0])[0];
          var value = this.yields_value;
          delete this.current_recipe.yields[0][oldUnit];
          this.current_recipe.yields[0][newUnit] = value;
        } 
      } 
    }, 
    yields_value: {
      get() {
        if(!!this.current_recipe && !!(this.current_recipe.yields)) {
        return this.current_recipe.yields[0][this.yields_unit];
        } else {
          return 1;
        }
      },
      set(val) {
      if(!!this.current_recipe && !!(this.current_recipe.yields) && val > 0) {
        var oldVal = this.current_recipe.yields[0][this.yields_unit];

        this.current_recipe.yields[0][this.yields_unit] = val;
        
        if(this.do_recalc) {
          this.calcNewAmounts(oldVal); 
        }
        }
      }
    },
    section_names: function() {
      return this.current_recipe.sections.map( x =>  x.section );
    }
  },

  filters : {
    formatNumbers: function(value) {
      if (typeof value !== "number") {
            return value;
        }
      return Number(value).toLocaleString('de-DE', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
      });
    }
  },

  watch: {
    selected: function (val) {
       localStorage.setItem('selected', val);
       if(this.recipes[val]) {
         document.title = "Kochbuch: " + this.recipes[val].recipe_name;  
         this.current_recipe = this.deepCopyYaml(this.recipes[val]);
       }
    }
  },

  methods: {
    saveRecipeAsFile: function () {
      var fileNameToSaveAs = "recipe.yaml"
      var textFileAsBlob = new Blob([jsyaml.dump(this.current_recipe)], {type:'text/plain'}); 
      var downloadLink = document.createElement("a");
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
      var fileNameToSaveAs = "cookbook.yaml"
      var blob = new Blob([jsyaml.dump(this.recipes)], {type:'application/octet-stream'}); 
      var url = window.URL.createObjectURL(blob);
      window.URL = window.URL || window.webkitURL;
      

      window.location.href = url;

        if (navigator.userAgent.match(/iPad/i) || navigator.userAgent.match(/iPhone/i)) { //Safari & Opera iOS
          window.location.href = url;
      }
      else {
        var downloadLink = document.createElement("a");
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
      var that = this;

      reader.onload = function(e) {
        var content = jsyaml.load(e.target.result);
        var recipes=[];

        if(!Array.isArray(content)) {
          recipes = [content];
        }
        else {
          recipes = content;
        }

        recipes.forEach( function(recipe) {
          that.appendRecipe(recipe);
        });
      };
      //reader.onload = e => console.log(e.target.result);

      reader.readAsText(file);    
    },
    appendRecipe: function(recipe) {
      this.selected = this.recipes.push(recipe) - 1;
    },
    loadYamlRecipe: function (content) {
      var recipe = this.initRecipe(jsyaml.load(content));
      this.appendRecipe(recipe);
    },
    loadYamlCookbook: function(content) {
      var recipes = jsyaml.load(content);
      recipes.forEach( recipe => {this.initRecipe(recipe)});
      return recipes;
    },
    loadYamlFull: function (content) {
      this.recipes = this.loadYamlCookbook(content);
    },
    saveToLocalStorage: function () {
      this.current_recipe.lastUpdated = new Date();
      this.recipes[this.selected] = this.deepCopyYaml(this.current_recipe)
      localStorage.setItem('recipes', jsyaml.dump(this.recipes));
      this.toast('Gespeichert.', 'success');
    },
    loadSample: function (){
      this.loadYamlRecipe(this.sample_recipe);
    },
    newRecipe: function() {
      this.loadYamlRecipe(this.new_recipe_de);
    },
    copyRecipe: function () {
      //deep copy recipe
      var recipe = this.deepCopyYaml(this.current_recipe);
      //new uuid
      recipe.recipe_uuid = this.generateUUID();
      //load
      this.appendRecipe(recipe);
    },
    calcNewAmounts: function(oldYield) {
      var newYield = this.yields_value;
      var exp=1;
      if(this.current_recipe.recalc_exp) {
        exp=this.current_recipe.recalc_exp;
      }
    
      this.current_recipe.ingredients.forEach( function(ingredient) {
        var name = Object.keys(ingredient)[0];

        if (typeof ingredient[name].amounts[0].amount == "number") {            
          ingredient[name].amounts[0].amount = ingredient[name].amounts[0].amount * Math.pow(newYield,exp)/Math.pow(oldYield,exp);
        }  
      });
    },
    selectStep: function(ev) {
      var doHighlight=!$(ev.target).hasClass("list-group-item-primary");

      $('#steps .list-group-item').removeClass("list-group-item-primary");
      $(ev.target).toggleClass("list-group-item-primary", doHighlight);

      $('#ingredients .ingredients-section').removeClass("highlighted list-group-item-primary border-primary");
      $('#box-ing-'+ ev.target.dataset.section).toggleClass("highlighted list-group-item-primary border-primary", doHighlight);
    },
    deleteSelected: function() {
      this.recipes.splice(this.selected, 1);
      this.selected=Math.max(this.selected-1,0);
    },
    saveToWebDAV: function() {
      this.webdavclient.putFileContents(this.webdav.filepath, jsyaml.dump(this.recipes));
      this.toast('Gespeichert.', 'success');
    },
    loadFromWebDAV: async function() {
      var data = await this.webdavclient.getFileContents(this.webdav.filepath, { format: "text" });
      this.loadYamlFull(data);
      this.toast('Geladen.', 'success');
    },
    saveWebDAVConfig: function () {
      localStorage.setItem('webdav', JSON.stringify(this.webdav));
      this.webdavclient = window.WebDAV.createClient(this.webdav.webdav_url, this.webdav.webdav_creds);
    },
    syncWithWebDAV: async function() {
      var data = await this.webdavclient.getFileContents(this.webdav.filepath, { format: "text" });
      var recipes_remote = jsyaml.load(data);
      this.recipes = this.mergeCoobooks(this.recipes, recipes_remote);
      this.toast('Synchronisiert.', 'success');
    },
    addIngredient: function() {
      this.current_recipe.ingredients.push({'Neue Zutat':{amounts:[{amount: null,unit:''}]},section:""});
    },
    toast: function(content,variant)  {
      this.$bvToast.toast(content, {
          toaster: 'b-toaster-bottom-left',
         // solid: true,
          appendToast: true,
          noCloseButton: true,
          variant: variant
        });
    }
  }
}
</script>
