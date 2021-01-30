<template>
  <div id="settings">
    <Navbar @input="selected=$event" :recipes_list="recipes_list" :selected="selected">
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
    </Navbar>
    <b-container> 
      <h2>Einstellungen</h2>
      
      <b-collapse id="collapse-file-upload">
        <b-form-file hidden="hidden" id="fileUploadButton" @change="loadFromFile" v-model="file" placeholder="Choose a file or drop it here..." drop-placeholder="Drop file here..." accept=".yaml"></b-form-file>
      </b-collapse>

      <div id="settings" tabindex="-1" role="dialog" aria-labelledby="exampleModalLabel" aria-hidden="true">
        <h5 id="exampleModalLabel">Cloud-Konfiguration (WebDAV)</h5>
        <div>
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
          
          <div class="d-flex flex-row">
            <canvas id="qrcode_config" width="100" height="100"></canvas>
            <video id="qrcode_scan_video" width="200"> </video>
          </div> 
          <button type="button" class="btn btn-secondary" @click="scanQRConfig">QR-Code scannen</button>
        </div>
        <div class="mt-2">
          <button type="button" class="btn btn-primary" data-dismiss="modal" @click="saveWebDAVConfig">Save changes</button>
        </div>
      </div>
    </b-container>
  </div>

</template>

<script>
// @ is an alias to /src
import Navbar from '@/components/Navbar.vue'

import RecipeHelper from '@/mixins/RecipeHelper'
import jsyaml from 'js-yaml'
import { createClient } from "webdav/web";
import $ from 'jquery'

const deepEqual = require('deep-equal')
const QRCode = require('qrcode')

//qr code scanning
import QrScanner from 'qr-scanner';
import QrScannerWorkerPath from '!!file-loader!../../node_modules/qr-scanner/qr-scanner-worker.min.js';
QrScanner.WORKER_PATH = QrScannerWorkerPath;

export default {
  name: 'Settings',
  mixins: [RecipeHelper],
  components: {
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
     
  },
  mounted() { 
    if (localStorage.getItem('webdav')) {
      this.webdav  = JSON.parse(localStorage.getItem('webdav'));
      this.webdavclient = createClient(this.webdav.webdav_url, this.webdav.webdav_creds)
    }

    document.onkeydown = (event) => {
      //ctrl + s
      if(event.ctrlKey && event.which === 83){ 
        event.preventDefault(); //do not show browser dialog
         this.saveToLocalStorage();
      }
    }
    this.updateQRCode();

    //init QRScanner
    let videoElem = $('#qrcode_scan_video')[0]
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
        this.updateQRCode();
      }
    }
  },
  methods: {
    updateQRCode: function() {
      let canvas = $('#qrcode_config')[0]
      if(canvas) {
        QRCode.toCanvas(canvas, JSON.stringify(this.webdav), (error) => { if (error) console.error(error) });  
      }
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
    copyRecipe: function () {
      //deep copy recipe
      let recipe = this.deepCopyYaml(this.current_recipe);
      //new uuid
      recipe.recipe_uuid = this.generateUUID();
      //load
      this.appendRecipe(recipe);
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
      let data = await this.webdavclient.getFileContents(this.webdav.filepath, { format: "text" });
      this.loadYamlFull(data);
      this.updateCurrentRecipe();
      this.toast('Geladen.', 'success');
    },
    saveWebDAVConfig: function () {
      localStorage.setItem('webdav', JSON.stringify(this.webdav));
      this.webdavclient = createClient(this.webdav.webdav_url, this.webdav.webdav_creds);
    },
    syncWithWebDAV: async function() {
      let data = await this.webdavclient.getFileContents(this.webdav.filepath, { format: "text" });
      let recipes_remote = jsyaml.load(data);
      this.recipes = this.mergeCoobooks(this.recipes, recipes_remote);
      this.updateCurrentRecipe();
      this.toast('Synchronisiert.', 'success');
    },
    toast: function(content,variant)  {
      this.$bvToast.toast(content, {
          toaster: 'b-toaster-bottom-left',
         // solid: true,
          appendToast: true,
          noCloseButton: true,
          variant: variant
        });
    },
    scanQRConfig: function() {
      this.qrScanner.start();
      setTimeout(() => this.qrScanner.stop(), 10000);
    }
  }
}
</script>
