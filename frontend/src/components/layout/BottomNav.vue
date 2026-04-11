<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();

const tabs = [
  { name: "Gallery", path: "/", icon: "bi-house", label: "Home" },
  { name: "Search", path: "/search", icon: "bi-search", label: "Suche" },
  {
    name: "Favorites",
    path: "/favorites",
    icon: "bi-star",
    label: "Favoriten",
  },
  {
    name: "Settings",
    path: "/settings",
    icon: "bi-person",
    label: "Profil",
  },
] as const;

const activeTab = computed(() => {
  const name = route.name;
  // Administration is a sub-page of Profile/Settings
  if (name === "Administration") return "Settings";
  return tabs.find((t) => t.name === name)?.name ?? "Gallery";
});
</script>

<template>
  <nav class="bottom-nav" aria-label="Hauptnavigation">
    <router-link
      v-for="tab in tabs"
      :key="tab.name"
      :to="tab.path"
      class="bottom-nav-item"
      :class="{ active: activeTab === tab.name }"
      :aria-current="activeTab === tab.name ? 'page' : undefined"
    >
      <i class="bi" :class="tab.icon"></i>
      <span>{{ tab.label }}</span>
    </router-link>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 56px;
  background: var(--bs-dark, #212529);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 1040;
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.bottom-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 100%;
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  font-size: 0.65rem;
  gap: 2px;
  transition: color var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.bottom-nav-item .bi {
  font-size: 1.25rem;
}

.bottom-nav-item.active {
  color: #ffffff;
}

.bottom-nav-item:hover {
  color: rgba(255, 255, 255, 0.8);
}

.bottom-nav-item.active .bi {
  transform: scale(1.1);
}
</style>
