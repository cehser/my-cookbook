export interface WebDAVCredentials {
  username: string
  password: string
}

export interface WebDAVSettings {
  webdav_creds: WebDAVCredentials
  webdav_url: string
  filepath: string
}

export interface AISettings {
  openai_api_key: string
  gpt_id: string
}

export interface Settings {
  read_only: boolean
  autosync: boolean
  webdav: WebDAVSettings
  ai: AISettings
}
