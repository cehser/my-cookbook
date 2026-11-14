<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from "vue";
import { useRecipeStore } from "@/store/recipeStore";
import { generateUUID } from "@/js/uuid";
import { initRecipe } from "@/js/recipes";
import { aiApi, aiErrorMessage, type AIImportResponse } from "@/api/ai";
import type { Recipe } from "@/types/recipe";

const emit = defineEmits<{
  imported: [recipe: Recipe];
}>();

const store = useRecipeStore();

// Template refs
const cameraVideo = ref<HTMLVideoElement>();
const cameraCanvas = ref<HTMLCanvasElement>();

// State
const cameraActive = ref(false);
const capturedImage = ref<string | null>(null);
const uploadedFile = ref<File | null>(null);
const uploadedImage = ref<string | null>(null);
const textInput = ref("");
const loading = ref(false);
const result = ref<Recipe | null>(null);
const error = ref<string | null>(null);
const rawJson = ref<string | null>(null);
const stream = ref<MediaStream | null>(null);
const downloadImage = ref(true);
const downloadingImage = ref(false);

// Computed
const settings = computed(() => store.settings);
const hasApiKey = computed(() => {
  // Backend holds the key — check if user is authenticated
  return true;
});

// Methods
const startCamera = async () => {
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    if (cameraVideo.value) {
      cameraVideo.value.srcObject = stream.value;
    }
    cameraActive.value = true;
    capturedImage.value = null;
  } catch (err: unknown) {
    error.value =
      "Kamera-Zugriff fehlgeschlagen: " +
      (err instanceof Error ? err.message : String(err));
  }
};

const stopCamera = () => {
  if (stream.value) {
    stream.value.getTracks().forEach((track) => track.stop());
    stream.value = null;
    cameraActive.value = false;
  }
};

const capturePhoto = () => {
  const video = cameraVideo.value;
  const canvas = cameraCanvas.value;
  if (!video || !canvas) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")?.drawImage(video, 0, 0);
  capturedImage.value = canvas.toDataURL("image/jpeg");
  stopCamera();
};

watch(uploadedFile, (file) => {
  if (!file) {
    uploadedImage.value = null;
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    uploadedImage.value = e.target?.result as string;
    capturedImage.value = e.target?.result as string;
  };
  reader.readAsDataURL(file);
});

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

const analyzeImage = () => {
  const image = capturedImage.value;
  if (!image) return;
  return runAnalysis(async () => {
    // Data URI → Blob für den Upload
    const blob = await (await fetch(image)).blob();
    return aiApi.importImage(blob, "photo.jpg");
  });
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
  capturedImage.value = null;
  uploadedImage.value = null;
  textInput.value = "";
  downloadImage.value = true;
};

// Lifecycle
onBeforeUnmount(() => {
  stopCamera();
});
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
          <!-- Camera Tab -->
          <BTab title="Kamera" active>
            <div class="camera-container">
              <video
                ref="cameraVideo"
                class="camera-preview"
                autoplay
                playsinline
              ></video>
              <canvas ref="cameraCanvas" style="display: none"></canvas>

              <div class="camera-controls mt-3">
                <BButton
                  v-if="!cameraActive"
                  @click="startCamera"
                  variant="primary"
                >
                  <i class="bi bi-camera"></i> Kamera starten
                </BButton>
                <BButton v-else @click="capturePhoto" variant="success">
                  <i class="bi bi-camera-fill"></i> Foto aufnehmen
                </BButton>
                <BButton
                  v-if="cameraActive"
                  @click="stopCamera"
                  variant="secondary"
                  class="ms-2"
                >
                  <i class="bi bi-x-circle"></i> Kamera stoppen
                </BButton>
              </div>

              <div v-if="capturedImage" class="mt-3">
                <img
                  :src="capturedImage"
                  class="img-thumbnail"
                  alt="Captured"
                  style="max-width: 300px"
                />
                <div class="mt-2">
                  <BButton
                    @click="analyzeImage"
                    variant="primary"
                    :disabled="loading"
                  >
                    <span
                      v-if="loading"
                      class="spinner-border spinner-border-sm me-2"
                    ></span>
                    <i v-else class="bi bi-magic"></i>
                    Rezept erkennen
                  </BButton>
                  <BButton
                    @click="capturedImage = null"
                    variant="secondary"
                    class="ms-2"
                  >
                    <i class="bi bi-arrow-counterclockwise"></i> Neu
                  </BButton>
                </div>
              </div>
            </div>
          </BTab>

          <!-- Upload Tab -->
          <BTab title="Foto hochladen">
            <BFormFile
              v-model="uploadedFile"
              accept="image/*"
              placeholder="Wähle ein Foto aus..."
            ></BFormFile>

            <div v-if="uploadedImage" class="mt-3">
              <img
                :src="uploadedImage"
                class="img-thumbnail"
                alt="Uploaded"
                style="max-width: 300px"
              />
              <div class="mt-2">
                <BButton
                  @click="analyzeImage"
                  variant="primary"
                  :disabled="loading"
                >
                  <span
                    v-if="loading"
                    class="spinner-border spinner-border-sm me-2"
                  ></span>
                  <i v-else class="bi bi-magic"></i>
                  Rezept erkennen
                </BButton>
              </div>
            </div>
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
.camera-container {
  text-align: center;
}

.camera-preview {
  width: 100%;
  max-width: 500px;
  border-radius: var(--radius-md);
  background: #000;
}

.recipe-preview {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-divider);
}
</style>
