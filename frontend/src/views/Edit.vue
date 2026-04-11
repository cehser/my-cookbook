<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from "vue";
import { useRouter, useRoute } from "vue-router";
import { onKeyStroke } from "@vueuse/core";
import { useDebouncedRefHistory } from "@vueuse/core";
import Sortable from "sortablejs";
import SectionCard from "@/components/edit/SectionCard.vue";
import RecipeDisplay from "@/components/recipe/display/RecipeDisplay.vue";
import { useRecipeHelper } from "@/composables/useRecipeHelper";
import { useToast } from "@/composables/useToast";
import { useDraft } from "@/composables/useDraft";
import { useSectionEditor } from "@/composables/useSectionEditor";
import { useIngredientEditor } from "@/composables/useIngredientEditor";
import { useStepEditor } from "@/composables/useStepEditor";
import { useRecipeStore } from "@/store/recipeStore";
import jsyaml from "js-yaml";

const props = defineProps<{ id: string }>();

const router = useRouter();
const route = useRoute();
const store = useRecipeStore();
const { toast } = useToast();

const idRef = computed(() => props.id);
const {
  current_recipe,
  isLoaded,
  do_recalc,
  selected,
  picture_src,
  yields_unit,
  yields_value,
  setYieldsUnit,
  setYieldsValue,
  loadRecipe,
} = useRecipeHelper({ recipeId: idRef });

// --- Editor CRUD Composables ---
const { addSection, updateSectionName, deleteSection, moveSection } =
  useSectionEditor(current_recipe);
const {
  ingredient_units,
  addIngredient,
  deleteIngredient,
  updateIngredient,
  reorderIngredientInSection,
  crossMoveIngredient,
} = useIngredientEditor(current_recipe);
const {
  addStep,
  deleteStep,
  updateStepText,
  updateStepNotes,
  reorderStepInSection,
  crossMoveStep,
} = useStepEditor(current_recipe);

// Override do_recalc default
do_recalc.value = false;

// Snapshot of loaded state for dirty-checking
const loadedSnapshot = ref<string>("");

const isDirty = computed(() => {
  if (!current_recipe.value || !loadedSnapshot.value) return false;
  return JSON.stringify(current_recipe.value) !== loadedSnapshot.value;
});

// --- Draft & Unsaved Guard ---
const { hasDraft, restoreDraft, discardDraft } = useDraft(
  idRef,
  current_recipe,
  isDirty,
);

// --- Undo / Redo ---
const { undo, redo, canUndo, canRedo, pause, resume, clear, commit } =
  useDebouncedRefHistory(current_recipe, {
    deep: true,
    debounce: 500,
    capacity: 50,
  });

// Settle history when recipe finishes loading
pause();
watch(
  isLoaded,
  (ready) => {
    if (ready && current_recipe.value) {
      loadedSnapshot.value = JSON.stringify(current_recipe.value);
      commit();
      clear();
      resume();

      // Auto-restore draft when navigated with ?draft=1
      if (route.query.draft === "1" && hasDraft.value) {
        restoreDraft();
        commit();
        clear();
        router.replace({ ...route, query: {} });
      }
    } else {
      pause();
    }
  },
  { immediate: true },
);

// --- Keyboard Shortcuts ---
onKeyStroke("s", (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    saveRecipe();
  }
});
onKeyStroke("z", (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && canUndo.value) {
    e.preventDefault();
    undo();
  }
});
onKeyStroke("y", (e) => {
  if ((e.ctrlKey || e.metaKey) && canRedo.value) {
    e.preventDefault();
    redo();
  }
});
onKeyStroke("z", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && canRedo.value) {
    e.preventDefault();
    redo();
  }
});

// Data
const file = ref<File | null>(null);
const delete_image = ref(false);
const inputFoto = ref<{ reset: () => void } | null>(null);
const showYaml = ref(false);
const showPreview = ref(false);

// Computed — JSON roundtrip forces Vue to track all nested properties
const yaml = computed(() =>
  jsyaml.dump(JSON.parse(JSON.stringify(current_recipe.value))),
);

const settings = computed(() => store.settings);

// Combined source field — heuristic: starts with http → source_url, else → source_book
const source = computed({
  get() {
    return (
      current_recipe.value?.source_url ||
      current_recipe.value?.source_book ||
      ""
    );
  },
  set(val: string) {
    if (!current_recipe.value) return;
    if (val.match(/^https?:\/\//i)) {
      current_recipe.value.source_url = val;
      current_recipe.value.source_book = "";
    } else {
      current_recipe.value.source_book = val;
      current_recipe.value.source_url = "";
    }
  },
});

// Watch
watch(file, (newFile) => {
  preview_image(newFile);
});

// Methods
function clearFile() {
  inputFoto.value?.reset();
}

function preview_image(f: File | null) {
  const preview = document.querySelector(
    "#image-preview",
  ) as HTMLImageElement | null;
  if (preview) {
    preview.src = f ? URL.createObjectURL(f) : "";
  }
}

function saveRecipe() {
  if (!current_recipe.value) return;
  if (isDirty.value || file.value || delete_image.value) {
    current_recipe.value.lastUpdated = new Date().toISOString();

    if (file.value) {
      store
        .setRecipePicture({
          uuid: current_recipe.value.recipe_uuid,
          picture: file.value,
        })
        .catch(() => toast("Bildfehler.", "danger"));
    }

    if (delete_image.value) {
      store
        .setRecipePicture({
          uuid: current_recipe.value.recipe_uuid,
          picture: null,
        })
        .then(() => (delete_image.value = false))
        .catch(() => toast("Bildfehler.", "danger"));
    }
    store
      .setRecipe({
        index: selected.value,
        recipe: current_recipe.value,
      })
      .then(() => {
        discardDraft();
        loadedSnapshot.value = JSON.stringify(current_recipe.value);
        toast("Gespeichert.", "success");
      })
      .catch(() => toast("Fehler.", "danger"));
  } else {
    toast("Unverändert.", "success");
  }
}

async function revertRecipe() {
  if (!current_recipe.value) return;
  if (!isDirty.value) return;
  if (!window.confirm("Alle Änderungen verwerfen?")) return;
  const original = store.recipes[selected.value];
  if (original) {
    // loadRecipe sets isLoaded=false → watch pauses, then isLoaded=true → watch resumes
    await loadRecipe(original);
    discardDraft();
    toast("Zurückgesetzt.", "info");
  }
}

// --- DnD: Section reorder ---
const sectionContainerRef = ref<HTMLElement>();
let sectionSortable: Sortable | null = null;

function initSectionSortable() {
  sectionSortable?.destroy();
  sectionSortable = null;
  if (sectionContainerRef.value) {
    sectionSortable = Sortable.create(sectionContainerRef.value, {
      handle: ".section-drag-handle",
      animation: 150,
      ghostClass: "sortable-ghost",
      dragClass: "sortable-drag",
      onUpdate(evt) {
        if (!current_recipe.value) return;
        const { item, from, oldIndex, newIndex } = evt;
        // Revert DOM — let Vue re-render
        from.removeChild(item);
        from.insertBefore(item, from.children[oldIndex!] || null);
        const [moved] = current_recipe.value.sections.splice(oldIndex!, 1);
        current_recipe.value.sections.splice(newIndex!, 0, moved);
      },
    });
  }
}

// Re-init when recipe becomes available (ref is inside v-if)
watch(current_recipe, (val) => {
  if (val) {
    nextTick(() => initSectionSortable());
  }
});

onMounted(() => {
  nextTick(() => initSectionSortable());
});

onBeforeUnmount(() => {
  sectionSortable?.destroy();
  sectionSortable = null;
});
</script>

<template>
  <div id="edit-v2">
    <div class="view-header">
      <button class="btn-icon" @click="router.back()" title="Abbrechen">
        <i class="bi bi-x-lg"></i>
      </button>
      <span class="view-header-title">Bearbeiten</span>
      <div class="view-header-actions">
        <button
          class="btn-icon"
          :disabled="!canUndo"
          title="Rückgängig (Ctrl+Z)"
          @click="undo()"
        >
          <i class="bi bi-arrow-counterclockwise"></i>
        </button>
        <button
          class="btn-icon"
          :disabled="!canRedo"
          title="Wiederherstellen (Ctrl+Y)"
          @click="redo()"
        >
          <i class="bi bi-arrow-clockwise"></i>
        </button>
        <button
          class="btn-icon"
          :disabled="!isDirty"
          title="Änderungen verwerfen"
          @click="revertRecipe"
        >
          <i class="bi bi-x-circle"></i>
        </button>
        <button class="btn-icon" title="Vorschau" @click="showPreview = true">
          <i class="bi bi-eye"></i>
        </button>
        <button
          class="btn-icon"
          @click="saveRecipe"
          title="Speichern (Ctrl+S)"
          :disabled="!isDirty && !file && !delete_image"
        >
          <i class="bi bi-check-lg"></i>
        </button>
      </div>
    </div>

    <BContainer v-if="current_recipe" class="mt-3 mb-5">
      <!-- Draft Recovery Banner -->
      <BAlert v-if="hasDraft" variant="warning" :model-value="true">
        Es gibt einen ungespeicherten Entwurf.
        <BButton
          size="sm"
          variant="warning"
          @click="
            restoreDraft();
            commit();
            clear();
          "
          >Wiederherstellen</BButton
        >
        <BButton size="sm" variant="outline-secondary" @click="discardDraft"
          >Verwerfen</BButton
        >
      </BAlert>

      <datalist id="ingredient-units-list">
        <option
          v-for="unit in ingredient_units"
          :key="unit"
          :value="unit"
        ></option>
      </datalist>

      <!-- Titel & Untertitel — nebeneinander auf lg+ -->
      <BRow class="mb-2">
        <BCol lg="6">
          <label for="v2-name" class="form-label mb-0">Titel</label>
          <BFormInput
            id="v2-name"
            size="sm"
            placeholder="Namen eingeben"
            v-model="current_recipe.recipe_name"
          />
        </BCol>
        <BCol lg="6">
          <label for="v2-subtitle" class="form-label mb-0">Untertitel</label>
          <BFormInput
            id="v2-subtitle"
            size="sm"
            placeholder="Untertitel eingeben"
            v-model="current_recipe.subtitle"
          />
        </BCol>
      </BRow>

      <!-- Metadaten-Sektion (einklappbar) -->
      <details class="mt-3 mb-2">
        <summary class="h3-summary">
          <h3 class="d-inline">Metadaten</h3>
        </summary>

        <BRow class="mt-2">
          <BCol lg="6">
            <label for="v2-author" class="form-label mb-0">Autor</label>
            <BFormInput
              id="v2-author"
              size="sm"
              placeholder="Autor eingeben"
              v-model="current_recipe.author"
            />
          </BCol>
          <BCol lg="6">
            <label for="v2-source" class="form-label mb-0">Quelle</label>
            <BFormInput
              id="v2-source"
              size="sm"
              placeholder="URL oder Buchtitel"
              v-model="source"
            />
          </BCol>
        </BRow>

        <BRow class="mt-2">
          <BCol sm="6" lg="3">
            <label for="v2-prep-time" class="form-label mb-0"
              >Vorbereitung</label
            >
            <BFormInput
              id="v2-prep-time"
              size="sm"
              placeholder="15 Min."
              v-model="current_recipe.prep_time"
            />
          </BCol>
          <BCol sm="6" lg="3">
            <label for="v2-cook-time" class="form-label mb-0"
              >Koch-/Bratzeit</label
            >
            <BFormInput
              id="v2-cook-time"
              size="sm"
              placeholder="30 Min."
              v-model="current_recipe.cook_time"
            />
          </BCol>
          <BCol sm="6" lg="3">
            <label for="v2-bake-time" class="form-label mb-0">Backzeit</label>
            <BFormInput
              id="v2-bake-time"
              size="sm"
              placeholder="45 Min."
              v-model="current_recipe.bake_time"
            />
          </BCol>
          <BCol sm="6" lg="3">
            <label for="v2-total-time" class="form-label mb-0"
              >Gesamtzeit</label
            >
            <BFormInput
              id="v2-total-time"
              size="sm"
              placeholder="1h 30 Min."
              v-model="current_recipe.total_time"
            />
          </BCol>
        </BRow>

        <BRow class="mt-2 mb-2">
          <BCol sm="6" lg="3">
            <label for="v2-difficulty" class="form-label mb-0"
              >Schwierigkeit</label
            >
            <BFormSelect
              id="v2-difficulty"
              size="sm"
              v-model="current_recipe.difficulty"
            >
              <option :value="undefined">-- wählen --</option>
              <option value="easy">Einfach</option>
              <option value="medium">Mittel</option>
              <option value="hard">Schwer</option>
            </BFormSelect>
          </BCol>
          <BCol sm="6" lg="9">
            <label for="v2-notes" class="form-label mb-0">Notizen</label>
            <BFormTextarea
              id="v2-notes"
              size="sm"
              rows="2"
              placeholder="Zusätzliche Notizen..."
              v-model="current_recipe.notes"
            />
          </BCol>
        </BRow>
      </details>

      <!-- Portionen + Bild — nebeneinander auf lg+ -->
      <BRow class="mt-3">
        <BCol lg="6">
          <h3 class="mb-2">Portionen</h3>
          <BRow>
            <BCol sm="6">
              <label for="v2-yields-value" class="form-label mb-0">Menge</label>
              <BFormInput
                id="v2-yields-value"
                size="sm"
                type="number"
                min="0.001"
                step="0.001"
                placeholder="100.0"
                :model-value="yields_value"
                @update:model-value="setYieldsValue"
              />
              <div class="form-check form-switch mt-1">
                <input
                  class="form-check-input"
                  type="checkbox"
                  id="v2-recalc-switch"
                  v-model="do_recalc"
                />
                <label class="form-check-label" for="v2-recalc-switch"
                  >Umrechnen</label
                >
              </div>
            </BCol>
            <BCol sm="6">
              <label for="v2-yields-unit" class="form-label mb-0"
                >Einheit</label
              >
              <BFormInput
                id="v2-yields-unit"
                size="sm"
                placeholder="Portionen"
                :model-value="yields_unit"
                @update:model-value="setYieldsUnit"
              />
              <label for="v2-recalc-exp" class="form-label mb-0 mt-2"
                >Exponent</label
              >
              <BFormInput
                id="v2-recalc-exp"
                type="number"
                min="1"
                step="1"
                size="sm"
                placeholder="1"
                v-model.number="current_recipe.recalc_exp"
              />
            </BCol>
          </BRow>
        </BCol>

        <BCol lg="6">
          <h3 class="mb-2">Bild</h3>
          <div class="image-upload-area">
            <div
              v-if="picture_src || file"
              class="current-image-wrapper position-relative d-inline-block"
            >
              <img
                :src="file ? '' : picture_src"
                id="image-preview"
                class="rounded"
                style="max-height: 160px; max-width: 100%; object-fit: cover"
              />
              <BButton
                v-if="picture_src && !file"
                size="sm"
                variant="danger"
                class="position-absolute top-0 end-0 m-1"
                title="Bild entfernen"
                @click="delete_image = true"
              >
                <i class="bi bi-trash"></i>
              </BButton>
              <BAlert
                v-if="delete_image"
                variant="warning"
                :model-value="true"
                class="mt-2 py-1 px-2"
              >
                Wird beim Speichern entfernt.
                <BButton
                  size="sm"
                  variant="link"
                  class="p-0 ms-2"
                  @click="delete_image = false"
                  >Abbrechen</BButton
                >
              </BAlert>
            </div>
            <div class="mt-2">
              <BFormFile
                size="sm"
                id="v2-foto"
                ref="inputFoto"
                accept="image/*"
                placeholder="Foto auswählen oder hierher ziehen..."
                drop-placeholder="Hier ablegen"
                browse-text="Durchsuchen"
                v-model="file"
              />
              <BButton
                v-if="file"
                size="sm"
                variant="link"
                class="p-0 mt-1"
                @click="clearFile"
                ><i class="bi bi-x"></i> Auswahl aufheben</BButton
              >
            </div>
          </div>
        </BCol>
      </BRow>

      <!-- ===== Rezept-Inhalt: SectionCards ===== -->
      <h3 class="mt-4 mb-3">Rezept-Inhalt</h3>

      <div ref="sectionContainerRef">
        <SectionCard
          v-for="(section, idx) in current_recipe.sections"
          :key="'sec-' + idx"
          :section="section"
          :ingredients="current_recipe.ingredients"
          :steps="current_recipe.steps"
          :section-index="idx"
          :total-sections="current_recipe.sections.length"
          :show-header="current_recipe.sections.length > 1"
          :ingredient-units="ingredient_units"
          @update:section-name="updateSectionName(idx, $event)"
          @delete-section="deleteSection(idx)"
          @move-section="moveSection(idx, $event)"
          @add-ingredient="addIngredient($event)"
          @add-step="addStep($event)"
          @delete-ingredient="deleteIngredient"
          @update-ingredient="(i, ing) => updateIngredient(i, ing)"
          @delete-step="deleteStep"
          @update-step-text="(i, txt) => updateStepText(i, txt)"
          @update-step-notes="(i, notes) => updateStepNotes(i, notes)"
          @reorder-ingredient="(o, n) => reorderIngredientInSection(idx, o, n)"
          @reorder-step="(o, n) => reorderStepInSection(idx, o, n)"
          @cross-move-ingredient="
            (origIdx, targetLocal, targetSec) =>
              crossMoveIngredient(origIdx, targetLocal, targetSec)
          "
          @cross-move-step="
            (origIdx, targetLocal, targetSec) =>
              crossMoveStep(origIdx, targetLocal, targetSec)
          "
        />
      </div>

      <BButton variant="outline-secondary" class="mt-2" @click="addSection">
        <i class="bi bi-plus"></i> Abschnitt hinzufügen
      </BButton>

      <!-- YAML-Debug (nur im Expertenmodus) -->
      <div v-if="settings.expert_mode" class="mt-4 mb-4">
        <BButton size="sm" variant="link" @click="showYaml = !showYaml">
          {{ showYaml ? "YAML verbergen" : "YAML anzeigen" }}
        </BButton>
        <BFormTextarea
          v-if="showYaml"
          readonly
          rows="10"
          :model-value="yaml"
          class="mt-2"
        />
      </div>
    </BContainer>

    <!-- Preview Modal -->
    <BModal
      v-model="showPreview"
      title="Vorschau"
      size="xl"
      hide-footer
      scrollable
    >
      <RecipeDisplay
        v-if="current_recipe"
        :recipe="current_recipe"
        :image-src="picture_src"
      />
    </BModal>
  </div>
</template>

<style scoped>
.h3-summary {
  cursor: pointer;
  user-select: none;
}

details[open] > .h3-summary::after {
  content: " ▾";
}

details:not([open]) > .h3-summary::after {
  content: " ▸";
}
</style>
