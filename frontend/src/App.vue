<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useOnline, useColorMode } from "@vueuse/core";
import { useRecipeStore } from "@/store/recipeStore";
import { restoreSession } from "@/router";
import BottomNav from "@/components/layout/BottomNav.vue";

const route = useRoute();
const router = useRouter();
const store = useRecipeStore();
const isOnline = useOnline();

// Color mode: "light" | "dark" | "auto" (system)
// Persists to localStorage key "vueuse-color-scheme"
// Emits actual resolved mode to <html data-bs-theme="...">
useColorMode({
  attribute: "data-bs-theme",
  modes: { light: "light", dark: "dark", auto: "" },
  storageKey: "my-cookbook-color-mode",
});

const showBottomNav = computed(() => route.meta?.mode === "browsing");

onMounted(() => {
  store.loadSettings();
  store.loadRecipes();
  store.loadRecipePictures();
  store.loadFavorites();

  // Session Restore: redirect to last recipe if cold-starting on home
  // Use window.location.pathname (not route.path) because the router
  // may not have resolved the initial route yet at mount time.
  if (window.location.pathname === "/") {
    const savedPath = restoreSession();
    if (savedPath) {
      router.replace(savedPath);
    }
  }
});
</script>

<template>
  <BApp>
    <div v-if="!isOnline" class="offline-banner">
      <i class="bi bi-wifi-off me-1"></i>
      Offline
    </div>
    <div class="app-shell" :class="{ 'has-bottom-nav': showBottomNav }">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>
    <BottomNav v-if="showBottomNav" />
  </BApp>
</template>

<style>
/* ============================================
   DESIGN SYSTEM – my-cookbook
   ============================================
   Warm & natürlich, Light + Dark Mode
   ============================================ */

/* --- Color Palette ----------------------- */
:root {
  /* Brand */
  --color-primary: #6b7f3b; /* Olivgrün — Haupt-Akzent */
  --color-primary-hover: #5a6c32;
  --color-primary-subtle: #e8eddb;

  /* Surfaces */
  --color-surface: #f5f1eb; /* App-Content – einen Tick wärmer/dunkler */
  --color-surface-dim: #e8e4dc; /* Body außerhalb – deutlich abgesetzt */
  --color-surface-raised: #fefcf8; /* Warmes Weiß statt reines Weiß */
  --color-surface-overlay: rgba(0, 0, 0, 0.5);

  /* Chrome (Header, Bottom Nav) */
  --color-chrome: #3b3531; /* Warmes Dunkelbraun */
  --color-chrome-text: #f5f0eb;
  --color-chrome-muted: rgba(245, 240, 235, 0.5);
  --color-chrome-hover: rgba(245, 240, 235, 0.12);
  --color-chrome-border: rgba(245, 240, 235, 0.1);

  /* Text */
  --color-text: #2c2520; /* Warmes Schwarz */
  --color-text-muted: #7a716a;
  --color-text-on-primary: #ffffff;

  /* Borders & Dividers */
  --color-border: #e0dbd5;
  --color-divider: #ede9e3;

  /* Semantic */
  --color-danger: #c0392b;
  --color-warning: #e67e22;
  --color-warning-bg: #fdf3e6;
  --color-warning-text: #664d03;
  --color-success: #27ae60;
  --color-info: #2980b9;

  /* --- Typography Scale ------------------ */
  --font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-size-xs: 0.75rem; /* 12px – Badges, Timestamp */
  --font-size-sm: 0.8125rem; /* 13px – Chips, Labels */
  --font-size-base: 0.9375rem; /* 15px – Body (Küchen-lesbar) */
  --font-size-md: 1rem; /* 16px – Buttons, Inputs */
  --font-size-lg: 1.125rem; /* 18px – Card Titles */
  --font-size-xl: 1.5rem; /* 24px – Page Headings */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --line-height-tight: 1.2;
  --line-height-base: 1.5;

  /* --- Spacing Scale --------------------- */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;

  /* --- Radii ----------------------------- */
  --radius-circle: 50%;
  --radius-pill: 999px;
  --radius-lg: 16px;
  --radius-md: 10px;
  --radius-sm: 6px;

  /* --- Shadows --------------------------- */
  --shadow-xs: 0 1px 2px rgba(60, 50, 40, 0.06);
  --shadow-sm: 0 1px 4px rgba(60, 50, 40, 0.1);
  --shadow-md: 0 4px 12px rgba(60, 50, 40, 0.12);
  --shadow-lg: 0 8px 24px rgba(60, 50, 40, 0.16);
  --shadow-fab: 0 4px 12px rgba(60, 50, 40, 0.25);
  --shadow-fab-hover: 0 6px 16px rgba(60, 50, 40, 0.3);

  /* --- Transitions ----------------------- */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.25s ease;
  --transition-all-fast: all 0.15s ease;
  --transition-all-normal: all 0.25s ease;
  --transition-transform: transform 0.15s ease;

  /* --- Z-Index Layers -------------------- */
  --z-fab: 1000;
  --z-mobile-bar: 100;
  --z-overlay: 1050;
  --z-actions: 10;

  /* --- Dimensions ------------------------ */
  --app-max-width: 1200px;
  --bottom-nav-height: 56px;
  --fab-size: 56px;
  --fab-size-small: 44px;
  --action-btn-size: 44px; /* min touch target */
  --action-btn-size-small: 40px;
  --view-header-height: 48px;
}

/* --- Dark Mode Colors -------------------- */
html[data-bs-theme="dark"] {
  --color-primary: #8fa85c;
  --color-primary-hover: #a3bc70;
  --color-primary-subtle: #2e3425;

  --color-surface: #1e1b18;
  --color-surface-dim: #2a2622; /* Body außerhalb – heller als Content */
  --color-surface-raised: #2a2622;
  --color-surface-overlay: rgba(0, 0, 0, 0.65);

  --color-chrome: #161311;
  --color-chrome-text: #e8e2db;
  --color-chrome-muted: rgba(232, 226, 219, 0.45);
  --color-chrome-hover: rgba(232, 226, 219, 0.1);
  --color-chrome-border: rgba(232, 226, 219, 0.08);

  --color-text: #ece6df;
  --color-text-muted: #a09690;
  --color-text-on-primary: #ffffff;

  --color-border: #3d3733;
  --color-divider: #322d29;

  --color-warning-bg: #3a2e1a;
  --color-warning-text: #f0c674;

  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-sm: 0 1px 4px rgba(0, 0, 0, 0.25);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.35);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.45);
  --shadow-fab: 0 4px 12px rgba(0, 0, 0, 0.45);
  --shadow-fab-hover: 0 6px 16px rgba(0, 0, 0, 0.55);

  /* Bootstrap Overrides – warm statt blaugrau */
  --bs-body-bg: var(--color-surface);
  --bs-body-bg-rgb: 30, 27, 24;
  --bs-body-color: #ece6df;
  --bs-body-color-rgb: 236, 230, 223;
  --bs-emphasis-color: #ece6df;
  --bs-emphasis-color-rgb: 236, 230, 223;
  --bs-secondary-color: rgba(236, 230, 223, 0.75);
  --bs-secondary-color-rgb: 236, 230, 223;
  --bs-secondary-bg: #2a2622;
  --bs-secondary-bg-rgb: 42, 38, 34;
  --bs-tertiary-color: rgba(236, 230, 223, 0.5);
  --bs-tertiary-color-rgb: 236, 230, 223;
  --bs-tertiary-bg: #322d29;
  --bs-tertiary-bg-rgb: 50, 45, 41;
  --bs-border-color: #3d3733;
  --bs-border-color-translucent: rgba(255, 248, 240, 0.15);
  --bs-primary: #8fa85c;
  --bs-primary-rgb: 143, 168, 92;
  --bs-link-color: #8fa85c;
  --bs-link-hover-color: #a3bc70;
  --bs-link-color-rgb: 143, 168, 92;
  --bs-link-hover-color-rgb: 163, 188, 112;
  --bs-heading-color: inherit;
}

/* --- Bootstrap Overrides (cascade) ------- */
:root {
  --bs-font-sans-serif: var(--font-family);
  --bs-body-font-size: var(--font-size-base);
  --bs-body-bg: var(--color-surface);
  --bs-body-bg-rgb: 245, 241, 235;
  --bs-body-color: #2c2520;
  --bs-body-color-rgb: 44, 37, 32;
  --bs-border-color: #e0dbd5;
  --bs-tertiary-bg: #ede9e3;
  --bs-secondary-color: #7a716a;
  --bs-primary: #6b7f3b;
  --bs-primary-rgb: 107, 127, 59;
  --bs-link-color: #6b7f3b;
  --bs-link-hover-color: #5a6c32;
  --bs-link-color-rgb: 107, 127, 59;
  --bs-link-hover-color-rgb: 90, 108, 50;
}

/* Dark BS overrides handled in html[data-bs-theme="dark"] above */

/* --- Base Styles ------------------------- */
html {
  background: var(--color-surface);
}

body {
  font-family: var(--font-family);
  color: var(--color-text);
  background-color: var(--color-surface);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  /* iOS safe area: push content below status bar / notch */
  padding-top: env(safe-area-inset-top, 0);
}

/* Desktop: abgesetzter Hintergrund an den Seiten */
@media (min-width: 1248px) {
  body {
    background-color: var(--color-surface-dim);
  }
}

/* --- Global Utility Classes -------------- */
.app-shell {
  display: flow-root;
  max-width: var(--app-max-width);
  margin: 0 auto;
  background: var(--color-surface);
  min-height: 100vh;
}

@media (min-width: 1248px) {
  .app-shell {
    box-shadow: 0 0 24px rgba(0, 0, 0, 0.08);
  }
}

.has-bottom-nav {
  padding-bottom: calc(
    var(--bottom-nav-height) + env(safe-area-inset-bottom, 0) + var(--space-4)
  );
}

.section-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.offline-banner {
  background: var(--color-warning-bg);
  color: var(--color-warning-text);
  text-align: center;
  padding: var(--space-1) var(--space-4);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

/* --- View Header (Koch + Edit Modus) ----- */
.view-header {
  display: flex;
  align-items: center;
  height: var(--view-header-height);
  padding: 0 var(--space-3);
  background: var(--color-chrome);
  color: var(--color-chrome-text);
  position: sticky;
  top: 0;
  z-index: 1030;
}

.view-header-title {
  flex: 1;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0 var(--space-2);
}

.view-header .btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--action-btn-size);
  height: var(--action-btn-size);
  border: none;
  background: transparent;
  color: var(--color-chrome-text);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.view-header .btn-icon:hover {
  background: var(--color-chrome-hover);
}

.view-header .btn-icon:disabled {
  opacity: 0.4;
  cursor: default;
}

.view-header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

/* --- Page Transition --------------------- */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.18s ease;
}

.page-enter-from {
  opacity: 0;
}

.page-leave-to {
  opacity: 0;
}
</style>
