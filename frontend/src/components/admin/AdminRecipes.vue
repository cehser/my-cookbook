<script setup lang="ts">
import { ref } from "vue";
import { useEventListener } from "@vueuse/core";
import jsyaml from "js-yaml";
import { useToast } from "@/composables/useToast";
import { useRecipeStore } from "@/store/recipeStore";
import { generateUUID } from "@/js/uuid";
import { deepCopyJSON } from "@/js/deepCopy";
import {
  loadNewRecipe as createNewRecipe,
  loadSample as createSampleRecipe,
} from "@/js/recipes";
import type { Recipe } from "@/types/recipe";

// Unverändert aus Administration.vue verschoben; Umbau mit 11.2.

defineProps<{
  readOnly: boolean;
  expertMode: boolean;
}>();

defineSlots<{
  /** Weitere Knöpfe am Anfang der Knopfleiste (Wartung). */
  actions?: () => unknown;
}>();

const store = useRecipeStore();
const { toast } = useToast();

const fileInput = ref<HTMLInputElement | null>(null);

useEventListener("keydown", (event: KeyboardEvent) => {
  if (event.ctrlKey && event.code === "KeyS") {
    event.preventDefault();
    saveToLocalStorage();
  }
});

function deleteRecipe(index: number) {
  store.deleteRecipe(index);
}

function copyRecipe(index: number) {
  const recipe = deepCopyJSON(store.recipes[index]);
  recipe.recipe_uuid = generateUUID();
  store.appendRecipe(recipe);
}

function newRecipe() {
  store.appendRecipe(createNewRecipe());
}

function loadSample() {
  store.appendRecipe(createSampleRecipe());
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
      store.appendRecipe(recipe);
      toast(`Rezept "${recipe.recipe_name}" importiert.`, "success");
      input.value = "";
    } catch (error) {
      toast("Fehler beim Importieren: " + (error as Error).message, "danger");
    }
  };
  reader.readAsText(file);
}

function exportRecipe(index: number) {
  const recipe = store.recipes[index];
  const yaml = jsyaml.dump(recipe);
  const blob = new Blob([yaml], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${recipe.recipe_name || "recipe"}.yaml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
      <BButton v-if="!readOnly" class="btn-sm" @click="deleteRecipe(index)"
        ><i class="bi bi-x"></i
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
