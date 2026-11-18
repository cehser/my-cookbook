<script setup lang="ts">
import { ref } from "vue";
import { useEventListener } from "@vueuse/core";
import * as jsyaml from "js-yaml";
import { adminApi } from "@/api/admin";
import { useToast } from "@/composables/useToast";
import { useRecipeDelete } from "@/composables/useRecipeDelete";
import { useRecipeStore } from "@/store/recipeStore";
import { generateUUID } from "@/js/uuid";
import { deepCopyJSON } from "@/js/deepCopy";
import { appendToast } from "@/js/appendFeedback";
import { saveBlob } from "@/js/download";
import {
  loadNewRecipe as createNewRecipe,
  loadSample as createSampleRecipe,
} from "@/js/recipes";
import type { Recipe } from "@/types/recipe";

// Unverändert aus Administration.vue verschoben; Umbau mit 11.2.

withDefaults(
  defineProps<{
    readOnly: boolean;
    expertMode: boolean;
    /** Gesamtexport (ZIP) anbieten; Sichtbarkeit setzt die Seite. */
    isAdmin?: boolean;
  }>(),
  { isAdmin: false },
);

defineSlots<{
  /** Weitere Knöpfe am Anfang der Knopfleiste (Wartung). */
  actions?: () => unknown;
}>();

const store = useRecipeStore();
const { toast } = useToast();
const { deleteRecipe: removeRecipe } = useRecipeDelete();

const fileInput = ref<HTMLInputElement | null>(null);
const exportRunning = ref(false);

useEventListener("keydown", (event: KeyboardEvent) => {
  if (event.ctrlKey && event.code === "KeyS") {
    event.preventDefault();
    saveToLocalStorage();
  }
});

/** Löscht nach Rückfrage; die Liste verschiebt sich, daher per ID. */
function deleteRecipe(recipe: Recipe) {
  if (!confirm(`Rezept "${recipe.recipe_name}" wirklich löschen?`)) return;
  void removeRecipe(recipe.recipe_uuid);
}

/** Legt das Rezept an und meldet das Ergebnis. */
async function append(recipe: Recipe, successText: string) {
  const { message, variant } = appendToast(
    await store.appendRecipe(recipe),
    successText,
  );
  toast(message, variant);
}

/** Vollständige Fassung statt Listenzeile; `null` mit Meldung. */
async function completeRecipe(index: number, what: string) {
  const listed = store.recipes[index];
  const recipe = listed ? await store.loadCompleteRecipe(listed) : null;
  if (!recipe) {
    toast(`Rezept nicht ${what}: nicht vollständig geladen.`, "danger");
  }
  return recipe;
}

async function copyRecipe(index: number) {
  const complete = await completeRecipe(index, "dupliziert");
  if (!complete) return;
  const recipe = deepCopyJSON(complete);
  recipe.recipe_uuid = generateUUID();
  await append(recipe, "Rezept dupliziert.");
}

function newRecipe() {
  void append(createNewRecipe(), "Neues Rezept erstellt.");
}

function loadSample() {
  void append(createSampleRecipe(), "Beispielrezept geladen.");
}

function saveToLocalStorage() {
  store.saveRecipes();
  store.saveRecipePictures().then(() => toast("Gespeichert.", "success"));
}

function triggerImport() {
  fileInput.value?.click();
}

function importRecipe(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const recipe = jsyaml.load(e.target?.result as string) as Recipe;
      // Import ist ein neues Rezept: Die ID aus der Datei (Export, Beispiel)
      // wäre beim Anlegen 409 bzw. keine gültige UUID
      recipe.recipe_uuid = generateUUID();
      void append(recipe, `Rezept "${recipe.recipe_name}" importiert.`);
      input.value = "";
    } catch (error) {
      toast("Fehler beim Importieren: " + (error as Error).message, "danger");
    }
  };
  reader.readAsText(file);
}

async function exportRecipe(index: number) {
  const recipe = await completeRecipe(index, "exportiert");
  if (!recipe) return;
  const yaml = jsyaml.dump(recipe);
  saveBlob(
    new Blob([yaml], { type: "text/yaml" }),
    `${recipe.recipe_name || "recipe"}.yaml`,
  );
}

/** Lädt den Gesamtexport mit Auth-Header als Blob und bietet ihn als Datei an. */
async function exportAll() {
  exportRunning.value = true;
  try {
    const { blob, filename } = await adminApi.exportAll();
    saveBlob(blob, filename ?? "my-cookbook-export.zip");
  } catch (e) {
    toast("Gesamtexport fehlgeschlagen: " + (e as Error).message, "danger");
  } finally {
    exportRunning.value = false;
  }
}
</script>

<template>
  <div class="d-flex flex-wrap">
    <slot name="actions" />
    <BButton v-if="!readOnly" class="btn m-2" @click="newRecipe"
      ><i class="bi bi-file-earmark-plus"></i><br />Neues Rezept</BButton
    >
    <BButton v-if="!readOnly" class="btn m-2" @click="loadSample"
      ><i class="bi bi-file-earmark-text"></i><br />Beispielrezept</BButton
    >
    <BButton
      v-if="!readOnly && expertMode"
      class="btn m-2"
      @click="triggerImport"
      ><i class="bi bi-upload"></i><br />YAML Import</BButton
    >
    <BButton
      v-if="isAdmin"
      class="btn m-2"
      :disabled="exportRunning"
      @click="exportAll"
      ><BSpinner v-if="exportRunning" small /><i
        v-else
        class="bi bi-file-earmark-zip"
      ></i
      ><br />Gesamtexport (ZIP)</BButton
    >
    <input
      ref="fileInput"
      type="file"
      accept=".yaml,.yml"
      @change="importRecipe"
      style="display: none"
    />
  </div>

  <BListGroup flush v-for="(recipe, index) in store.recipes" :key="index">
    <BListGroupItem
      >{{ recipe.recipe_name }}
      <BButton
        v-if="!readOnly && store.canDelete(recipe)"
        class="btn-sm"
        :aria-label="`Rezept „${recipe.recipe_name}“ löschen`"
        :title="`Rezept „${recipe.recipe_name}“ löschen`"
        @click="deleteRecipe(recipe)"
        ><i class="bi bi-x" aria-hidden="true"></i
      ></BButton>
      <BButton v-if="!readOnly" class="btn-sm" @click="copyRecipe(index)"
        ><i class="bi bi-files"></i
      ></BButton>
      <BButton
        v-if="expertMode"
        class="btn-sm"
        @click="exportRecipe(index)"
        title="Als YAML exportieren"
        ><i class="bi bi-download"></i
      ></BButton>
    </BListGroupItem>
  </BListGroup>

  <BButton class="btn mb-4" @click="saveToLocalStorage"
    ><i class="bi bi-archive-fill"></i> Speichern</BButton
  >
</template>
