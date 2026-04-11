<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useOnline } from "@vueuse/core";
import { useRecipeStore } from "@/store/recipeStore";
import BottomNav from "@/components/layout/BottomNav.vue";

const route = useRoute();
const store = useRecipeStore();
const isOnline = useOnline();

const showBottomNav = computed(() => route.meta?.mode === "browsing");

onMounted(() => {
  store.loadSettings();
  store.loadRecipes();
  store.loadRecipePictures();
  store.loadFavorites();
});
</script>

<template>
  <BApp>
    <div v-if="!isOnline" class="offline-banner">
      <i class="bi bi-wifi-off me-1"></i>
      Offline
    </div>
    <div :class="{ 'has-bottom-nav': showBottomNav }">
      <router-view />
    </div>
    <BottomNav v-if="showBottomNav" />
  </BApp>
</template>

<style>
/* ============================================
   DESIGN TOKENS - Global CSS Custom Properties
   ============================================ */
:root {
  /* Bottom Nav */
  --bottom-nav-height: 56px;

  /* Border Radii */
  --radius-circle: 50%;
  --radius-lg: 24px;
  --radius-md: 12px;
  --radius-sm: 8px;

  /* Box Shadows */
  --shadow-xs: 0 1px 3px rgba(0, 0, 0, 0.08);
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.15);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-fab: 0 4px 8px rgba(0, 0, 0, 0.3);
  --shadow-fab-hover: 0 6px 12px rgba(0, 0, 0, 0.4);

  /* Transitions */
  --transition-fast: 0.2s ease;
  --transition-normal: 0.3s ease;
  --transition-all-fast: all 0.2s ease;
  --transition-all-normal: all 0.3s ease;
  --transition-transform: transform 0.2s ease;

  /* Z-Index Layers */
  --z-fab: 1000;
  --z-mobile-bar: 100;
  --z-overlay: 1050;
  --z-actions: 10;

  /* Breakpoints (for reference, use in @media) */
  --bp-mobile-max: 767px;
  --bp-tablet-min: 768px;
  --bp-desktop-min: 1024px;

  /* FAB Dimensions */
  --fab-size: 56px;
  --fab-size-small: 44px;
  --action-btn-size: 40px;
  --action-btn-size-small: 36px;
}

.has-bottom-nav {
  padding-bottom: var(--bottom-nav-height);
}

.offline-banner {
  background: #664d03;
  color: #fff3cd;
  text-align: center;
  padding: 4px 16px;
  font-size: 0.8rem;
  font-weight: 500;
}

.view-header {
  display: flex;
  align-items: center;
  height: 48px;
  padding: 0 12px;
  background: var(--bs-dark, #212529);
  color: #fff;
  position: sticky;
  top: 0;
  z-index: 1030;
}

.view-header-title {
  flex: 1;
  font-size: 1rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0 8px;
}

.view-header .btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  color: #fff;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.view-header .btn-icon:hover {
  background: rgba(255, 255, 255, 0.1);
}

.view-header .btn-icon:disabled {
  opacity: 0.4;
  cursor: default;
}

.view-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
