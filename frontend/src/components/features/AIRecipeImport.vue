<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from "vue";
import { useRecipeStore } from "@/store/recipeStore";
import { generateUUID } from "@/js/uuid";
import { initRecipe } from "@/js/recipes";
import { ImageResizeError, resizeImage } from "@/js/imageResize";
import {
  aiApi,
  aiErrorMessage,
  MAX_PAGES,
  type AIImportResponse,
} from "@/api/ai";
import type { Recipe } from "@/types/recipe";
import ImportPageList, {
  type ImportPage,
} from "@/components/features/ImportPageList.vue";

const emit = defineEmits<{
  imported: [recipe: Recipe];
}>();

const store = useRecipeStore();

// Template refs
const fileInput = ref<HTMLInputElement>();

// State
const pages = ref<ImportPage[]>([]);
const preparing = ref(false);
const textInput = ref("");
const loading = ref(false);
const result = ref<Recipe | null>(null);
const error = ref<string | null>(null);
const rawJson = ref<string | null>(null);
const downloadImage = ref(true);
const downloadingImage = ref(false);
let nextPageId = 1;

// Computed
const settings = computed(() => store.settings);
const hasApiKey = computed(() => {
  // Backend holds the key — check if user is authenticated
  return true;
});
const busy = computed(() => loading.value || preparing.value);

// Methods
const pickFiles = () => fileInput.value?.click();

const clearPages = () => {
  pages.value.forEach((p) => URL.revokeObjectURL(p.url));
  pages.value = [];
};

const removePage = (id: number) => {
  const page = pages.value.find((p) => p.id === id);
  if (page) URL.revokeObjectURL(page.url);
  pages.value = pages.value.filter((p) => p.id !== id);
};

/** Nimmt die gewählten Bilder nacheinander auf und verkleinert sie (iOS-Speicher). */
const onFilesChosen = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  // Gleiche Datei soll erneut wählbar sein.
  input.value = "";
  if (files.length === 0) return;

  error.value = null;
  const free = MAX_PAGES - pages.value.length;
  const accepted = files.slice(0, Math.max(free, 0));
  const rejected = files.length - accepted.length;

  preparing.value = true;
  try {
    for (const file of accepted) {
      const blob = await resizeImage(file);
      pages.value.push({
        id: nextPageId++,
        blob,
        url: URL.createObjectURL(blob),
      });
    }
    if (rejected > 0) {
      error.value = `Höchstens ${MAX_PAGES} Seiten je Import: ${rejected} Bild${rejected === 1 ? " wurde" : "er wurden"} nicht übernommen.`;
    }
  } catch (err: unknown) {
    error.value =
      err instanceof ImageResizeError ? err.message : aiErrorMessage(err);
  } finally {
    preparing.value = false;
  }
};

/** Führt einen AI-Aufruf aus und zeigt Ergebnis oder Fehler im Dialog. */
const runAnalysis = async (call: () => Promise<AIImportResponse>) => {
  loading.value = true;
  error.value = null;
  result.value = null;
  rawJson.value = null;

  try {
    const data = await call();
    rawJson.value = JSON.stringify(data.recipe, null, 2);
    result.value = initRecipe(data.recipe);
  } catch (err: unknown) {
    error.value = aiErrorMessage(err);
  } finally {
    loading.value = false;
  }
};

const analyzeImages = () => {
  if (pages.value.length === 0) return;
  const blobs = pages.value.map((p) => p.blob);
  return runAnalysis(() => aiApi.importImages(blobs));
};

const analyzeText = () => runAnalysis(() => aiApi.importText(textInput.value));

const importRecipe = async () => {
  if (!result.value) return;

  // Generate UUID if not present
  if (!result.value.recipe_uuid) {
    result.value.recipe_uuid = generateUUID();
  }

  // imageurl will be auto-downloaded by the backend on save

  // Dispatch to store
  store.appendRecipe(result.value);

  // Emit success
  emit("imported", result.value);

  // Reset
  result.value = null;
  clearPages();
  textInput.value = "";
  downloadImage.value = true;
};

// Lifecycle
onBeforeUnmount(clearPages);
</script>

<template>
  <div class="ai-import">
    <BCard>
      <BCardHeader>
        <h5><i class="bi bi-robot"></i> AI-Rezept-Import</h5>
      </BCardHeader>
      <BCardBody>
        <div v-if="!hasApiKey" class="alert alert-warning">
          <i class="bi bi-exclamation-triangle"></i>
          AI-Import nicht verfügbar. Bitte einloggen.
        </div>

        <BTabs v-else content-class="mt-3">
          <!-- Photo Tab: native Kamera bzw. Fotoauswahl, 1–10 Seiten -->
          <BTab title="Foto aufnehmen oder wählen" active>
            <!-- Ohne capture: iOS bietet Kamera und Mediathek zur Wahl -->
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              multiple
              class="d-none"
              @change="onFilesChosen"
            />

            <ImportPageList
              v-if="pages.length"
              :pages="pages"
              :disabled="busy"
              class="mb-3"
              @remove="removePage"
            />

            <div class="d-flex flex-wrap gap-2">
              <BButton
                variant="primary"
                :disabled="busy || pages.length >= MAX_PAGES"
                @click="pickFiles"
              >
                <i class="bi bi-camera"></i>
                {{
                  pages.length
                    ? "Seite hinzufügen"
                    : "Foto aufnehmen oder wählen"
                }}
              </BButton>
              <BButton
                v-if="pages.length"
                variant="success"
                :disabled="busy"
                @click="analyzeImages"
              >
                <span
                  v-if="loading || preparing"
                  class="spinner-border spinner-border-sm me-2"
                ></span>
                <i v-else class="bi bi-magic"></i>
                Rezept erkennen
              </BButton>
              <BButton
                v-if="pages.length"
                variant="secondary"
                :disabled="busy"
                @click="clearPages"
              >
                <i class="bi bi-arrow-counterclockwise"></i> Neu
              </BButton>
            </div>
            <small class="text-muted d-block mt-2">
              Rezepte über mehrere Seiten: bis zu {{ MAX_PAGES }} Fotos in
              Lesereihenfolge.
            </small>
          </BTab>

          <!-- Text/URL Tab -->
          <BTab title="Text/URL">
            <BFormTextarea
              v-model="textInput"
              placeholder="Füge hier einen Rezepttext ein oder gib eine URL ein..."
              rows="6"
            ></BFormTextarea>

            <div class="mt-2">
              <BButton
                @click="analyzeText"
                variant="primary"
                :disabled="loading || !textInput"
              >
                <span
                  v-if="loading"
                  class="spinner-border spinner-border-sm me-2"
                ></span>
                <i v-else class="bi bi-magic"></i>
                Rezept extrahieren
              </BButton>
            </div>
          </BTab>
        </BTabs>

        <!-- Result -->
        <div v-if="result" class="mt-4">
          <div class="alert alert-success">
            <i class="bi bi-check-circle"></i> Rezept erfolgreich erkannt!
          </div>
          <div class="recipe-preview">
            <h6>{{ result.recipe_name }}</h6>
            <p class="text-muted">{{ result.subtitle }}</p>

            <!-- Image Download Option -->
            <div v-if="result.imageurl && !downloadingImage" class="mb-3">
              <BFormCheckbox v-model="downloadImage">
                Bild herunterladen und lokal speichern (empfohlen)
              </BFormCheckbox>
              <small class="text-muted d-block">
                URL-Bilder können nach einiger Zeit ungültig werden. Lokale
                Lokale Speicherung wird empfohlen.
              </small>
            </div>

            <div v-if="downloadingImage" class="mb-3">
              <div class="spinner-border spinner-border-sm me-2"></div>
              Bild wird heruntergeladen...
            </div>

            <BButton
              @click="importRecipe"
              variant="primary"
              :disabled="downloadingImage"
            >
              <i class="bi bi-download"></i> Rezept importieren
            </BButton>
            <BButton @click="result = null" variant="secondary" class="ms-2">
              <i class="bi bi-x"></i> Verwerfen
            </BButton>
          </div>
        </div>

        <div v-if="error" class="mt-4 alert alert-danger">
          <i class="bi bi-exclamation-triangle"></i> {{ error }}
        </div>

        <!-- Raw response (Expert Mode) -->
        <details v-if="rawJson && settings.expert_mode" class="mt-3">
          <summary class="text-muted" style="cursor: pointer">
            <i class="bi bi-code-slash"></i> Rohantwort (JSON) anzeigen
          </summary>
          <pre
            class="mt-2 p-3 bg-dark text-light rounded"
            style="max-height: 400px; overflow: auto; font-size: 0.85rem"
            >{{ rawJson }}</pre>
        </details>
      </BCardBody>
    </BCard>
  </div>
</template>

<style scoped>
.recipe-preview {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-divider);
}
</style>
