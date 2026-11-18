/**
 * Mock-API unter `/api/v1`: Vorgaben aus dem Seed (Liste, Detail, `/me`),
 * je Szenario überschreibbar (`MockResponses`). Unbekannte Endpunkte: 404.
 */

import type {
  MockResponse,
  MockResponses,
  Seed,
  ServerRecipe,
} from "./types.ts";

const NOW = "2026-11-18T12:00:00Z";

function listItem(r: ServerRecipe, sub: string | null) {
  const data = r.data ?? {};
  return {
    id: r.id,
    recipe_name: r.recipe_name,
    author: (data.author as string | undefined) ?? null,
    subtitle: (data.subtitle as string | undefined) ?? null,
    tags: r.tags ?? [],
    imageurl: null,
    first_image_id: null,
    updated_at: NOW,
    created_by: r.created_by === undefined ? sub : r.created_by,
  };
}

function detail(r: ServerRecipe, sub: string | null) {
  return {
    id: r.id,
    recipe_name: r.recipe_name,
    data: {
      sections: [{ section: "" }],
      ingredients: [],
      steps: [],
      ...r.data,
    },
    tags: r.tags ?? [],
    first_image_id: null,
    created_by: r.created_by === undefined ? sub : r.created_by,
    updated_by: sub,
    created_at: NOW,
    updated_at: NOW,
  };
}

/** `"GET /recipes/:id"` passt auf `GET /recipes/abc`. */
function matches(key: string, method: string, path: string): boolean {
  const [m, pattern] = key.split(" ", 2);
  if (m !== method || !pattern) return false;
  const want = pattern.split("/");
  const got = path.split("/");
  return (
    want.length === got.length &&
    want.every((seg, i) => seg.startsWith(":") || seg === got[i])
  );
}

export interface MockResult {
  status: number;
  body: unknown;
  delayMs: number;
}

export function createMockApi(seed: Seed, overrides: MockResponses = {}) {
  const sub = seed.user?.sub ?? null;
  const recipes = seed.serverRecipes ?? [];
  const find = (id: string) => recipes.find((r) => r.id === id);

  /** Vorgabe je Endpunkt; `null` = unbekannt. */
  function fallback(
    method: string,
    path: string,
    body: unknown,
  ): MockResponse | null {
    const id = decodeURIComponent(path.split("/")[2] ?? "");
    if (method === "GET" && path === "/me") {
      return seed.user
        ? {
            status: 200,
            body: {
              oidc_sub: seed.user.sub,
              display_name: seed.user.name,
              role: seed.user.role,
            },
          }
        : { status: 401, body: { detail: "Nicht angemeldet" } };
    }
    if (method === "GET" && path === "/me/settings") {
      // wie das Backend seit U.15: read_only aus der Rolle, expert_mode false
      const role = seed.user?.role ?? "pending";
      return {
        status: 200,
        body: {
          read_only: role !== "editor" && role !== "admin",
          expert_mode: false,
          role,
        },
      };
    }
    if (method === "GET" && path === "/recipes") {
      const items = recipes.map((r) => listItem(r, sub));
      return {
        status: 200,
        body: { items, total: items.length, page: 1, page_size: 200 },
      };
    }
    if (matches("GET /recipes/:id", method, path)) {
      const r = find(id);
      return r
        ? { status: 200, body: detail(r, sub) }
        : { status: 404, body: { detail: "Rezept nicht gefunden" } };
    }
    if (method === "POST" && path === "/recipes") {
      const payload = (body ?? {}) as ServerRecipe;
      return { status: 201, body: detail(payload, sub) };
    }
    if (matches("PUT /recipes/:id", method, path)) {
      const payload = (body ?? {}) as Omit<ServerRecipe, "id">;
      const base = find(id) ?? { id, recipe_name: "" };
      return { status: 200, body: detail({ ...base, ...payload, id }, sub) };
    }
    if (matches("DELETE /recipes/:id", method, path)) {
      return { status: 204 };
    }
    if (method === "GET" && (path === "/favorites" || path === "/tags")) {
      return { status: 200, body: [] };
    }
    if (matches("GET /recipes/:id/images", method, path)) {
      return { status: 200, body: [] };
    }
    return null;
  }

  return function handle(
    method: string,
    path: string,
    body: unknown,
  ): MockResult {
    const key = Object.keys(overrides).find((k) => matches(k, method, path));
    const base = fallback(method, path, body);
    const chosen = key ? overrides[key] : base;
    if (!chosen) {
      return { status: 404, body: { detail: "Mock: unbekannt" }, delayMs: 0 };
    }
    const status = chosen.status;
    let out = chosen.body;
    if (out === undefined) {
      // Fehlerstatus ohne Text: FastAPI-ähnlicher Body
      out =
        status >= 400
          ? { detail: `Mock ${status}` }
          : base?.status === status
            ? base.body
            : undefined;
    }
    return { status, body: out, delayMs: chosen.delayMs ?? 0 };
  };
}
