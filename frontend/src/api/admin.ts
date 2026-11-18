import { api, readDownload, type DownloadedFile } from "./client";

/**
 * Gesamtexport: Der Timeout gilt auch für den Body. Erstellen dauert Sekunden
 * (200 Rezepte, 400 Bilder: ca. 6 s, 340 MiB), die Übertragung über einen
 * langsamen Uplink kann Minuten brauchen.
 */
export const EXPORT_TIMEOUT_MS = 15 * 60_000;

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
  ai_model_text: string;
  ai_model_image: string;
  /** Nur lesen: ob das Backend einen OpenAI-Key hat (der Key selbst bleibt geheim). */
  openai_key_configured: boolean;
}

export type SiteSettingsUpdate = Partial<
  Pick<SiteSettings, "max_share_days" | "ai_model_text" | "ai_model_image">
>;

export interface AIConnectionTest {
  ok: boolean;
  models: { purpose: string; model: string; available: boolean }[];
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

  updateSettings: (settings: SiteSettingsUpdate) =>
    api.put<SiteSettings>("/admin/settings", settings),

  // models.retrieve je Modell, braucht eine Antwort von OpenAI
  testAiConnection: () =>
    api.post<AIConnectionTest>("/admin/ai/test", undefined, {
      timeoutMs: 30_000,
    }),

  listShares: () => api.get<AdminShare[]>("/admin/shares"),

  revokeShare: (shareId: string) => api.delete(`/admin/shares/${shareId}`),

  // Long-running maintenance jobs: no client timeout
  cleanupImages: () =>
    api.post<{ checked: number; removed: number; remaining: number }>(
      "/admin/cleanup-images",
      undefined,
      { timeoutMs: 0 },
    ),

  /** ZIP mit allen Rezepten, Tags und Bildern (Format im Plan export-import). */
  exportAll: () =>
    api.get<DownloadedFile>("/admin/export", {
      timeoutMs: EXPORT_TIMEOUT_MS,
      parse: readDownload,
    }),

  stripImageIds: () =>
    api.post<{ cleaned: number }>("/admin/strip-image-ids", undefined, {
      timeoutMs: 0,
    }),
};
