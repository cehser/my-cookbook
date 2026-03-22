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
  expert_mode: boolean
  gpt_model: string
  role: string
  /** @deprecated kept for backwards compat during migration */
  autosync?: boolean
  /** @deprecated kept for backwards compat during migration */
  webdav?: WebDAVSettings
  /** @deprecated kept for backwards compat during migration */
  ai?: AISettings
}
