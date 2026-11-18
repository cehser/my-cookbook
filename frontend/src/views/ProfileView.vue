<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useColorMode } from "@vueuse/core";
import { useRecipeStore } from "@/store/recipeStore";
import { logout } from "@/auth/oidc";

declare const __COMMIT_HASH__: string;
const commitHash = __COMMIT_HASH__;

const router = useRouter();
const recipeStore = useRecipeStore();
const { store: colorMode } = useColorMode({
  attribute: "data-bs-theme",
  storageKey: "my-cookbook-color-mode",
});

const role = computed(() => recipeStore.settings.role);

const roleBadgeClass = computed(() => {
  if (role.value === "admin") return "bg-danger";
  if (role.value === "editor") return "bg-success";
  return "bg-secondary";
});

const roleLabel = computed(() => {
  if (role.value === "admin") return "Administrator";
  if (role.value === "editor") return "Bearbeiter";
  return "Nur Lesen";
});

const isAdmin = computed(() => role.value === "admin");

async function handleLogout() {
  if (!window.confirm("Möchtest du dich wirklich abmelden?")) return;
  await logout();
}
</script>

<template>
  <div id="profile-view">
    <BContainer class="py-3">
      <!-- User Info -->
      <div class="d-flex align-items-center gap-3 mb-4">
        <div
          class="profile-avatar d-flex align-items-center justify-content-center"
        >
          <i class="bi bi-person-fill"></i>
        </div>
        <div>
          <span class="badge" :class="roleBadgeClass">{{ roleLabel }}</span>
        </div>
      </div>

      <!-- Appearance -->
      <h6 class="section-label">Erscheinungsbild</h6>

      <div class="settings-card mb-3">
        <div class="theme-toggle">
          <button
            :class="['theme-btn', { active: colorMode === 'light' }]"
            @click="colorMode = 'light'"
          >
            <i class="bi bi-sun-fill"></i>
            Hell
          </button>
          <button
            :class="['theme-btn', { active: colorMode === 'dark' }]"
            @click="colorMode = 'dark'"
          >
            <i class="bi bi-moon-fill"></i>
            Dunkel
          </button>
          <button
            :class="['theme-btn', { active: colorMode === 'auto' }]"
            @click="colorMode = 'auto'"
          >
            <i class="bi bi-circle-half"></i>
            System
          </button>
        </div>
      </div>

      <!-- Admin -->
      <template v-if="isAdmin">
        <h6 class="section-label">Administration</h6>
        <div class="settings-card mb-4">
          <button
            class="profile-link-item"
            @click="router.push('/administration')"
          >
            <i class="bi bi-shield-lock"></i>
            <span>Benutzerverwaltung & Share-Links</span>
            <i class="bi bi-chevron-right ms-auto"></i>
          </button>
        </div>
      </template>

      <!-- Logout -->
      <div class="mt-3 mb-4">
        <button class="profile-link-item text-danger" @click="handleLogout">
          <i class="bi bi-box-arrow-left"></i>
          <span>Abmelden</span>
        </button>
      </div>

      <!-- Version -->
      <p class="text-center text-muted" style="font-size: 0.7rem; opacity: 0.5">
        Version: {{ commitHash }}
      </p>
    </BContainer>
  </div>
</template>

<style scoped>
.profile-avatar {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-circle);
  background: var(--color-divider);
  font-size: var(--font-size-xl);
  color: var(--color-text-muted);
}

.settings-card {
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.profile-link-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
  font-size: var(--font-size-base);
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
}

.profile-link-item:hover {
  background: var(--color-divider);
}

.theme-toggle {
  display: flex;
  gap: var(--space-2);
}

.theme-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}

.theme-btn:hover {
  background: var(--color-divider);
}

.theme-btn.active {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}
</style>
