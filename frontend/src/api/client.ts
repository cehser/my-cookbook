/**
 * API Client with automatic Bearer token injection.
 *
 * On 401 responses, attempts a silent token renewal and retries once
 * before throwing — prevents unnecessary full-page redirects when the
 * access token just expired between the client-side check and the
 * server-side validation.
 */

import { getAccessToken, refreshToken } from "@/auth/oidc";

const API_BASE = "/api/v1";

interface FetchOptions extends globalThis.RequestInit {
  skipAuth?: boolean;
}

async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
  _isRetry = false,
): Promise<T> {
  const { skipAuth, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);

  if (!skipAuth) {
    const token = await getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  if (
    !headers.has("Content-Type") &&
    fetchOptions.body &&
    typeof fetchOptions.body === "string"
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
  });

  // On 401: try silent token renewal once, then retry
  if (response.status === 401 && !skipAuth && !_isRetry) {
    const newToken = await refreshToken();
    if (newToken) {
      return apiFetch<T>(path, options, true);
    }
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(`API Error ${status}: ${detail}`);
    this.name = "ApiError";
  }
}

export const api = {
  get: <T>(path: string, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: "GET" }),

  post: <T>(path: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(path, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(path, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};
