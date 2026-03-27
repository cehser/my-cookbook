/**
 * Favorites API service — server-side per-user favorites.
 */

import api from '@/api/client'

export const favoritesApi = {
  /** Get all favorited recipe UUIDs for the current user. */
  async list(): Promise<string[]> {
    return api.get<string[]>('/favorites')
  },

  /** Add a recipe to favorites (idempotent). */
  async add(recipeId: string): Promise<void> {
    await api.post<void>(`/favorites/${encodeURIComponent(recipeId)}`)
  },

  /** Remove a recipe from favorites. */
  async remove(recipeId: string): Promise<void> {
    await api.delete<void>(`/favorites/${encodeURIComponent(recipeId)}`)
  },
}

export default favoritesApi
