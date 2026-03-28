<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import AppNavbar from "@/components/layout/AppNavbar.vue";
import { useRecipeHelper } from "@/composables/useRecipeHelper";
import { useRecipeStore } from "@/store/recipeStore";
import { useToast } from "@/composables/useToast";
import deepEqual from "deep-equal";
import { recipeUrl } from "@/js/slug";

const router = useRouter();
const store = useRecipeStore();
const { toast } = useToast();

const recipeId = ref("");
const { recipes_list } = useRecipeHelper({ recipeId });

// Local copy of settings for editing
const settings = ref(JSON.parse(JSON.stringify(store.settings)));
const userEdited = ref(false);

const store_settings = computed(() => store.settings);
const recipes = computed(() => store.recipes);

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

function navSelected(uuid: string) {
  const recipe = store.recipes.find((r) => r.recipe_uuid === uuid);
  router.push(recipeUrl(uuid, recipe?.recipe_name));
}

async function saveChanges() {
  await store.saveSettings(settings.value);
  settings.value = JSON.parse(JSON.stringify(store.settings));
  userEdited.value = false;
  toast("Einstellungen", "Gespeichert.", "success");
}
</script>

<template>
  <div id="settings">
    <AppNavbar
      @input="navSelected"
      :recipes_list="recipes_list"
      selected=""
      :read_only="store_settings.read_only"
    />
    <BContainer>
      <h2>Einstellungen</h2>

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

      <!-- GPT Model -->
      <div class="mt-4">
        <h5>AI-Integration</h5>
        <div class="form-group">
          <label for="gpt_model" class="col-form-label">GPT-Modell</label>
          <input
            id="gpt_model"
            v-model="settings.gpt_model"
            list="gpt-model-options"
            autocomplete="off"
            placeholder="z.B. gpt-5.4-mini"
            class="form-control"
            @input="userEdited = true"
          />
          <datalist id="gpt-model-options">
            <option value="gpt-5.4-nano">
              GPT-5.4 nano – günstigstes GPT-5.4-Modell
            </option>
            <option value="gpt-5.4-mini">
              GPT-5.4 mini – stark, schnell, günstig
            </option>
            <option value="gpt-5.4">GPT-5.4 – bestes Frontier-Modell</option>
            <option value="gpt-5-nano">GPT-5 nano – schnellstes GPT-5</option>
            <option value="gpt-5-mini">
              GPT-5 mini – near-frontier, günstig
            </option>
            <option value="gpt-5">GPT-5 – leistungsstarkes Reasoning</option>
            <option value="gpt-4.1-nano">
              GPT-4.1 nano – schnell, sparsam
            </option>
            <option value="gpt-4.1-mini">GPT-4.1 mini – kompakt</option>
            <option value="gpt-4.1">
              GPT-4.1 – bestes Non-Reasoning-Modell
            </option>
            <option value="gpt-4o-mini">GPT-4o mini – älter, günstig</option>
            <option value="gpt-4o">GPT-4o – älter, flexibel</option>
          </datalist>
          <small class="form-text text-muted">
            Wähle ein Modell aus der Liste oder gib eine eigene ID ein.
          </small>
        </div>
      </div>

      <!-- Save button -->
      <div class="mt-4 mb-4">
        <BButton variant="primary" :disabled="!changed" @click="saveChanges">
          Speichern
        </BButton>
      </div>
    </BContainer>
  </div>
</template>
