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
  if (route.path === "/") {
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
    <div :class="{ 'has-bottom-nav': showBottomNav }">
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
  --color-surface: #faf8f5; /* Warmes Off-White */
  --color-surface-raised: #ffffff;
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
  --bottom-nav-height: 56px;
  --fab-size: 56px;
  --fab-size-small: 44px;
  --action-btn-size: 44px; /* min touch target */
  --action-btn-size-small: 40px;
  --view-header-height: 48px;
}

/* --- Dark Mode Colors -------------------- */
[data-bs-theme="dark"] {
  --color-primary: #8fa85c;
  --color-primary-hover: #a3bc70;
  --color-primary-subtle: #2e3425;

  --color-surface: #1a1816;
  --color-surface-raised: #242120;
  --color-surface-overlay: rgba(0, 0, 0, 0.65);

  --color-chrome: #1e1c1a;
  --color-chrome-text: #e8e2db;
  --color-chrome-muted: rgba(232, 226, 219, 0.45);
  --color-chrome-hover: rgba(232, 226, 219, 0.1);
  --color-chrome-border: rgba(232, 226, 219, 0.08);

  --color-text: #e8e2db;
  --color-text-muted: #9a918a;
  --color-text-on-primary: #ffffff;

  --color-border: #3a3532;
  --color-divider: #2e2a27;

  --color-warning-bg: #3a2e1a;
  --color-warning-text: #f0c674;

  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-sm: 0 1px 4px rgba(0, 0, 0, 0.25);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.35);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.45);
  --shadow-fab: 0 4px 12px rgba(0, 0, 0, 0.45);
  --shadow-fab-hover: 0 6px 16px rgba(0, 0, 0, 0.55);
}

/* --- Bootstrap Overrides (cascade) ------- */
:root {
  --bs-font-sans-serif: var(--font-family);
  --bs-body-font-size: var(--font-size-base);
  --bs-body-bg: var(--color-surface);
  --bs-body-color: var(--color-text);
  --bs-border-color: var(--color-border);
  --bs-tertiary-bg: var(--color-divider);
  --bs-secondary-color: var(--color-text-muted);
  --bs-primary: var(--color-primary);
  --bs-primary-rgb: 107, 127, 59;
  --bs-link-color: var(--color-primary);
  --bs-link-hover-color: var(--color-primary-hover);
}

[data-bs-theme="dark"] {
  --bs-body-bg: var(--color-surface);
  --bs-body-color: var(--color-text);
  --bs-border-color: var(--color-border);
  --bs-tertiary-bg: var(--color-divider);
  --bs-secondary-color: var(--color-text-muted);
  --bs-primary: var(--color-primary);
  --bs-primary-rgb: 143, 168, 92;
}

/* --- Base Styles ------------------------- */
body {
  font-family: var(--font-family);
  background: var(--color-surface);
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* --- Global Utility Classes -------------- */
.has-bottom-nav {
  padding-bottom: var(--bottom-nav-height);
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
