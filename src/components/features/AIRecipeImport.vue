<template>
  <div class="ai-import">
    <BCard>
      <BCardHeader>
        <h5><i class="bi bi-robot"></i> AI-Rezept-Import</h5>
      </BCardHeader>
      <BCardBody>
        <div v-if="!hasApiKey" class="alert alert-warning">
          <i class="bi bi-exclamation-triangle"></i>
          Bitte OpenAI API-Key in den
          <router-link to="/settings">Einstellungen</router-link> hinterlegen.
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
              @change="handleFileUpload"
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
                Speicherung ermöglicht WebDAV-Sync.
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
      </BCardBody>
    </BCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from "vue";
import { useStore } from "vuex";
import jsyaml from "js-yaml";
import UUID from "@/js/uuid";
import { SYSTEM_PROMPT } from "@/prompts/SYSTEM_PROMPT";
import type { Recipe } from "@/types/recipe";

const emit = defineEmits<{
  imported: [recipe: Recipe];
}>();

const store = useStore();

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
const stream = ref<MediaStream | null>(null);
const downloadImage = ref(true);
const downloadingImage = ref(false);

// Computed
const settings = computed(() => store.state.settings);
const hasApiKey = computed(() => {
  return (
    settings.value?.ai?.openai_api_key &&
    settings.value.ai.openai_api_key.length > 0
  );
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
  } catch (err: any) {
    error.value = "Kamera-Zugriff fehlgeschlagen: " + err.message;
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

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedImage.value = e.target?.result as string;
      capturedImage.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
};

const analyzeImage = async () => {
  if (!capturedImage.value) return;

  loading.value = true;
  error.value = null;
  result.value = null;

  try {
    const modelId = settings.value.ai.gpt_id || "gpt-4o";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.value.ai.openai_api_key}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Bitte extrahiere das Rezept aus diesem Bild.",
              },
              {
                type: "image_url",
                image_url: {
                  url: capturedImage.value,
                },
              },
            ],
          },
        ],
        max_completion_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
      throw new Error(`API-Fehler: ${errorMsg}`);
    }

    const data = await response.json();
    const yamlText = data.choices[0].message.content;

    // Extract YAML from markdown code blocks if present
    let cleanYaml = yamlText;
    const yamlMatch = yamlText.match(/```ya?ml\n([\s\S]*?)\n```/);
    if (yamlMatch) {
      cleanYaml = yamlMatch[1];
    }

    result.value = jsyaml.load(cleanYaml) as Recipe;
  } catch (err: any) {
    error.value = "Fehler bei der Analyse: " + err.message;
  } finally {
    loading.value = false;
  }
};

const analyzeText = async () => {
  loading.value = true;
  error.value = null;
  result.value = null;

  try {
    const modelId = settings.value.ai.gpt_id || "gpt-4o";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.value.ai.openai_api_key}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: textInput.value,
          },
        ],
        max_completion_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
      throw new Error(`API-Fehler: ${errorMsg}`);
    }

    const data = await response.json();
    const yamlText = data.choices[0].message.content;

    // Extract YAML from markdown code blocks if present
    let cleanYaml = yamlText;
    const yamlMatch = yamlText.match(/```ya?ml\n([\s\S]*?)\n```/);
    if (yamlMatch) {
      cleanYaml = yamlMatch[1];
    }

    result.value = jsyaml.load(cleanYaml) as Recipe;
  } catch (err: any) {
    error.value = "Fehler bei der Analyse: " + err.message;
  } finally {
    loading.value = false;
  }
};

const downloadImageFromUrl = async (url: string, recipeUuid: string) => {
  try {
    // Try multiple CORS proxies with fallback
    const proxies = [
      `https://corsproxy.io/?${encodeURIComponent(url)}`,
      `https://api.allorigins.win/raw?url=${url}`,
      `https://cors-anywhere.herokuapp.com/${url}`,
    ];

    let response: Response | null = null;
    let lastError: Error | null = null;

    for (const proxyUrl of proxies) {
      try {
        response = await fetch(proxyUrl, {
          cache: "no-cache",
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (response.ok) {
          break; // Success, exit loop
        }
      } catch (err) {
        lastError = err as Error;
        continue; // Try next proxy
      }
    }

    if (!response || !response.ok) {
      throw lastError || new Error("Alle Proxy-Server fehlgeschlagen");
    }

    const blob = await response.blob();

    // Detect extension from content-type or URL
    let extension = "jpg";
    const contentType = response.headers.get("content-type");
    if (contentType) {
      extension = contentType.split("/")[1]?.split(";")[0] || "jpg";
    } else {
      // Fallback: try to extract from URL
      const urlMatch = url.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i);
      if (urlMatch) extension = urlMatch[1];
    }

    const filename = `${recipeUuid}.${extension}`;

    // Store in recipe_pictures - create new object to trigger reactivity
    const updatedPictures = {
      ...store.state.recipe_pictures,
      [filename]: blob,
    };
    store.commit("setRecipesPictures", updatedPictures);
    store.dispatch("saveRecipePictures");

    return filename;
  } catch (err: any) {
    console.error("Image download failed:", err);
    throw new Error(`Bild konnte nicht heruntergeladen werden: ${err.message}`);
  }
};

const importRecipe = async () => {
  if (!result.value) return;

  // Generate UUID if not present
  if (!result.value.recipe_uuid) {
    result.value.recipe_uuid = UUID.generateUUID();
  }

  // Download image if requested and imageurl exists
  if (downloadImage.value && result.value.imageurl) {
    downloadingImage.value = true;
    try {
      const filename = await downloadImageFromUrl(
        result.value.imageurl,
        result.value.recipe_uuid,
      );

      // Move to cloud_images array and clear imageurl
      if (!result.value.cloud_images) {
        result.value.cloud_images = [];
      }
      result.value.cloud_images.push(filename);
      result.value.imageurl = null;
    } catch (err: any) {
      error.value = err.message;
      downloadingImage.value = false;
      return;
    }
    downloadingImage.value = false;
  }

  // Dispatch to store
  store.dispatch("appendRecipe", result.value);
  store.dispatch("saveToLocalStorage");

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

<style scoped>
.camera-container {
  text-align: center;
}

.camera-preview {
  width: 100%;
  max-width: 500px;
  border-radius: 8px;
  background: #000;
}

.recipe-preview {
  padding: 1rem;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  background: #f8f9fa;
}
</style>
