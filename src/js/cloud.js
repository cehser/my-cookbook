import { createClient } from 'webdav/web';
const jsyaml = require('js-yaml');

export default {
  webdavClient(settings) {
    return createClient(settings.webdav.webdav_url, settings.webdav.webdav_creds);
  },
  checkFile(settings) {
    let webdavclient = createClient(settings.webdav.webdav_url, settings.webdav.webdav_creds);
    return webdavclient.exists(settings.webdav.filepath)
  },
  getFile(settings) {
    let webdavclient = createClient(settings.webdav.webdav_url, settings.webdav.webdav_creds);
    return webdavclient.getFileContents(settings.webdav.filepath, { format: "text" })
  },
  async putFile(settings, recipes) {
    let webdavclient = createClient(settings.webdav.webdav_url, settings.webdav.webdav_creds);
    await webdavclient.putFileContents(settings.webdav.filepath, jsyaml.dump(recipes))
  }
}