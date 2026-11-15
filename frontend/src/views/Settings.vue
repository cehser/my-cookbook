<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRecipeStore } from "@/store/recipeStore";
import { useToast } from "@/composables/useToast";
import { isEqualPlain } from "@/js/isEqualPlain";

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
    if (settings.value && !isEqualPlain(settings.value, store.settings)) {
      userEdited.value = true;
    }
  },
  { deep: true },
);

const changed = computed(() => !isEqualPlain(settings.value, store.settings));

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

async function saveChanges() {
  await store.saveSettings(settings.value);
  settings.value = JSON.parse(JSON.stringify(store.settings));
  userEdited.value = false;
  toast("Einstellungen gespeichert.", "success");
}
</script>

<template>
  <div id="settings">
    <BContainer>
      <h2 class="mt-3">Einstellungen</h2>

      <!-- Role badge -->
      <div class="mb-3">
        <span class="badge" :class="roleBadgeClass">{{ roleLabel }}</span>
      </div>

      <!-- Read-only toggle -->
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

      <!-- Expert mode toggle -->
      <BFormCheckbox v-model="settings.expert_mode" name="expert-mode" switch>
        Experten-Modus
      </BFormCheckbox>

      <!-- Expert mode info -->
      <BAlert
        v-if="settings.expert_mode"
        variant="info"
        :model-value="true"
        class="mt-2"
      >
        <h6 class="alert-heading">
          <i class="bi bi-info-circle-fill"></i> Experten-Modus aktiv
        </h6>
        <p class="mb-0">Folgende erweiterte Funktionen sind jetzt verfügbar:</p>
        <ul class="mb-0 mt-2">
          <li><strong>Galerie:</strong> YAML-Import von Rezepten</li>
          <li><strong>Rezeptansicht:</strong> YAML-Export einzelner Rezepte</li>
          <li>
            <strong>Verwaltung:</strong> YAML Import/Export für alle Rezepte
          </li>
        </ul>
      </BAlert>

      <!-- Save button -->
      <div class="mt-4 mb-4">
        <BButton variant="primary" :disabled="!changed" @click="saveChanges">
          Speichern
        </BButton>
      </div>
    </BContainer>
  </div>
</template>
