/*eslint no-unused-labels: "warn"*/

//import $ from jquery;
import { setMany, getMany } from 'idb-keyval';
import { createClient } from "webdav/web";

export default {
  props: {
    selected: {
      type: Number,
      default: 0
    }
  },
  data () {
    return {
      read_only: true,
      webdav: {
        webdav_creds: {
          username: "user",
          password: "pass"
        },
        webdav_url: "https://webdav.server",
        filepath: "/cookbook.yaml"
      }
    }
  },
  async beforeMount() {
    await this.readLocalSettings();
  },
  methods: {
    saveLocalDataSingle(data) {
      setMany([[data],[this[data]]]);

    },
    readLocalDataSingle(data) {
      getMany([data]).then( ([value]) => {
        if(value != undefined) {
          this[data] = value
        }
      })
    },
    saveLocalSettings() {
      setMany([['webdav', this.webdav],['read_only', this.read_only]]);
    },
    readLocalSettings() {
      getMany(['webdav', 'read_only']).then( ([webdav, read_only]) => {
        if(webdav) {
          this.webdav = webdav;  
          this.webdavclient = createClient(this.webdav.webdav_url, this.webdav.webdav_creds);
        }
        if(read_only != undefined) {
          this.read_only = read_only;  
        }
      })      
    }
  }
};