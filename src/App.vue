<template>
  <BApp>
    <router-view />
  </BApp>
</template>

<script>
import { BApp } from "bootstrap-vue-next";

export default {
  components: {
    BApp,
  },
  mounted() {
    this.$store.dispatch("loadSettings");
    this.$store.dispatch("loadRecipes");
    this.$store.dispatch("loadRecipePictures");
    this.$store.dispatch("loadFavorites");
  },
};
</script>

<style>
/* ============================================
   DESIGN TOKENS - Global CSS Custom Properties
   ============================================ */
:root {
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
</style>
