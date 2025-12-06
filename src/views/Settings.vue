<template>
  <div id="settings">
    <Navbar @input="selected=$event" :recipes_list="recipes_list" :selected="selected" :read_only="store_settings.read_only">
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
    <BContainer> 
      <h2>Einstellungen</h2>
      
      <BCollapse id="collapse-file-upload">
        <BFormFile hidden="hidden" id="fileUploadButton" @change="loadFromFile" v-model="file" placeholder="Choose a file or drop it here..." drop-placeholder="Drop file here..." accept=".yaml"></BFormFile>
      </BCollapse>

      <BFormCheckbox v-model="settings.read_only" name="check-button" switch>
        Nur lesen 
      </BFormCheckbox>
      <BFormCheckbox v-model="settings.autosync" name="check-button" switch>
        Auto-Sync 
      </BFormCheckbox>

      <div id="settings">
        <h5>Cloud-Konfiguration (WebDAV)</h5>
        <div>
          <form>
            <div class="form-group">
              <label for="webdav_url" class="col-form-label">URL</label>
              <input type="text" class="form-control" id="webdav_url" v-model="settings.webdav.webdav_url" autocorrect="off">
            </div>
            <div class="form-group">
              <label for="webdav_username" class="col-form-label">User</label>
              <input type="text" class="form-control" id="webdav_username" v-model="settings.webdav.webdav_creds.username" autocorrect="off"> 
            </div>
            <div class="form-group">
              <label for="webdav_password" class="col-form-label">Passwort</label>
              <input type="text" class="form-control" id="webdav_password" v-model="settings.webdav.webdav_creds.password" autocorrect="off">
            </div>
            <div class="form-group">
              <label for="webdav_filepath" class="col-form-label">Pfad</label>
              <input type="text" class="form-control" id="webdav_filepath" v-model="settings.webdav.filepath" autocorrect="off">
            </div>
          </form>
          
          <div class="d-flex flex-row flex-wrap justify-content-around align-items-center">
            <canvas id="qrcode_config" width="100" height="100"></canvas>
            <video id="qrcode_scan_video" height="200"> </video>
          </div> 
          <button type="button" class="btn btn-secondary mt-2" @click="scanQRConfig">QR-Code scannen</button>
        </div>
        <div class="mt-2 mb-2">
          <button type="button" class="btn btn-primary" :disabled="!changed" @click="saveWebDAVConfig">Save changes</button>
        </div>
        <div class="form-group">
            <label for="configurl" class="col-form-label">Konfiguration teilen</label>
            <BInputGroup>
              <BFormInput  type="text" class="form-control" id="configurl" v-model="configurl" autocorrect="off" disabled></BFormInput>
              <template #append>
                <BButton @click="copyConfigUrl"><i class="bi bi-files"></i></BButton>
              </template>
            </BInputGroup>
        </div>
      </div>

      <div class="mt-4">
        <h5>AI-Integration (OpenAI)</h5>
        <div class="form-group">
          <label for="openai_api_key" class="col-form-label">OpenAI API Key</label>
          <BInputGroup>
            <BFormInput 
              :type="showApiKey ? 'text' : 'password'" 
              class="form-control" 
              id="openai_api_key" 
              v-model="settings.ai.openai_api_key" 
              placeholder="sk-..." 
              autocorrect="off">
            </BFormInput>
            <template #append>
              <BButton @click="showApiKey = !showApiKey">
                <i :class="showApiKey ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
              </BButton>
            </template>
          </BInputGroup>
          <small class="form-text text-muted">
            Wird für den AI-Rezept-Import aus Fotos/Text benötigt. 
            <a href="https://platform.openai.com/api-keys" target="_blank">API-Key erstellen</a>
          </small>
        </div>
        <div class="form-group">
          <label for="gpt_id" class="col-form-label">GPT ID</label>
          <BFormInput 
            type="text" 
            class="form-control" 
            id="gpt_id" 
            v-model="settings.ai.gpt_id" 
            autocorrect="off">
          </BFormInput>
          <small class="form-text text-muted">
            Custom ChatGPT IDs (starting with "g-...") are typically available only in the ChatGPT web UI and may return 404 when used with the OpenAI REST API. If you get a 404, try a supported model like <code>gpt-3.5-turbo</code> or <code>gpt-4o-mini</code>.
          </small>
        </div>
        <div class="mt-2 mb-2">
          <button type="button" class="btn btn-primary" :disabled="!changed" @click="saveWebDAVConfig">Save changes</button>
        </div>
      </div>
    </BContainer>
  </div>

</template>

<script>
// @ is an alias to /src
import Navbar from '@/components/Navbar.vue'

import RecipeHelper from '@/mixins/RecipeHelper'
import { mapState } from 'vuex'
import Toast from '@/mixins/Toast'

import jsyaml from 'js-yaml'

import Cloud from '../js/cloud'

import QRCode from 'qrcode'

import deepEqual from 'deep-equal'

import jsonUrl from 'json-url'
const json_url = jsonUrl('lzma');

//qr code scanning
import QrScanner from 'qr-scanner';
// QrScanner.WORKER_PATH is no longer needed in newer versions

export default {
  name: 'Settings',
  mixins: [RecipeHelper,Toast],
  components: {
    Navbar
  },
  data() {
    return {
      file:null,     //used for file upload
      settings: null,
      configurl: '',  // cached async value
      showApiKey: false  // toggle API key visibility
    };
  },
  async created() {
    //local copy of store settings
    this.settings = JSON.parse(JSON.stringify(this.store_settings))
    
    // Initialize AI settings if not present
    if (!this.settings.ai) {
      this.settings.ai = {
        openai_api_key: "",
        gpt_id: "gpt-5.1"
      }
    }
    
    if(this.$route.query.config) {
      console.log(this.$route.query.config)
      this.settings = await json_url.decompress(this.$route.query.config)
      console.log(this.settings)
    }
    // Initialize configurl
    this.updateConfigUrl();
  },
  computed: {
    ...mapState({
      // passing the string value 'count' is same as `state => state.count`
      store_settings: 'settings'
    }),
    changed: function() {
      return !deepEqual(this.settings, this.store_settings)
    }
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
    let videoElem = document.querySelector('#qrcode_scan_video');
    this.qrScanner = new QrScanner(videoElem, result => { 
      try {
        let webdav_qr = JSON.parse(result); 
        this.settings.webdav.webdav_url = webdav_qr.webdav_url;
        this.settings.webdav.filepath   = webdav_qr.filepath;
        this.settings.webdav.webdav_creds.username = webdav_qr.webdav_creds.username;
        this.settings.webdav.webdav_creds.password = webdav_qr.webdav_creds.password;
        this.scrollto('#settings')
      }
      catch(e) {
        console.log(e);
      } 
      finally {
        this.qrScanner.stop();
        this.closeFullscreen();   
      }
    });

  },
  watch: {
    settings :{
      deep: true,
      //update qr code and configurl
      handler() {
        this.updateQRCode();
        this.updateConfigUrl();
      }
    }
  },
  methods: {
    async updateConfigUrl() {
      this.configurl = location.toString() + "?config=" + await json_url.compress(this.settings);
    },
    updateQRCode: function() {
      let canvas = document.querySelector('#qrcode_config');
      if(canvas && this.settings.webdav) {
        QRCode.toCanvas(canvas, JSON.stringify(this.settings.webdav), (error) => { if (error) console.error(error) });  
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
    async saveWebDAVConfig () {
      const spinner = document.querySelector('#loading-spinner');
      if (spinner) spinner.classList.remove('d-none');
      Cloud.checkPath(this.settings)
        .then((fileExists) =>{ 
          if(fileExists) {
            this.$store.dispatch("saveSettings", this.settings)
              .then(() => {
                this.toast('Gespeichert.', 'success')
              })
          }
          else {
            this.toast('Datei nicht gefunden.', 'danger')
          }
        })
        .catch((e) => {
          this.toast('Zugriffsfehler!', 'danger');
          console.log(e);
        })
        .finally(() => {
          const spinner = document.querySelector('#loading-spinner');
          if (spinner) spinner.classList.add('d-none');
        })
    },
    scanQRConfig: function() {
      this.qrScanner.start();
      let videoElem = document.querySelector('#qrcode_scan_video');
      this.openFullscreen(videoElem)
      setTimeout(() => {
          this.qrScanner.stop()
          this.closeFullscreen()
        }
        , 10000);
    },
    openFullscreen: function (elem) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) { /* Safari */
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) { /* IE11 */
        elem.msRequestFullscreen();
      }
    },

    /* Close fullscreen */
    closeFullscreen: function () {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) { /* Firefox */
        document.mozCancelFullScreen();
      } 
      else if (document.webkitExitFullscreen) { /* Safari */
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) { /* IE11 */
        document.msExitFullscreen();
      }
    },
    scrollto: function(element){
      const el = document.querySelector(element);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    copyConfigUrl: function() {
      const text = this.configurl;
      
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text)
          .then(() => {
            this.toast('URL kopiert!', 'success');
          })
          .catch(() => {
            this.fallbackCopy(text);
          });
      } else {
        this.fallbackCopy(text);
      }
    },
    fallbackCopy: function(text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        this.toast('URL kopiert!', 'success');
      } catch (err) {
        this.toast('Kopieren fehlgeschlagen', 'danger');
      }
      document.body.removeChild(textarea);
    }
  }
}
</script>
