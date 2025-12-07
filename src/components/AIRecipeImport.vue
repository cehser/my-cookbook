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

<script>
import { mapState } from "vuex";
import jsyaml from "js-yaml";
import UUID from "../js/uuid";
import { SYSTEM_PROMPT } from "../prompts/SYSTEM_PROMPT";

export default {
  name: "AIRecipeImport",
  data() {
    return {
      cameraActive: false,
      capturedImage: null,
      uploadedFile: null,
      uploadedImage: null,
      textInput: "",
      loading: false,
      result: null,
      error: null,
      stream: null,
      downloadImage: true,
      downloadingImage: false,
    };
  },
  computed: {
    ...mapState(["settings"]),
    hasApiKey() {
      return (
        this.settings?.ai?.openai_api_key &&
        this.settings.ai.openai_api_key.length > 0
      );
    },
  },
  beforeUnmount() {
    this.stopCamera();
  },
  methods: {
    async startCamera() {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        this.$refs.cameraVideo.srcObject = this.stream;
        this.cameraActive = true;
        this.capturedImage = null;
      } catch (err) {
        this.error = "Kamera-Zugriff fehlgeschlagen: " + err.message;
      }
    },

    stopCamera() {
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
        this.cameraActive = false;
      }
    },

    capturePhoto() {
      const video = this.$refs.cameraVideo;
      const canvas = this.$refs.cameraCanvas;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      this.capturedImage = canvas.toDataURL("image/jpeg");
      this.stopCamera();
    },

    handleFileUpload(event) {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.uploadedImage = e.target.result;
          this.capturedImage = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    },

    async analyzeImage() {
      if (!this.capturedImage) return;

      this.loading = true;
      this.error = null;
      this.result = null;

      try {
        const modelId = this.settings.ai.gpt_id || "gpt-4o";

        const response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.settings.ai.openai_api_key}`,
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
                        url: this.capturedImage,
                      },
                    },
                  ],
                },
              ],
              max_completion_tokens: 4000,
            }),
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg =
            errorData.error?.message || `HTTP ${response.status}`;
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

        this.result = jsyaml.load(cleanYaml);
      } catch (err) {
        this.error = "Fehler bei der Analyse: " + err.message;
      } finally {
        this.loading = false;
      }
    },

    async analyzeText() {
      this.loading = true;
      this.error = null;
      this.result = null;

      try {
        const modelId = this.settings.ai.gpt_id || "gpt-4o";

        const response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.settings.ai.openai_api_key}`,
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
                  content: this.textInput,
                },
              ],
              max_completion_tokens: 4000,
            }),
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg =
            errorData.error?.message || `HTTP ${response.status}`;
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

        this.result = jsyaml.load(cleanYaml);
      } catch (err) {
        this.error = "Fehler bei der Analyse: " + err.message;
      } finally {
        this.loading = false;
      }
    },

    async downloadImageFromUrl(url, recipeUuid) {
      try {
        // Try multiple CORS proxies with fallback
        const proxies = [
          `https://corsproxy.io/?${encodeURIComponent(url)}`,
          `https://api.allorigins.win/raw?url=${url}`,
          `https://cors-anywhere.herokuapp.com/${url}`,
        ];

        let response = null;
        let lastError = null;

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
            lastError = err;
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
          ...this.$store.state.recipe_pictures,
          [filename]: blob,
        };
        this.$store.commit("setRecipesPictures", updatedPictures);
        this.$store.dispatch("saveRecipePictures");

        return filename;
      } catch (err) {
        console.error("Image download failed:", err);
        throw new Error(
          `Bild konnte nicht heruntergeladen werden: ${err.message}`,
        );
      }
    },

    async importRecipe() {
      // Generate UUID if not present
      if (!this.result.recipe_uuid) {
        this.result.recipe_uuid = UUID.generateUUID();
      }

      // Download image if requested and imageurl exists
      if (this.downloadImage && this.result.imageurl) {
        this.downloadingImage = true;
        try {
          const filename = await this.downloadImageFromUrl(
            this.result.imageurl,
            this.result.recipe_uuid,
          );

          // Move to cloud_images array and clear imageurl
          if (!this.result.cloud_images) {
            this.result.cloud_images = [];
          }
          this.result.cloud_images.push(filename);
          this.result.imageurl = null;
        } catch (err) {
          this.error = err.message;
          this.downloadingImage = false;
          return;
        }
        this.downloadingImage = false;
      }

      // Dispatch to store
      this.$store.dispatch("appendRecipe", this.result);
      this.$store.dispatch("saveToLocalStorage");

      // Emit success
      this.$emit("imported", this.result);

      // Reset
      this.result = null;
      this.capturedImage = null;
      this.uploadedImage = null;
      this.textInput = "";
      this.downloadImage = true;
    },
  },
};
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
