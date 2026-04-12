import { api } from "./client";

export interface AdminUser {
  oidc_sub: string;
  display_name: string;
  email: string | null;
  given_name: string | null;
  family_name: string | null;
  role: string;
  created_at: string;
  last_login: string | null;
}

export interface SiteSettings {
  max_share_days: number;
}

export interface AdminShare {
  id: string;
  recipe_id: string;
  recipe_name: string;
  token: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export const adminApi = {
  listUsers: () => api.get<AdminUser[]>("/admin/users"),

  updateRole: (userId: string, role: string) =>
    api.put<AdminUser>(`/admin/users/${userId}/role`, { role }),

  getSettings: () => api.get<SiteSettings>("/admin/settings"),

  updateSettings: (settings: SiteSettings) =>
    api.put<SiteSettings>("/admin/settings", settings),

  listShares: () => api.get<AdminShare[]>("/admin/shares"),

  revokeShare: (shareId: string) => api.delete(`/admin/shares/${shareId}`),

  cleanupImages: () =>
    api.post<{ checked: number; removed: number; remaining: number }>(
      "/admin/cleanup-images",
    ),
};
