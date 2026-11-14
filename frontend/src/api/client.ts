/**
 * API Client with automatic Bearer token injection.
 *
 * The token is renewed before the request if it has expired (shared with all
 * other callers, see auth/oidc.ts). On 401 responses, attempts one renewal
 * and retries once before throwing — covers tokens that expired between the
 * client-side check and the server-side validation.
 *
 * Every request is aborted after DEFAULT_TIMEOUT_MS (hanging connection while
 * `navigator.onLine` is true) and fails with ApiTimeoutError. Long-running
 * calls pass `timeoutMs: 0`. AI import and image uploads use their own fetch.
 */

import { getAccessToken, renewAfterUnauthorized } from "@/auth/oidc";

const API_BASE = "/api/v1";
const DEFAULT_TIMEOUT_MS = 15_000;

interface FetchOptions extends globalThis.RequestInit {
  skipAuth?: boolean;
  /** Abort after this many ms; 0 = no timeout. Default: DEFAULT_TIMEOUT_MS */
  timeoutMs?: number;
}

/** Runs `run` with an AbortSignal that fires after `timeoutMs` (0 = never). */
async function withTimeout<T>(
  timeoutMs: number,
  outer: AbortSignal | null | undefined,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer =
    timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : undefined;
  const forwardAbort = () => controller.abort();
  if (outer?.aborted) controller.abort();
  outer?.addEventListener("abort", forwardAbort);
  try {
    return await run(controller.signal);
  } catch (e) {
    if (timedOut) throw new ApiTimeoutError(timeoutMs);
    throw e;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", forwardAbort);
  }
}

async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
  _isRetry = false,
): Promise<T> {
  const { skipAuth, timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);

  let token: string | null = null;
  if (!skipAuth) {
    token = await getAccessToken();
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

  // Timeout covers the response body as well, not only the headers.
  const result = await withTimeout(
    timeoutMs,
    fetchOptions.signal,
    async (signal) => {
      const response = await fetch(`${API_BASE}${path}`, {
        ...fetchOptions,
        headers,
        signal,
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => response.statusText);
        if (response.status === 401) {
          return { unauthorized: true as const, detail };
        }
        throw new ApiError(response.status, detail);
      }
      if (response.status === 204) {
        return { unauthorized: false as const, data: undefined as T };
      }
      return {
        unauthorized: false as const,
        data: (await response.json()) as T,
      };
    },
  );

  if (result.unauthorized) {
    // On 401: try token renewal once, then retry. Without a token the
    // renewal has already failed in getAccessToken(), so don't try again.
    if (token && !_isRetry) {
      const newToken = await renewAfterUnauthorized(token);
      if (newToken) {
        return apiFetch<T>(path, options, true);
      }
    }
    throw new ApiError(401, result.detail);
  }

  return result.data;
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

export class ApiTimeoutError extends Error {
  constructor(public timeoutMs: number) {
    super(`API request timed out after ${timeoutMs} ms`);
    this.name = "ApiTimeoutError";
  }
}

/**
 * Client error (4xx except 401): the API answered and refused, e.g. 403 for
 * role `pending`. Not an outage, so no fallback to the offline cache.
 */
export function isClientError(e: unknown): boolean {
  return (
    e instanceof ApiError &&
    e.status >= 400 &&
    e.status < 500 &&
    e.status !== 401
  );
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
