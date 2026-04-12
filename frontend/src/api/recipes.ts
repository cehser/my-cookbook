/**
 * Recipe API service – typed wrappers around the generic API client.
 */

import { api } from "@/api/client";

// --- Response types (matching backend schemas) ---

export interface RecipeListItem {
  id: string;
  recipe_name: string;
  author: string | null;
  subtitle: string | null;
  tags: string[];
  imageurl: string | null;
  first_image_id: string | null;
  updated_at: string;
  created_by: string | null;
}

export interface RecipeListResponse {
  items: RecipeListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface RecipeDetail {
  id: string;
  recipe_name: string;
  data: Record<string, unknown>;
  tags: string[];
  first_image_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TagItem {
  id: number;
  name: string;
}

// --- Request types ---

export interface RecipeCreatePayload {
  recipe_name: string;
  data: Record<string, unknown>;
  tags?: string[];
}

export interface RecipeUpdatePayload {
  recipe_name?: string;
  data?: Record<string, unknown>;
  tags?: string[];
}

export interface ListRecipesParams {
  q?: string;
  tag?: string;
  sort?: "updated" | "name" | "created";
  order?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

// --- API calls ---

function buildQuery(
  params: Record<string, string | number | undefined>,
): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== "",
  );
  if (entries.length === 0) return "";
  return (
    "?" +
    entries
      .map(
        ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
      )
      .join("&")
  );
}

export const recipeApi = {
  /** List recipes with search, filter, sort, pagination. */
  list(params: ListRecipesParams = {}) {
    const qs = buildQuery(
      params as Record<string, string | number | undefined>,
    );
    return api.get<RecipeListResponse>(`/recipes${qs}`);
  },

  /** Get a single recipe by ID. */
  get(id: string) {
    return api.get<RecipeDetail>(`/recipes/${encodeURIComponent(id)}`);
  },

  /** Create a new recipe. */
  create(payload: RecipeCreatePayload) {
    return api.post<RecipeDetail>("/recipes", payload);
  },

  /** Update an existing recipe. */
  update(id: string, payload: RecipeUpdatePayload) {
    return api.put<RecipeDetail>(`/recipes/${encodeURIComponent(id)}`, payload);
  },

  /** Delete a recipe (admin only). */
  delete(id: string) {
    return api.delete<void>(`/recipes/${encodeURIComponent(id)}`);
  },

  /** List all tags. */
  listTags() {
    return api.get<TagItem[]>("/tags");
  },

  /** Set tags for a recipe (replaces existing). */
  setTags(recipeId: string, tags: string[]) {
    return api.post<string[]>(
      `/recipes/${encodeURIComponent(recipeId)}/tags`,
      tags,
    );
  },
};
