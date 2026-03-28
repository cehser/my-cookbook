import { api } from "./client";

export interface Share {
  id: string;
  recipe_id: string;
  token: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export interface ShareConfig {
  max_share_days: number;
}

export const sharesApi = {
  getConfig: () => api.get<ShareConfig>("/shares/config"),

  create: (recipeId: string, expiresInDays?: number) =>
    api.post<Share>(`/recipes/${recipeId}/share`, {
      expires_in_days: expiresInDays,
    }),

  list: (recipeId: string) => api.get<Share[]>(`/recipes/${recipeId}/shares`),

  revoke: (shareId: string) => api.delete(`/shares/${shareId}`),
};
