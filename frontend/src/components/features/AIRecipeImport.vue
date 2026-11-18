<script setup lang="ts">
import { ref, computed } from "vue";
import { useRecipeStore } from "@/store/recipeStore";
import { initRecipe } from "@/js/recipes";
import { ImageResizeError, resizeImage } from "@/js/imageResize";
import {
  aiApi,
  aiErrorMessage,
  MAX_PAGES,
  type AIImportResponse,
} from "@/api/ai";
import type { Recipe } from "@/types/recipe";
import { useImportPages } from "@/composables/useImportPages";
import { useRecipeImport } from "@/composables/useRecipeImport";
import ImportPageList from "@/components/features/ImportPageList.vue";

const emit = defineEmits<{
  /** `warnings`: Hinweise (nur lokal gespeichert, Vorlage), sonst leer. */
  imported: [recipe: Recipe, warnings: string[]];
}>();

const store = useRecipeStore();

// Template refs
const fileInput = ref<HTMLInputElement>();

// State
// Seiten bleiben beim Schließen und erneuten Öffnen des Dialogs erhalten.
const { pages, addPage, removePage, clearPages } = useImportPages();
const {
  importing,
  uploadProgress,
  importRecipe: runImport,
} = useRecipeImport({
  onImported: (recipe, warnings) => {
    emit("imported", recipe, warnings);
    resetFeedback();
    textInput.value = "";
    downloadImage.value = true;
  },
});
const preparing = ref(false);
/** Fortschritt beim Vorbereiten: aktuelle Seite von Gesamtzahl der Auswahl. */
const preparingProgress = ref({ done: 0, total: 0 });
/** Hinweise zur letzten Auswahl (fehlgeschlagene Dateien, Kürzung auf 10 Seiten). */
const notices = ref<string[]>([]);
const textInput = ref("");
const loading = ref(false);
const result = ref<Recipe | null>(null);
/** Herkunft des Ergebnisses: nur der Foto-Weg speichert die Seiten als Vorlage. */
const resultFrom = ref<"images" | "text" | null>(null);
const error = ref<string | null>(null);
const rawJson = ref<string | null>(null);
const downloadImage = ref(true);
const downloadingImage = ref(false);

// Computed
// Rohantwort nur für Admins (Fehlersuche im KI-Import)
const isAdmin = computed(() => store.settings.role === "admin");
const busy = computed(
  () => loading.value || preparing.value || importing.value,
);
/** Laufende Seite („k von N“), nicht die Zahl der fertigen. */
const preparingCurrent = computed(() =>
  Math.min(preparingProgress.value.done + 1, preparingProgress.value.total),
);
const uploadCurrent = computed(() =>
  Math.min(uploadProgress.value.done + 1, uploadProgress.value.total),
);

// Methods
const pickFiles = () => fileInput.value?.click();

/** Ein alter Befund oder ein altes Ergebnis passt nicht mehr zur geänderten Seitenliste. */
const resetFeedback = () => {
  error.value = null;
  result.value = null;
  resultFrom.value = null;
  rawJson.value = null;
  notices.value = [];
};

const onRemovePage = (id: number) => {
  resetFeedback();
  removePage(id);
};

const onNew = () => {
  resetFeedback();
  clearPages();
};

/**
 * Nimmt die gewählten Bilder nacheinander auf und verkleinert sie (iOS-Speicher).
 * Scheitert eine Datei, werden die übrigen trotzdem verarbeitet; Fehler und
 * Kürzung über `MAX_PAGES` werden am Ende gesammelt gemeldet.
 */
const onFilesChosen = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  // Gleiche Datei soll erneut wählbar sein.
  input.value = "";
  if (files.length === 0) return;

  resetFeedback();
  const free = Math.max(MAX_PAGES - pages.value.length, 0);
  const accepted = files.slice(0, free);
  const rejected = files.length - accepted.length;
  const messages: string[] = [];

  preparing.value = true;
  preparingProgress.value = { done: 0, total: accepted.length };
  try {
    for (const file of accepted) {
      try {
        const { blob, thumbnail } = await resizeImage(file);
        addPage(blob, thumbnail);
      } catch (err: unknown) {
        messages.push(
          err instanceof ImageResizeError ? err.message : aiErrorMessage(err),
        );
      }
      preparingProgress.value.done++;
    }
  } finally {
    preparing.value = false;
  }
  if (rejected > 0) {
    messages.push(
      `Höchstens ${MAX_PAGES} Seiten je Import: ${rejected} Bild${rejected === 1 ? " wurde" : "er wurden"} nicht übernommen.`,
    );
  }
  notices.value = messages;
};

/** Führt einen AI-Aufruf aus und zeigt Ergebnis oder Fehler im Dialog. */
const runAnalysis = async (
  from: "images" | "text",
  call: () => Promise<AIImportResponse>,
) => {
  loading.value = true;
  error.value = null;
  result.value = null;
  resultFrom.value = null;
  rawJson.value = null;

  try {
    const data = await call();
    rawJson.value = JSON.stringify(data.recipe, null, 2);
    result.value = initRecipe(data.recipe);
    resultFrom.value = from;
  } catch (err: unknown) {
    error.value = aiErrorMessage(err);
  } finally {
    loading.value = false;
  }
};

const analyzeImages = () => {
  if (pages.value.length === 0) return;
  const blobs = pages.value.map((p) => p.blob);
  return runAnalysis("images", () => aiApi.importImages(blobs));
};

const analyzeText = () =>
  runAnalysis("text", () => aiApi.importText(textInput.value));

/** Anlegen, Vorlage, Navigation: `useRecipeImport`. Abgelehnt → Meldung, Seiten bleiben. */
const importRecipe = async () => {
  if (!result.value || !resultFrom.value) return;
  const message = await runImport(result.value, resultFrom.value);
  if (message) error.value = message;
};
</script>

<template>
  <div class="ai-import">
    <BCard>
      <BCardHeader>
        <h5><i class="bi bi-robot"></i> AI-Rezept-Import</h5>
      </BCardHeader>
      <BCardBody>
        <BTabs content-class="mt-3">
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
              @remove="onRemovePage"
            />

            <div v-if="preparing" class="text-muted mb-3" role="status">
              <span class="spinner-border spinner-border-sm me-2"></span>
              Seite {{ preparingCurrent }} von
              {{ preparingProgress.total }} wird vorbereitet
            </div>

            <div
              v-for="(notice, i) in notices"
              :key="i"
              class="alert alert-warning"
            >
              <i class="bi bi-exclamation-triangle"></i> {{ notice }}
            </div>

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
                  v-if="loading"
                  class="spinner-border spinner-border-sm me-2"
                ></span>
                <i v-else class="bi bi-magic"></i>
                Rezept erkennen
              </BButton>
              <BButton
                v-if="pages.length"
                variant="secondary"
                :disabled="busy"
                @click="onNew"
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
              <BFormCheckbox v-model="downloadImage" :unchecked-value="false">
                Bild herunterladen und lokal speichern (empfohlen)
              </BFormCheckbox>
              <small class="text-muted d-block">
                URL-Bilder können nach einiger Zeit ungültig werden. Lokale
                Speicherung wird empfohlen.
              </small>
            </div>

            <div v-if="downloadingImage" class="mb-3">
              <div class="spinner-border spinner-border-sm me-2"></div>
              Bild wird heruntergeladen...
            </div>

            <div v-if="importing" class="text-muted mb-3" role="status">
              <span class="spinner-border spinner-border-sm me-2"></span>
              <template v-if="uploadProgress.total">
                Vorlage wird gespeichert (Seite {{ uploadCurrent }} von
                {{ uploadProgress.total }})
              </template>
              <template v-else>Rezept wird gespeichert</template>
            </div>

            <BButton
              @click="importRecipe"
              variant="primary"
              :disabled="downloadingImage || importing"
            >
              <i class="bi bi-download"></i> Rezept importieren
            </BButton>
            <BButton
              @click="result = null"
              variant="secondary"
              class="ms-2"
              :disabled="importing"
            >
              <i class="bi bi-x"></i> Verwerfen
            </BButton>
          </div>
        </div>

        <div v-if="error" class="mt-4 alert alert-danger">
          <i class="bi bi-exclamation-triangle"></i> {{ error }}
        </div>

        <!-- Rohantwort (nur admin) -->
        <details v-if="rawJson && isAdmin" class="mt-3">
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
