<template>
  <div id="edit">
    <Navbar @input="selected=$event" :recipes_list="recipes_list" :selected="selected" :read_only="read_only">
      <li>
        <form class="form-inline">
          <b-button @click="saveToLocalStorage"><b-icon-archive-fill></b-icon-archive-fill></b-button>
        </form>
      </li>
    </Navbar>
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
    </b-container>
  </div>

</template>

<script>
// @ is an alias to /src
import StepEdit from '@/components/StepEdit.vue'
import SectionIngredientsEdit from '@/components/SectionIngredientsEdit.vue'
import ArrayReorderBtnGroup from '@/components/ArrayReorderBtnGroup.vue'
import Navbar from '@/components/Navbar.vue'

import RecipeHelper from '@/mixins/RecipeHelper'
import Settings from '@/mixins/Settings'
import Toast from '@/mixins/Toast'

import jsyaml from 'js-yaml'
import { createClient } from "webdav/web";


const jp = require('jsonpath')
const deepEqual = require('deep-equal')
const QRCode = require('qrcode')

//qr code scanning
import QrScanner from 'qr-scanner';
import QrScannerWorkerPath from '!!file-loader!../../node_modules/qr-scanner/qr-scanner-worker.min.js';
QrScanner.WORKER_PATH = QrScannerWorkerPath;

export default {
  name: 'Edit',
  mixins: [RecipeHelper,Settings,Toast],
  components: {
    StepEdit,
    SectionIngredientsEdit,
    ArrayReorderBtnGroup,
    Navbar
  },
  data() {
    return {
      file:null,     //used for file upload
      do_recalc: false,  //replace default value

      webdav: {
        webdav_creds: {
          username: "user",
          password: "pass"
        },
        webdav_url: "https://webdav.server",
        filepath: "/cookbook.yaml"
      }
    };
  },
  created() {
    if (localStorage.getItem('webdav')) {
      this.webdav  = JSON.parse(localStorage.getItem('webdav'));
      this.webdavclient = createClient(this.webdav.webdav_url, this.webdav.webdav_creds)
    } 
  },
  mounted() {  
    document.onkeydown = (event) => {
      //ctrl + s
      if(event.ctrlKey && event.which === 83){ 
        event.preventDefault(); //do not show browser dialog
         this.saveToLocalStorage();
      }
    }
    let canvas = document.getElementById('qrcode_config')
    QRCode.toCanvas(canvas, JSON.stringify(this.webdav), function (error) {
      if (error) console.error(error)
      console.log('success!');
    });

    let videoElem = document.getElementById('qrcode_scan_video')
    this.qrScanner = new QrScanner(videoElem, result => { 
      try {
        let webdav_qr = JSON.parse(result); 
        this.webdav.webdav_url = webdav_qr.webdav_url;
        this.webdav.filepath   = webdav_qr.filepath;
        this.webdav.webdav_creds.username = webdav_qr.webdav_creds.username;
        this.webdav.webdav_creds.password = webdav_qr.webdav_creds.password;
        this.qrScanner.stop();
      }
      catch(e) {
        console.log(e);
        this.qrScanner.stop();
      } 
    });

  },
  watch: {
    webdav :{
      deep: true,
      //update qr code
      handler() {
        let canvas = document.getElementById('qrcode_config')
        QRCode.toCanvas(canvas, JSON.stringify(this.webdav), (error) => { if (error) console.error(error) });
      }
    }
  },
  computed: {
    yaml: function () {
        return jsyaml.dump(this.current_recipe)
    },
    ingredient_units:  function () {
      let units = new Set(['g', 'ml', 'Stück']);
      let dyn_units = jp.query(this, 'recipes[*].ingredients[*].*.amounts[*].unit');
      //console.log(dyn_units);
      
      if(dyn_units) {
        dyn_units.forEach(item => units.add(item))
      }
        return [...units].sort(); //convert to array
    }
  },
  methods: {
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
    saveToLocalStorage: function () {
      //only update if current_recipe is really different
      if(!deepEqual(this.recipes[this.selected], this.current_recipe)) {
        this.current_recipe.lastUpdated = new Date();
        this.recipes[this.selected] = this.deepCopyYaml(this.current_recipe)
      }

      localStorage.setItem('recipes', jsyaml.dump(this.recipes));
      this.toast('Gespeichert.', 'success');
    },
    newRecipe: function() {
      this.loadYamlRecipe(this.new_recipe_de);
    },
    saveWebDAVConfig: function () {
      localStorage.setItem('webdav', JSON.stringify(this.webdav));
      this.webdavclient = createClient(this.webdav.webdav_url, this.webdav.webdav_creds);
    },
    updateCurrentRecipe: function() {
      let replace_recipe = this.recipes[this.selected]
      if(replace_recipe) {
         document.title = "Kochbuch: " + replace_recipe.recipe_name;  
         this.current_recipe = this.deepCopyYaml(replace_recipe);
      }
    },
    addIngredient: function() {
      this.current_recipe.ingredients.push({'Neue Zutat':{amounts:[{amount: null,unit:''}]},section:""});
    },
    scanQRConfig: function() {
      this.qrScanner.start();
      setTimeout(() => this.qrScanner.stop(), 10000);
    }
  }
}
</script>
