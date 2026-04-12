import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import HomeView from "@/views/HomeView.vue";
import { requireAuth, requireRole } from "@/auth/guards";

declare module "vue-router" {
  interface RouteMeta {
    mode?: "browsing" | "cook" | "edit";
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
  },
  {
    path: "/s/:token",
    name: "SharedRecipe",
    component: () =>
      import(/* webpackChunkName: "shared" */ "../views/SharedRecipe.vue"),
    props: true,
    // No auth guard — public route
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

// Handle chunk load errors after SW update (hash mismatch)
router.onError((error, to) => {
  if (
    error.message.includes("Failed to fetch dynamically imported module") ||
    error.message.includes("Unable to preload CSS")
  ) {
    // Force full reload to pick up new SW + assets
    window.location.assign(to.fullPath);
  }
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
