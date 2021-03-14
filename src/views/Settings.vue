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
    <b-container> 
      <h2>Einstellungen</h2>
      
      <b-collapse id="collapse-file-upload">
        <b-form-file hidden="hidden" id="fileUploadButton" @change="loadFromFile" v-model="file" placeholder="Choose a file or drop it here..." drop-placeholder="Drop file here..." accept=".yaml"></b-form-file>
      </b-collapse>

      <b-form-checkbox v-model="settings.read_only" name="check-button" switch>
        Nur lesen 
      </b-form-checkbox>
      <b-form-checkbox v-model="settings.autosync" name="check-button" switch>
        Auto-Sync 
      </b-form-checkbox>

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
            <b-input-group>
              <b-form-input  type="text" class="form-control" id="configurl" v-model="configurl" autocorrect="off" disabled></b-form-input>
              <b-input-group-append>
                <b-button v-clipboard="() => {this.toast('Kopiert.', 'success'); return configurl}"><b-icon-files></b-icon-files></b-button>
              </b-input-group-append>
            </b-input-group>
        </div>
      </div>
    </b-container>
  </div>

</template>

<script lang="ts">
import Navbar from '@/components/Navbar.vue'

import RecipeHelper from '@/mixins/RecipeHelper'
import Toast from '@/mixins/Toast'

import jsyaml from 'js-yaml'
import $ from 'jquery'

import Cloud from '../js/cloud'

const QRCode = require('qrcode')

const json_url = require('json-url')('lzma');

//qr code scanning
import QrScanner from 'qr-scanner';
import QrScannerWorkerPath from '!!file-loader!../../node_modules/qr-scanner/qr-scanner-worker.min.js'
QrScanner.WORKER_PATH = QrScannerWorkerPath;

import { Component, Mixins, Watch } from 'vue-property-decorator'
import _ from 'lodash'
// eslint-disable-next-line no-unused-vars
import SettingsType from '@/types/settings'
import {  namespace } from 'vuex-class'

import AsyncComputed  from 'vue-async-computed-decorator';

const VuexSettings = namespace('Settings')

@Component({
    components: {
    Navbar
  }
})
export default class Settings extends Mixins(RecipeHelper, Toast) {
  public file:(File | null)= null
  public settings:(SettingsType | null) = null
  private qrScanner!:QrScanner

  @VuexSettings.State('settings') store_settings!:SettingsType

  @VuexSettings.Action saveSettings!:(settings:SettingsType) => Promise<void>

  async created() {
    //local copy of store settings
    this.settings = _.cloneDeep(this.store_settings)
    if(this.$route.query.config) {
      console.log(this.$route.query.config)
      this.settings = await json_url.decompress(this.$route.query.config)
      console.log(this.settings)
    }
  }

  get changed() {
    return !_.isEqual(this.settings, this.store_settings)
  }

  @AsyncComputed()
  async configurl() {
    return location.toString() + "?config=" + await json_url.compress(this.settings);
  }

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
    let videoElem = $('#qrcode_scan_video')[0] as HTMLVideoElement
    this.qrScanner = new QrScanner(videoElem, result => { 
      try {
        if(this.settings) {
          let webdav_qr = JSON.parse(result); 
          this.settings.webdav.webdav_url = webdav_qr.webdav_url;
          this.settings.webdav.filepath   = webdav_qr.filepath;
          this.settings.webdav.webdav_creds.username = webdav_qr.webdav_creds.username;
          this.settings.webdav.webdav_creds.password = webdav_qr.webdav_creds.password;
          this.scrollto('#settings')
        }
      }
      catch(e) {
        console.log(e);
      } 
      finally {
        this.qrScanner.stop();
        this.closeFullscreen();   
      }
    });

  }

  @Watch('settings', {deep:true})
  updateQRCode() {
    let canvas = $('#qrcode_config')[0]
    if(canvas && this.settings?.webdav) {
      QRCode.toCanvas(canvas, JSON.stringify(this.settings.webdav), (error:any) => { if (error) console.error(error) });  
    }
  }
  saveRecipeAsFile() {
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
      //downloadLink.onclick = this.destroyClickedElement;
      downloadLink.style.display = "none";
      document.body.appendChild(downloadLink);
    }
  
    downloadLink.click();
  }
  saveCookbookAsFile() {
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
      //downloadLink.onclick = this.destroyClickedElement;
      downloadLink.style.display = "none";
      document.body.appendChild(downloadLink);
      downloadLink.click();  
    }     
  }
        /*  loadFromFile(ev:any) {
    const file = ev.target.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      if(e.target && e.target.result) {
        let content = jsyaml.load(e.target.result as string);
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
      }
    };
    //reader.onload = e => console.log(e.target.result);

    reader.readAsText(file);    
  }*/
  async saveWebDAVConfig () {
    $("#loading-spinner").removeClass('d-none');
    Cloud.checkPath(this.settings)
      .then((fileExists) =>{ 
        if(fileExists && this.settings) {
          this.saveSettings(this.settings)
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
      .finally(() => $("#loading-spinner").addClass('d-none'))
  }
  scanQRConfig() {
    this.qrScanner.start();
    let videoElem = $('#qrcode_scan_video')[0]
    this.openFullscreen(videoElem)
    setTimeout(() => {
        this.qrScanner.stop()
        this.closeFullscreen()
      }
      , 10000);
  }
  openFullscreen(elem:FsElement) {
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) { /* Safari */
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE11 */
      elem.msRequestFullscreen();
    }
  }

  /* Close fullscreen */
  closeFullscreen() {
    let fsdoc = document as FsDocument
    if (fsdoc.exitFullscreen) {
      fsdoc.exitFullscreen();
    } else if (fsdoc.mozCancelFullScreen) { /* Firefox */
      fsdoc.mozCancelFullScreen();
    } 
    else if (fsdoc.webkitExitFullscreen) { /* Safari */
      fsdoc.webkitExitFullscreen();
    } else if (fsdoc.msExitFullscreen) { /* IE11 */
      fsdoc.msExitFullscreen();
    }
  }
  scrollto(element:string){
    let elem = $(element)
    $('html, body').animate({ scrollTop: (elem?.offset()?.top)}, 'slow');
  }
}

interface FsDocument extends HTMLDocument  {
  mozCancelFullScreen?: () => void;
  webkitExitFullscreen?: () => void;
  msExitFullscreen?: () => void;
}

interface FsElement extends HTMLElement  {
  webkitRequestFullscreen?: () => void;
  msRequestFullscreen?: () => void;
}
</script>
