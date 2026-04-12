/**
 * AI proxy API service – recipe extraction via backend (keeps API key server-side).
 */

import { getAccessToken } from "@/auth/oidc";

const API_BASE = "/api/v1";

export interface AIImportResponse {
  yaml: string;
  model: string;
}

async function authHeaders(): Promise<Headers> {
  const headers = new Headers();
  const token = await getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

export const aiApi = {
  /** Extract recipe from text (or URL content). */
  async importText(
    text: string,
    model: string = "gpt-4o",
  ): Promise<AIImportResponse> {
    const headers = await authHeaders();
    headers.set("Content-Type", "application/json");

    const response = await fetch(`${API_BASE}/ai/import`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text, model }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText);
      throw new Error(`AI-Import fehlgeschlagen: ${detail}`);
    }

    return response.json();
  },

  /** Extract recipe from an image file (Vision). */
  async importImage(
    file: File | Blob,
    filename?: string,
    model: string = "gpt-4o",
  ): Promise<AIImportResponse> {
    const headers = await authHeaders();
    const formData = new FormData();
    formData.append("file", file, filename || "photo.jpg");

    const params = new URLSearchParams({ model });
    const response = await fetch(`${API_BASE}/ai/import/image?${params}`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText);
      throw new Error(`AI-Import fehlgeschlagen: ${detail}`);
    }

    return response.json();
  },
};
