<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from "vue";
import { useRouter } from "vue-router";
import { onKeyStroke } from "@vueuse/core";
import { useDebouncedRefHistory } from "@vueuse/core";
import Sortable from "sortablejs";
import SectionCard from "@/components/edit/SectionCard.vue";
import AppNavbar from "@/components/layout/AppNavbar.vue";
import { editUrl } from "@/js/slug";
import { useRecipeHelper } from "@/composables/useRecipeHelper";
import { useToast } from "@/composables/useToast";
import { useDraft } from "@/composables/useDraft";
import { useUnsavedGuard } from "@/composables/useUnsavedGuard";
import { useRecipeStore } from "@/store/recipeStore";
import jsyaml from "js-yaml";
import deepEqual from "deep-equal";
import type { Ingredient } from "@/types/recipe";

const props = defineProps<{ id: string }>();

const router = useRouter();
const store = useRecipeStore();
const { toast } = useToast();

const idRef = computed(() => props.id);
const {
  current_recipe,
  do_recalc,
  selected,
  recipes_list,
  picture_src,
  yields_unit,
  yields_value,
  setYieldsUnit,
  setYieldsValue,
} = useRecipeHelper({ recipeId: idRef });

// Override do_recalc default
do_recalc.value = false;

// --- Draft & Unsaved Guard ---
const { hasDraft, restoreDraft, discardDraft } = useDraft(
  current_recipe,
  idRef,
);

const isDirty = computed(() => {
  if (selected.value < 0) return false;
  return !deepEqual(store.recipes[selected.value], current_recipe.value);
});

useUnsavedGuard(isDirty);

// --- Undo / Redo ---
const { undo, redo, canUndo, canRedo } = useDebouncedRefHistory(
  current_recipe,
  { deep: true, debounce: 500, capacity: 50 },
);

// --- Ctrl+S ---
onKeyStroke("s", (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    saveRecipe();
  }
});

// Data
const file = ref<File | null>(null);
const delete_image = ref(false);
const newTag = ref("");
const inputFoto = ref<{ reset: () => void } | null>(null);
const showYaml = ref(false);

// Computed
const yaml = computed(() => jsyaml.dump(current_recipe.value));

const ingredient_units = computed(() => {
  const units = new Set(["g", "ml", "Stück"]);
  for (const recipe of store.recipes) {
    for (const ingredient of recipe.ingredients || []) {
      for (const amount of ingredient.amounts || []) {
        if (amount.unit) units.add(amount.unit);
      }
    }
  }
  return [...units].sort();
});

const settings = computed(() => store.settings);

// Watch
watch(file, (newFile) => {
  preview_image(newFile);
});

// Methods
function addTag() {
  if (!newTag.value.trim()) return;
  if (!current_recipe.value) return;
  if (!current_recipe.value.tags) {
    current_recipe.value.tags = [];
  }
  if (!current_recipe.value.tags.includes(newTag.value.trim())) {
    current_recipe.value.tags.push(newTag.value.trim());
  }
  newTag.value = "";
}

function removeTag(index: number) {
  current_recipe.value?.tags?.splice(index, 1);
}

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
  if (
    !deepEqual(store.recipes[selected.value], current_recipe.value) ||
    file.value ||
    delete_image.value
  ) {
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
      .then(() => toast("Gespeichert.", "success"))
      .catch(() => toast("Fehler.", "danger"));
  } else {
    toast("Unverändert.", "success");
  }
}

function navSelected(uuid: string) {
  const r = store.recipes.find((r) => r.recipe_uuid === uuid);
  if (r) {
    router.push(editUrl(r.recipe_uuid, r.recipe_name));
  }
}

// --- Section/Ingredient/Step helpers ---
function addSection() {
  current_recipe.value?.sections.push({ section: "" });
}

function updateSectionName(sectionIndex: number, name: string) {
  if (!current_recipe.value) return;
  const oldName = current_recipe.value.sections[sectionIndex].section;
  current_recipe.value.sections[sectionIndex].section = name;
  // Rename in ingredients & steps
  for (const ing of current_recipe.value.ingredients) {
    if (ing.section === oldName) ing.section = name;
  }
  for (const step of current_recipe.value.steps) {
    if (step.section === oldName) step.section = name;
  }
}

function deleteSection(sectionIndex: number) {
  if (!current_recipe.value) return;
  const name = current_recipe.value.sections[sectionIndex].section;
  current_recipe.value.sections.splice(sectionIndex, 1);
  // Remove orphaned items
  current_recipe.value.ingredients = current_recipe.value.ingredients.filter(
    (i) => i.section !== name,
  );
  current_recipe.value.steps = current_recipe.value.steps.filter(
    (s) => s.section !== name,
  );
}

function moveSection(sectionIndex: number, direction: "up" | "down") {
  if (!current_recipe.value) return;
  const arr = current_recipe.value.sections;
  const target = direction === "up" ? sectionIndex - 1 : sectionIndex + 1;
  if (target < 0 || target >= arr.length) return;
  [arr[sectionIndex], arr[target]] = [arr[target], arr[sectionIndex]];
}

function addIngredient(section: string) {
  current_recipe.value?.ingredients.push({
    name: "Neue Zutat",
    amounts: [{ amount: null, unit: "" }],
    section,
  });
}

function deleteIngredient(index: number) {
  current_recipe.value?.ingredients.splice(index, 1);
}

function updateIngredient(index: number, ingredient: Ingredient) {
  if (!current_recipe.value) return;
  current_recipe.value.ingredients[index] = ingredient;
}

function addStep(section: string) {
  current_recipe.value?.steps.push({ step: "", section });
}

function deleteStep(index: number) {
  current_recipe.value?.steps.splice(index, 1);
}

function updateStepText(index: number, text: string) {
  if (!current_recipe.value) return;
  current_recipe.value.steps[index].step = text;
}

// --- DnD: Reorder within section ---
function reorderIngredientInSection(
  sectionIndex: number,
  oldLocalIdx: number,
  newLocalIdx: number,
) {
  if (!current_recipe.value) return;
  const section = current_recipe.value.sections[sectionIndex].section;
  const arr = current_recipe.value.ingredients;
  const flatIndices: number[] = [];
  const items: Ingredient[] = [];
  arr.forEach((ing, i) => {
    if (ing.section === section) {
      flatIndices.push(i);
      items.push(ing);
    }
  });
  const [moved] = items.splice(oldLocalIdx, 1);
  items.splice(newLocalIdx, 0, moved);
  flatIndices.forEach((flatIdx, i) => {
    arr[flatIdx] = items[i];
  });
}

function reorderStepInSection(
  sectionIndex: number,
  oldLocalIdx: number,
  newLocalIdx: number,
) {
  if (!current_recipe.value) return;
  const section = current_recipe.value.sections[sectionIndex].section;
  const arr = current_recipe.value.steps;
  const flatIndices: number[] = [];
  const items: typeof arr = [];
  arr.forEach((step, i) => {
    if (step.section === section) {
      flatIndices.push(i);
      items.push(step);
    }
  });
  const [moved] = items.splice(oldLocalIdx, 1);
  items.splice(newLocalIdx, 0, moved);
  flatIndices.forEach((flatIdx, i) => {
    arr[flatIdx] = items[i];
  });
}

// --- DnD: Cross-card (move between sections) ---
function crossMoveIngredient(
  originalFlatIdx: number,
  targetLocalIdx: number,
  targetSection: string,
) {
  if (!current_recipe.value) return;
  const arr = current_recipe.value.ingredients;
  // Remove from old position
  const [item] = arr.splice(originalFlatIdx, 1);
  item.section = targetSection;
  // Find insert position: after the targetLocalIdx-th item in target section
  let insertAt = arr.length; // default: append
  let count = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].section === targetSection) {
      if (count === targetLocalIdx) {
        insertAt = i;
        break;
      }
      count++;
    }
  }
  arr.splice(insertAt, 0, item);
}

function crossMoveStep(
  originalFlatIdx: number,
  targetLocalIdx: number,
  targetSection: string,
) {
  if (!current_recipe.value) return;
  const arr = current_recipe.value.steps;
  const [item] = arr.splice(originalFlatIdx, 1);
  item.section = targetSection;
  let insertAt = arr.length;
  let count = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].section === targetSection) {
      if (count === targetLocalIdx) {
        insertAt = i;
        break;
      }
      count++;
    }
  }
  arr.splice(insertAt, 0, item);
}

// --- DnD: Section reorder ---
const sectionContainerRef = ref<HTMLElement>();
let sectionSortable: Sortable | null = null;

onMounted(() => {
  nextTick(() => {
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
  });
});

onBeforeUnmount(() => {
  sectionSortable?.destroy();
  sectionSortable = null;
});
</script>

<template>
  <div id="edit-v2">
    <AppNavbar
      @update:selected="navSelected"
      :recipes_list="recipes_list"
      :selected="id"
      :read_only="settings.read_only"
    >
      <li class="d-flex align-items-center gap-1">
        <BButton
          size="sm"
          variant="outline-secondary"
          :disabled="!canUndo"
          title="Rückgängig (Ctrl+Z)"
          @click="undo()"
        >
          <i class="bi bi-arrow-counterclockwise"></i>
        </BButton>
        <BButton
          size="sm"
          variant="outline-secondary"
          :disabled="!canRedo"
          title="Wiederherstellen"
          @click="redo()"
        >
          <i class="bi bi-arrow-clockwise"></i>
        </BButton>
        <BButton @click="saveRecipe" title="Speichern (Ctrl+S)">
          <i class="bi bi-archive-fill"></i>
        </BButton>
      </li>
    </AppNavbar>

    <BContainer v-if="current_recipe" class="mt-3">
      <!-- Draft Recovery Banner -->
      <BAlert v-if="hasDraft" variant="warning" :model-value="true">
        Es gibt einen ungespeicherten Entwurf.
        <BButton size="sm" variant="warning" @click="restoreDraft"
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

      <!-- Titel & Untertitel -->
      <BRow class="my-1">
        <BCol sm="2"><label for="v2-name">Titel:</label></BCol>
        <BCol sm="10">
          <BFormInput
            id="v2-name"
            size="sm"
            placeholder="Namen eingeben"
            v-model="current_recipe.recipe_name"
          />
        </BCol>
      </BRow>
      <BRow class="my-1">
        <BCol sm="2"><label for="v2-subtitle">Untertitel:</label></BCol>
        <BCol sm="10">
          <BFormInput
            id="v2-subtitle"
            size="sm"
            placeholder="Untertitel eingeben"
            v-model="current_recipe.subtitle"
          />
        </BCol>
      </BRow>

      <!-- Metadaten-Sektion -->
      <h3 class="mt-4 mb-3">Metadaten</h3>

      <BRow class="my-1">
        <BCol sm="2"><label for="v2-author">Autor:</label></BCol>
        <BCol sm="10">
          <BFormInput
            id="v2-author"
            size="sm"
            placeholder="Autor eingeben"
            v-model="current_recipe.author"
          />
        </BCol>
      </BRow>

      <BRow class="my-1">
        <BCol sm="2"><label for="v2-source-url">Quelle (URL):</label></BCol>
        <BCol sm="10">
          <BFormInput
            id="v2-source-url"
            size="sm"
            placeholder="https://..."
            v-model="current_recipe.source_url"
          />
        </BCol>
      </BRow>

      <BRow class="my-1">
        <BCol sm="2"><label for="v2-source-book">Quelle (Buch):</label></BCol>
        <BCol sm="10">
          <BFormInput
            id="v2-source-book"
            size="sm"
            placeholder="Buchtitel, Seite"
            v-model="current_recipe.source_book"
          />
        </BCol>
      </BRow>

      <BRow class="my-1">
        <BCol sm="2"><label for="v2-servings">Portionen:</label></BCol>
        <BCol sm="10">
          <BFormInput
            id="v2-servings"
            size="sm"
            placeholder="z.B. 4 Personen"
            v-model="current_recipe.servings"
          />
        </BCol>
      </BRow>

      <BRow class="my-1">
        <BCol sm="2"><label for="v2-prep-time">Vorbereitungszeit:</label></BCol>
        <BCol sm="10">
          <BFormInput
            id="v2-prep-time"
            size="sm"
            placeholder="z.B. 15 Minuten"
            v-model="current_recipe.prep_time"
          />
        </BCol>
      </BRow>

      <BRow class="my-1">
        <BCol sm="2"><label for="v2-cook-time">Koch-/Bratzeit:</label></BCol>
        <BCol sm="10">
          <BFormInput
            id="v2-cook-time"
            size="sm"
            placeholder="z.B. 30 Minuten"
            v-model="current_recipe.cook_time"
          />
        </BCol>
      </BRow>

      <BRow class="my-1">
        <BCol sm="2"><label for="v2-bake-time">Backzeit:</label></BCol>
        <BCol sm="10">
          <BFormInput
            id="v2-bake-time"
            size="sm"
            placeholder="z.B. 45 Minuten"
            v-model="current_recipe.bake_time"
          />
        </BCol>
      </BRow>

      <BRow class="my-1">
        <BCol sm="2"><label for="v2-total-time">Gesamtzeit:</label></BCol>
        <BCol sm="10">
          <BFormInput
            id="v2-total-time"
            size="sm"
            placeholder="z.B. 1 Stunde 30 Minuten"
            v-model="current_recipe.total_time"
          />
        </BCol>
      </BRow>

      <BRow class="my-1">
        <BCol sm="2"><label for="v2-difficulty">Schwierigkeit:</label></BCol>
        <BCol sm="10">
          <BFormSelect
            id="v2-difficulty"
            size="sm"
            v-model="current_recipe.difficulty"
          >
            <option :value="undefined">-- Bitte wählen --</option>
            <option value="easy">Einfach</option>
            <option value="medium">Mittel</option>
            <option value="hard">Schwer</option>
          </BFormSelect>
        </BCol>
      </BRow>

      <BRow class="my-1">
        <BCol sm="2"><label for="v2-notes">Notizen:</label></BCol>
        <BCol sm="10">
          <BFormTextarea
            id="v2-notes"
            size="sm"
            rows="3"
            placeholder="Zusätzliche Notizen zum Rezept..."
            v-model="current_recipe.notes"
          />
        </BCol>
      </BRow>

      <!-- Portionen / Yields -->
      <h3 class="mt-4 mb-3">Portionen</h3>

      <BRow class="my-1">
        <BCol sm="2"><label for="v2-yields-value">Ergibt Menge:</label></BCol>
        <BCol sm="10">
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
      </BRow>
      <BRow class="my-1">
        <BCol sm="2"
          ><label for="v2-yields-unit">Ergibt Einheiten:</label></BCol
        >
        <BCol sm="10">
          <BFormInput
            id="v2-yields-unit"
            size="sm"
            placeholder="Enter a name"
            :model-value="yields_unit"
            @update:model-value="setYieldsUnit"
          />
        </BCol>
      </BRow>
      <BRow class="my-1">
        <BCol sm="2"
          ><label for="v2-recalc-exp">Umrechnungsexponent:</label></BCol
        >
        <BCol sm="10">
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

      <!-- Tags -->
      <h3 class="mt-4 mb-3">Tags</h3>
      <BRow class="my-1">
        <BCol sm="2"><label for="v2-tags">Tags:</label></BCol>
        <BCol sm="10">
          <div class="d-flex flex-wrap gap-2 mb-2">
            <span
              v-for="(tag, index) in current_recipe.tags"
              :key="index"
              class="badge bg-primary"
            >
              {{ tag }}
              <i
                class="bi bi-x-circle ms-1"
                @click="removeTag(index)"
                style="cursor: pointer"
              ></i>
            </span>
          </div>
          <div class="input-group input-group-sm">
            <BFormInput
              id="v2-tags"
              size="sm"
              placeholder="Tag hinzufügen..."
              v-model="newTag"
              @keyup.enter="addTag"
            />
            <BButton @click="addTag" size="sm"
              ><i class="bi bi-plus"></i
            ></BButton>
          </div>
        </BCol>
      </BRow>

      <!-- Bild -->
      <h3 class="mt-4 mb-3">Bild</h3>
      <BRow class="my-1">
        <BCol sm="2"><label for="v2-imageurl">Web-Foto:</label></BCol>
        <BCol sm="10">
          <BFormInput
            id="v2-imageurl"
            size="sm"
            placeholder="https://..."
            v-model="current_recipe.imageurl"
          />
        </BCol>
      </BRow>
      <BRow
        class="my-1"
        v-if="store.recipe_pictures[current_recipe.recipe_uuid]"
      >
        <BCol sm="2"><label>Gespeichertes Foto:</label></BCol>
        <BCol sm="10">
          <img :src="picture_src" height="100" />
          <div class="form-check form-switch mt-1">
            <input
              class="form-check-input"
              type="checkbox"
              id="v2-delete-image"
              v-model="delete_image"
            />
            <label class="form-check-label" for="v2-delete-image"
              >Löschen</label
            >
          </div>
        </BCol>
      </BRow>
      <BRow class="my-1">
        <BCol sm="2"><label for="v2-foto">Foto-Upload:</label></BCol>
        <BCol sm="10">
          <BInputGroup size="sm">
            <template #prepend>
              <BButton size="sm" @click="clearFile"
                ><i class="bi bi-x"></i
              ></BButton>
            </template>
            <BFormFile
              size="sm"
              id="v2-foto"
              ref="inputFoto"
              accept="image/*"
              placeholder="Datei auswählen oder ablegen"
              drop-placeholder="Hier ablegen"
              browse-text="Durchsuchen"
              v-model="file"
            />
          </BInputGroup>
        </BCol>
      </BRow>
      <BRow>
        <BCol sm="2">Upload-Vorschau</BCol>
        <BCol sm="10"><img id="image-preview" height="100" /></BCol>
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

      <!-- YAML-Debug -->
      <div class="mt-4 mb-4">
        <BButton size="sm" variant="link" @click="showYaml = !showYaml">
          {{ showYaml ? "YAML verbergen" : "YAML anzeigen" }}
        </BButton>
        <BFormTextarea
          v-if="showYaml"
          readonly
          rows="10"
          :value="yaml"
          class="mt-2"
        />
      </div>
    </BContainer>
  </div>
</template>
