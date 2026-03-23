/**
 * Tags API service — list all tags with recipe counts.
 */

import api from '@/api/client'

export interface TagWithCount {
  name: string
  count: number
}

export const tagsApi = {
  /** Get all tags with their recipe count, sorted alphabetically. */
  async list(): Promise<TagWithCount[]> {
    return api.get<TagWithCount[]>('/tags')
  },
}

export default tagsApi
