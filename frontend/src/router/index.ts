import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import Gallery from "@/views/Gallery.vue";
import { requireAuth, requireRole } from "@/auth/guards";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Gallery",
    component: Gallery,
    beforeEnter: requireAuth,
  },
  {
    path: "/favorites",
    name: "Favorites",
    component: Gallery, // Temporär: Nutzt Gallery-Komponente, später eigene View oder Query-Parameter
    beforeEnter: requireAuth,
  },
  {
    path: "/search",
    name: "Search",
    component: Gallery, // Temporär: Nutzt Gallery-Komponente mit Fokus auf Suchleiste
    beforeEnter: requireAuth,
  },
  {
    path: "/recipe/:id/:slug?",
    name: "Recipe",
    component: () =>
      import(/* webpackChunkName: "recipe" */ "../views/Recipe.vue"),
    beforeEnter: requireAuth,
    props: (route) => ({ id: route.params.id as string }),
  },
  {
    path: "/edit/:id/:slug?",
    name: "Edit",
    component: () => import(/* webpackChunkName: "edit" */ "../views/Edit.vue"),
    beforeEnter: requireRole("editor", "admin"),
    props: (route) => ({ id: route.params.id as string }),
  },
  {
    path: "/settings",
    name: "Settings",
    component: () =>
      import(/* webpackChunkName: "settings" */ "../views/Settings.vue"),
    beforeEnter: requireAuth,
  },
  {
    path: "/administration",
    name: "Administration",
    component: () =>
      import(/* webpackChunkName: "settings" */ "../views/Administration.vue"),
    beforeEnter: requireRole("admin"),
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

export default router;
