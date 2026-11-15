/**
 * Image API service – upload, list, delete recipe images.
 */

import { getAccessToken } from "@/auth/oidc";

const API_BASE = "/api/v1";

/** photo = Rezeptfoto (Titelbild), source = Vorlage des Foto-Imports. */
export type ImageKind = "photo" | "source";

export interface ImageInfo {
  id: string;
  recipe_id: string;
  filename: string;
  mime_type: string;
  file_size: number;
  sort_order: number;
  kind: ImageKind;
  created_at: string;
}

async function authHeaders(): Promise<Headers> {
  const headers = new Headers();
  const token = await getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

export const imageApi = {
  /** Upload an image for a recipe (Default: Rezeptfoto). */
  async upload(
    recipeId: string,
    file: Blob,
    kind: ImageKind = "photo",
  ): Promise<ImageInfo> {
    const headers = await authHeaders();
    const formData = new FormData();
    // Blobs (verkleinerte Importseiten) haben keinen Namen
    formData.append(
      "file",
      file,
      file instanceof File ? file.name : "seite.jpg",
    );
    formData.append("kind", kind);

    const response = await fetch(
      `${API_BASE}/recipes/${encodeURIComponent(recipeId)}/images`,
      { method: "POST", headers, body: formData },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText);
      throw new Error(`Upload fehlgeschlagen: ${detail}`);
    }

    return response.json();
  },

  /** List images for a recipe, optional nur eine Bildart. */
  async list(recipeId: string, kind?: ImageKind): Promise<ImageInfo[]> {
    const headers = await authHeaders();
    const query = kind ? `?kind=${kind}` : "";
    const response = await fetch(
      `${API_BASE}/recipes/${encodeURIComponent(recipeId)}/images${query}`,
      { headers },
    );

    if (!response.ok) {
      throw new Error(`Bilder laden fehlgeschlagen: ${response.status}`);
    }

    return response.json();
  },

  /** Delete an image. */
  async delete(recipeId: string, imageId: string): Promise<void> {
    const headers = await authHeaders();
    const response = await fetch(
      `${API_BASE}/recipes/${encodeURIComponent(recipeId)}/images/${encodeURIComponent(imageId)}`,
      { method: "DELETE", headers },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText);
      throw new Error(`Löschen fehlgeschlagen: ${detail}`);
    }
  },

  /** Get the URL for the optimised image. */
  imageUrl(imageId: string): string {
    return `${API_BASE}/images/${encodeURIComponent(imageId)}`;
  },

  /** Get the URL for the thumbnail. */
  thumbnailUrl(imageId: string): string {
    return `${API_BASE}/images/${encodeURIComponent(imageId)}/thumbnail`;
  },
};
