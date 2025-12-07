<template>
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark sticky-top">
    <div class="container-fluid">
      <router-link class="navbar-brand" to="/">Kochbuch</router-link>
      <button
        class="navbar-toggler"
        type="button"
        @click="toggleMenu"
        aria-controls="mainmenu"
        :aria-expanded="isMenuOpen"
        aria-label="Toggle navigation"
      >
        <span class="navbar-toggler-icon"></span>
      </button>
      <div
        id="mainmenu"
        class="collapse navbar-collapse"
        :class="{ show: isMenuOpen }"
      >
        <ul class="navbar-nav">
          <li class="nav-item">
            <router-link class="nav-link" to="/" exact>Galerie</router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" :to="'/recipe/' + selected"
              >Rezept</router-link
            >
          </li>
          <li class="nav-item" v-if="!read_only">
            <router-link class="nav-link" :to="'/edit/' + selected"
              >Bearbeiten</router-link
            >
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/settings"
              >Einstellungen</router-link
            >
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/administration"
              >Verwaltung</router-link
            >
          </li>
          <slot></slot>
        </ul>
      </div>
      <div
        id="loading-spinner"
        class="spinner-border spinner-border-sm text-light d-none"
        role="status"
      >
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { useRoute } from "vue-router";

interface Recipe {
  recipe_name: string;
  [key: string]: any;
}

const props = withDefaults(
  defineProps<{
    selected?: number;
    read_only?: boolean;
    recipes_list?: Recipe[];
  }>(),
  {
    selected: 0,
    read_only: true,
  },
);

const emit = defineEmits<{
  "update:selected": [value: number];
}>();

const route = useRoute();
const data_selected = ref(0);
const isMenuOpen = ref(false);

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
};

watch(data_selected, (value) => {
  emit("update:selected", value);
});

watch(
  () => route.path,
  () => {
    // Close mobile menu when route changes
    isMenuOpen.value = false;
  },
);

onMounted(() => {
  data_selected.value = props.selected;
});
</script>

<style scoped>
.router-link-active {
  color: #ffffff !important;
}

/* Mobile improvements */
@media (max-width: 768px) {
  .navbar-nav {
    padding: 0.5rem 0;
  }

  .nav-link {
    padding: 0.75rem 1rem;
    font-size: 1.1rem;
  }

  /* Better touch targets for action buttons in navbar slot */
  :deep(.btn) {
    min-width: 44px;
    min-height: 44px;
  }
}
</style>
