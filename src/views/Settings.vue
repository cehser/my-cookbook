<template>
  <div id="settings">
    <Navbar @input="selected=$event" :recipes_list="recipes_list" :selected="selected" :read_only="read_only">
      <!-- <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle" href="#" role="button" id="dropdownMenuButton" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
        Organisation
        </a>
        <div class="dropdown-menu" aria-labelledby="dropdownMenuButton">
          <div class="dropdown-divider"></div>

          <div class="dropdown-divider"></div>
          <a class="dropdown-item" href="#" @click="saveRecipeAsFile"><b-icon-file-earmark-arrow-down></b-icon-file-earmark-arrow-down> Rezept exportieren</a>
          <a class="dropdown-item" href="#" @click="fileUploadButton.click()"><b-icon-file-earmark-arrow-up></b-icon-file-earmark-arrow-up> Rezept importieren</a>

          <div class="dropdown-divider"></div>
          <a class="dropdown-item" href="#" @click="saveCookbookAsFile"><b-icon-journal-arrow-down></b-icon-journal-arrow-down> Kochbuch exportieren</a>
          <a class="dropdown-item" href="#" @click="fileUploadButton.click()"><b-icon-journal-arrow-up></b-icon-journal-arrow-up> Kochbuch importieren</a>
        </div> 
      </li>-->
    </Navbar>
    <b-container> 
      <h2>Einstellungen</h2>
      
      <b-collapse id="collapse-file-upload">
        <b-form-file hidden="hidden" id="fileUploadButton" @change="loadFromFile" v-model="file" placeholder="Choose a file or drop it here..." drop-placeholder="Drop file here..." accept=".yaml"></b-form-file>
      </b-collapse>

      <b-form-checkbox v-model="read_only" name="check-button" switch>
        Nur lesen 
      </b-form-checkbox>

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
          
          <div class="d-flex flex-row flex-wrap justify-content-around align-items-center">
            <canvas id="qrcode_config" width="100" height="100"></canvas>
            <video id="qrcode_scan_video" height="200"> </video>
          </div> 
          <button type="button" class="btn btn-secondary mt-2" @click="scanQRConfig">QR-Code scannen</button>
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
import Settings from '@/mixins/Settings'
import Toast from '@/mixins/Toast'

import jsyaml from 'js-yaml'
import { createClient } from "webdav/web";
import $ from 'jquery'

const QRCode = require('qrcode')

//qr code scanning
import QrScanner from 'qr-scanner';
import QrScannerWorkerPath from '!!file-loader!../../node_modules/qr-scanner/qr-scanner-worker.min.js';
QrScanner.WORKER_PATH = QrScannerWorkerPath;

export default {
  name: 'Settings',
  mixins: [RecipeHelper, Settings,Toast],
  components: {
    Navbar
  },
  data() {
    return {
      file:null,     //used for file upload
    };
  },
  created() {
    if (localStorage.getItem('webdav')) {
      this.webdav  = JSON.parse(localStorage.getItem('webdav'));
    }  
    this.readLocalSettings();
  },
  mounted() { 
    document.onkeydown = (event) => {
      //ctrl + s
      if(event.ctrlKey && event.which === 83){ 
        event.preventDefault(); //do not show browser dialog
         this.saveWebDAVConfig();
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
      if(canvas && this.webdav) {
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
    saveWebDAVConfig: function () {
      let webdavclient = createClient(this.webdav.webdav_url, this.webdav.webdav_creds);
      
      webdavclient.getFileContents(this.webdav.filepath, { format: "text" })
        .then((x) => {
          this.toast('Datei gefunden.', 'success')
          //localStorage.setItem('webdav', JSON.stringify(this.webdav));
          this.saveLocalSettings();
          this.webdavclient = webdavclient;
          this.toast('Gespeichert.', 'success');
          console.log(x);
        })
        .catch(() => {
          this.toast('Datei nicht gefunden.', 'danger')
        })
    },
    scanQRConfig: function() {
      this.qrScanner.start();
      setTimeout(() => this.qrScanner.stop(), 10000);
    }
  }
}
</script>
