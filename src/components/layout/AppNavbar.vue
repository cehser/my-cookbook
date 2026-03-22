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
        <ul class="navbar-nav me-auto">
          <li class="nav-item">
            <router-link class="nav-link" to="/" exact>
              <i class="bi bi-grid-3x3-gap"></i> Galerie
            </router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/favorites">
              <i class="bi bi-star"></i> Favoriten
            </router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/search">
              <i class="bi bi-search"></i> Suche
            </router-link>
          </li>
          <slot></slot>
        </ul>
        <ul class="navbar-nav">
          <!-- User display + Logout -->
          <li v-if="userName" class="nav-item dropdown">
            <a
              class="nav-link dropdown-toggle"
              href="#"
              id="userDropdown"
              role="button"
              @click="toggleUserDropdown"
              aria-expanded="false"
            >
              <i class="bi bi-person-circle"></i>
              <span class="ms-1">{{ userName }}</span>
            </a>
            <ul
              class="dropdown-menu dropdown-menu-end"
              :class="{ show: isUserDropdownOpen }"
              aria-labelledby="userDropdown"
            >
              <li>
                <span class="dropdown-item-text text-muted small">
                  {{ userEmail || userName }}
                </span>
              </li>
              <li><hr class="dropdown-divider" /></li>
              <li>
                <a class="dropdown-item" href="#" @click.prevent="doLogout">
                  <i class="bi bi-box-arrow-right"></i> Abmelden
                </a>
              </li>
            </ul>
          </li>
          <li class="nav-item dropdown">
            <a
              class="nav-link dropdown-toggle"
              href="#"
              id="adminDropdown"
              role="button"
              @click="toggleAdminDropdown"
              aria-expanded="false"
            >
              <i class="bi bi-gear"></i>
            </a>
            <ul
              class="dropdown-menu dropdown-menu-end"
              :class="{ show: isAdminDropdownOpen }"
              aria-labelledby="adminDropdown"
            >
              <li>
                <router-link class="dropdown-item" to="/settings">
                  <i class="bi bi-sliders"></i> Einstellungen
                </router-link>
              </li>
              <li>
                <router-link class="dropdown-item" to="/administration">
                  <i class="bi bi-tools"></i> Verwaltung
                </router-link>
              </li>
              <li v-if="!read_only"><hr class="dropdown-divider" /></li>
              <li v-if="!read_only">
                <a class="dropdown-item" href="#" @click.prevent="cloudSync">
                  <i class="bi bi-cloud-arrow-up-down"></i> Cloud-Sync
                </a>
              </li>
              <li><hr class="dropdown-divider" /></li>
              <li>
                <a
                  class="dropdown-item"
                  href="#"
                  @click.prevent="toggleExpertMode"
                >
                  <i
                    class="bi"
                    :class="expertMode ? 'bi-check-square' : 'bi-square'"
                  ></i>
                  Experten-Modus
                </a>
              </li>
            </ul>
          </li>
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
import { ref, watch, onMounted, computed } from "vue";
import { useRoute } from "vue-router";
import { useStore } from "vuex";
import { getUser, logout } from "@/auth/oidc";
import type { Recipe } from "@/types/recipe";

const props = withDefaults(
  defineProps<{
    selected?: string;
    read_only?: boolean;
    recipes_list?: Recipe[];
  }>(),
  {
    selected: '',
    read_only: true,
  },
);

const emit = defineEmits<{
  "update:selected": [value: string];
  "cloud-sync": [];
}>();

const route = useRoute();
const store = useStore();
const data_selected = ref('');
const isMenuOpen = ref(false);
const isAdminDropdownOpen = ref(false);
const isUserDropdownOpen = ref(false);
const userName = ref<string | null>(null);
const userEmail = ref<string | null>(null);

const expertMode = computed(() => store.state.settings.expert_mode);

// Load OIDC user info
onMounted(async () => {
  data_selected.value = props.selected;
  try {
    const user = await getUser();
    if (user?.profile) {
      userName.value = user.profile.preferred_username || user.profile.name || user.profile.sub;
      userEmail.value = user.profile.email || null;
    }
  } catch (e) {
    console.warn('[Auth] Could not load user info:', e);
  }
});

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
};

const toggleAdminDropdown = () => {
  isAdminDropdownOpen.value = !isAdminDropdownOpen.value;
  isUserDropdownOpen.value = false;
};

const toggleUserDropdown = () => {
  isUserDropdownOpen.value = !isUserDropdownOpen.value;
  isAdminDropdownOpen.value = false;
};

const doLogout = async () => {
  try {
    await logout();
  } catch (e) {
    console.error('[Auth] Logout failed:', e);
    window.location.href = '/';
  }
};

const toggleExpertMode = () => {
  store.commit("setSettings", {
    ...store.state.settings,
    expert_mode: !store.state.settings.expert_mode,
  });
};

const cloudSync = () => {
  emit("cloud-sync");
};

watch(data_selected, (value) => {
  emit("update:selected", value);
});

watch(
  () => route.path,
  () => {
    // Close mobile menu when route changes
    isMenuOpen.value = false;
    isAdminDropdownOpen.value = false;
    isUserDropdownOpen.value = false;
  },
);
</script>

<style scoped>
.router-link-active {
  color: #ffffff !important;
}

.dropdown-menu {
  background-color: #343a40;
  border-color: #495057;
  right: 0;
  left: auto;
  min-width: 200px;
}

.dropdown-item {
  color: #ffffff;
}

.dropdown-item:hover,
.dropdown-item:focus {
  background-color: #495057;
  color: #ffffff;
}

.dropdown-divider {
  border-color: #495057;
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

  .dropdown-menu {
    position: static !important;
    transform: none !important;
    border: none;
    background-color: #212529;
  }
}
</style>
