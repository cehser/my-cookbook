import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
  type RouteRecordRaw,
} from "vue-router";
import HomeView from "@/views/HomeView.vue";
import { requireAuth, requireRole } from "@/auth/guards";
import { setLoginTargetResolver } from "@/auth/session";
import { reloadOnce } from "@/js/reload";

declare module "vue-router" {
  interface RouteMeta {
    mode?: "browsing" | "cook" | "edit";
    /** Route without login (no login redirect on rejected session) */
    public?: boolean;
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Gallery",
    component: HomeView,
    beforeEnter: requireAuth,
    meta: { mode: "browsing" },
  },
  {
    path: "/favorites",
    name: "Favorites",
    component: () =>
      import(/* webpackChunkName: "favorites" */ "../views/FavoritesView.vue"),
    beforeEnter: requireAuth,
    meta: { mode: "browsing" },
  },
  {
    path: "/search",
    name: "Search",
    component: () =>
      import(/* webpackChunkName: "search" */ "../views/SearchView.vue"),
    beforeEnter: requireAuth,
    meta: { mode: "browsing" },
  },
  {
    path: "/recipe/:id/:slug?",
    name: "Recipe",
    component: () =>
      import(/* webpackChunkName: "recipe" */ "../views/Recipe.vue"),
    beforeEnter: requireAuth,
    props: (route) => ({ id: route.params.id as string }),
    meta: { mode: "cook" },
  },
  {
    path: "/edit/:id/:slug?",
    name: "Edit",
    component: () => import(/* webpackChunkName: "edit" */ "../views/Edit.vue"),
    beforeEnter: requireRole("editor", "admin"),
    props: (route) => ({ id: route.params.id as string }),
    meta: { mode: "edit" },
  },
  {
    path: "/settings",
    name: "Settings",
    component: () =>
      import(/* webpackChunkName: "profile" */ "../views/ProfileView.vue"),
    beforeEnter: requireAuth,
    meta: { mode: "browsing" },
  },
  {
    path: "/administration",
    name: "Administration",
    component: () =>
      import(/* webpackChunkName: "settings" */ "../views/Administration.vue"),
    beforeEnter: requireRole("admin"),
    meta: { mode: "browsing" },
  },
  {
    path: "/callback",
    name: "Callback",
    component: () =>
      import(/* webpackChunkName: "callback" */ "../views/Callback.vue"),
    meta: { public: true },
  },
  {
    path: "/s/:token",
    name: "SharedRecipe",
    component: () =>
      import(/* webpackChunkName: "shared" */ "../views/SharedRecipe.vue"),
    props: true,
    // No auth guard — public route
    meta: { public: true },
  },
  //legacy paths for compatibility reasons
  { path: "/edit.html", redirect: "/edit/0" },
  { path: "/edit", redirect: "/edit/0" },
  { path: "/recipe.html", redirect: "/recipe" },
  { path: "/recipe", redirect: "/recipe/0" },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

// Target of the navigation in progress: before it completes, currentRoute
// is still the previous route (on a cold start the start location "/", even
// when opening a public link).
let pendingTarget: RouteLocationNormalized | null = null;
router.beforeEach((to) => {
  pendingTarget = to;
});
router.afterEach(() => {
  pendingTarget = null; // also called for aborted/failed navigations
});
router.onError(() => {
  pendingTarget = null;
});

// Login target for auth/session.ts (resume, online, rejected session): the
// route being shown or navigated to. Public routes (callback, shared links)
// and the start location get no login.
setLoginTargetResolver(() => {
  const route = pendingTarget ?? router.currentRoute.value;
  if (route.matched.length === 0 || route.meta.public) return null;
  return route.fullPath;
});

// Chunk load errors after an update (old chunks gone from the server).
// Vite wraps every dynamic import and fires `vite:preloadError` when the
// import or its preload fails, in every browser. The message match is only a
// fallback: Chrome/Chromium "Failed to fetch dynamically imported module",
// Firefox "error loading dynamically imported module" (documented in Mozilla
// bug reports), Safari "Importing a module script failed" (unconfirmed).
// The flag only counts for the navigation in progress: imports outside the
// router (e.g. a lazy component in a dialog) must not mark a later navigation.
let preloadFailed = false;
router.beforeEach(() => {
  preloadFailed = false;
});
window.addEventListener("vite:preloadError", () => {
  // not prevented: the error reaches router.onError
  if (pendingTarget) preloadFailed = true;
});

const CHUNK_ERROR_PATTERN =
  /dynamically imported module|Unable to preload CSS|Importing a module script failed/i;

// At most one chunk reload per 10 s: if the server keeps failing to deliver
// the chunks, the error passes through instead of reloading in a loop.
const CHUNK_RELOAD_KEY = "my-cookbook-chunk-reload";
const CHUNK_RELOAD_MIN_INTERVAL_MS = 10 * 1000;

function chunkReloadAllowed(): boolean {
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
    if (Date.now() - last < CHUNK_RELOAD_MIN_INTERVAL_MS) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable: reload anyway (no loop protection)
  }
  return true;
}

router.onError((error, to) => {
  const failed =
    preloadFailed || CHUNK_ERROR_PATTERN.test(String(error?.message));
  preloadFailed = false;
  if (!failed || !chunkReloadAllowed()) return;
  // Full reload to the target picks up the new SW and assets
  reloadOnce(to.fullPath);
});

// --- Session Restore (iOS PWA Fix) ---
const SESSION_KEY = "my-cookbook-session";
const SESSION_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

interface SessionState {
  path: string;
  timestamp: number;
}

// Save route on every navigation (except edit mode and callback)
router.afterEach((to) => {
  if (to.meta?.mode === "edit" || to.name === "Callback") return;
  try {
    const state: SessionState = { path: to.fullPath, timestamp: Date.now() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {
    // quota exceeded — ignore
  }
});

/**
 * Attempt to restore last session on cold start.
 * Only restores cook-mode routes (Recipe view) within 30 min.
 */
export function restoreSession(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const state: SessionState = JSON.parse(raw);
    if (Date.now() - state.timestamp > SESSION_MAX_AGE_MS) return null;
    // Only restore recipe (cook) routes — not edit, not browsing
    if (!state.path.startsWith("/recipe/")) return null;
    return state.path;
  } catch {
    return null;
  }
}

export default router;
