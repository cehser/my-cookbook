<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useRecipeStore } from "@/store/recipeStore";
import { useToast } from "@/composables/useToast";
import { logout } from "@/auth/oidc";
import deepEqual from "deep-equal";

const router = useRouter();
const store = useRecipeStore();
const { toast } = useToast();

// Local copy of settings for editing
const settings = ref(JSON.parse(JSON.stringify(store.settings)));
const userEdited = ref(false);

const store_settings = computed(() => store.settings);

// Watch store settings — update local copy unless user is editing
watch(
  () => store.settings,
  (newVal) => {
    if (!userEdited.value) {
      settings.value = JSON.parse(JSON.stringify(newVal));
    }
  },
  { deep: true },
);

// Watch local settings — mark as edited when they diverge
watch(
  settings,
  () => {
    if (settings.value && !deepEqual(settings.value, store.settings)) {
      userEdited.value = true;
    }
  },
  { deep: true },
);

const changed = computed(() => !deepEqual(settings.value, store.settings));

const roleBadgeClass = computed(() => {
  const role = settings.value?.role || store.settings?.role;
  if (role === "admin") return "bg-danger";
  if (role === "editor") return "bg-success";
  return "bg-secondary";
});

const roleLabel = computed(() => {
  const role = settings.value?.role || store.settings?.role;
  if (role === "admin") return "Administrator";
  if (role === "editor") return "Bearbeiter";
  return "Nur Lesen";
});

const isAdmin = computed(() => store.settings?.role === "admin");

async function saveChanges() {
  await store.saveSettings(settings.value);
  settings.value = JSON.parse(JSON.stringify(store.settings));
  userEdited.value = false;
  toast("Einstellungen gespeichert.", "success");
}

async function handleLogout() {
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

      <!-- Settings -->
      <h6 class="section-label">Einstellungen</h6>

      <div class="settings-card mb-3">
        <BFormCheckbox
          v-model="settings.read_only"
          name="read-only"
          switch
          :disabled="
            store_settings.role === 'pending' ||
            store_settings.role === 'readonly'
          "
        >
          Nur lesen
        </BFormCheckbox>

        <BFormCheckbox v-model="settings.expert_mode" name="expert-mode" switch>
          Experten-Modus
        </BFormCheckbox>

        <BAlert
          v-if="settings.expert_mode"
          variant="info"
          :model-value="true"
          class="mt-2 mb-0"
        >
          <small>
            <i class="bi bi-info-circle-fill"></i>
            YAML-Import/Export, erweiterte Verwaltungsoptionen.
          </small>
        </BAlert>
      </div>

      <!-- AI Model -->
      <h6 class="section-label">AI-Integration</h6>

      <div class="settings-card mb-3">
        <label for="gpt_model" class="form-label mb-1">GPT-Modell</label>
        <input
          id="gpt_model"
          v-model="settings.gpt_model"
          list="gpt-model-options"
          autocomplete="off"
          placeholder="z.B. gpt-5.4-mini"
          class="form-control form-control-sm"
          @input="userEdited = true"
        />
        <datalist id="gpt-model-options">
          <option value="gpt-5.4-nano">GPT-5.4 nano</option>
          <option value="gpt-5.4-mini">GPT-5.4 mini</option>
          <option value="gpt-5.4">GPT-5.4</option>
          <option value="gpt-5-nano">GPT-5 nano</option>
          <option value="gpt-5-mini">GPT-5 mini</option>
          <option value="gpt-5">GPT-5</option>
          <option value="gpt-4.1-nano">GPT-4.1 nano</option>
          <option value="gpt-4.1-mini">GPT-4.1 mini</option>
          <option value="gpt-4.1">GPT-4.1</option>
        </datalist>
      </div>

      <!-- Save -->
      <BButton
        variant="primary"
        size="sm"
        :disabled="!changed"
        @click="saveChanges"
        class="mb-4"
      >
        <i class="bi bi-check-lg"></i> Speichern
      </BButton>

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
</style>
