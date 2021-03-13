export default interface Settings {
  read_only: boolean,
  autosync: boolean,
  webdav: {
    webdav_creds: {
      username: string,
      password: string
    },
    webdav_url: string,
    filepath: string
  }
}