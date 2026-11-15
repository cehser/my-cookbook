<script setup lang="ts">
import { ref, onMounted } from "vue";
import { adminApi, type AIConnectionTest } from "@/api/admin";
import { ApiError } from "@/api/client";
import { useToast } from "@/composables/useToast";

const { toast } = useToast();

const siteMaxShareDays = ref(30);
const aiModelText = ref("");
const aiModelImage = ref("");
const openaiKeyConfigured = ref(false);
const aiTesting = ref(false);
const aiTestResult = ref<AIConnectionTest | null>(null);
const aiTestError = ref<string | null>(null);

onMounted(loadSiteSettings);

async function loadSiteSettings() {
  try {
    const s = await adminApi.getSettings();
    siteMaxShareDays.value = s.max_share_days;
    aiModelText.value = s.ai_model_text;
    aiModelImage.value = s.ai_model_image;
    openaiKeyConfigured.value = s.openai_key_configured;
  } catch {
    /* ignore if not admin */
  }
}

/** Fehlertext aus einer API-Antwort (`{"detail": "..."}`), sonst Fallback. */
function apiDetail(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    try {
      const detail = (JSON.parse(e.detail) as { detail?: unknown }).detail;
      if (typeof detail === "string") return detail;
    } catch {
      /* kein JSON */
    }
  }
  return fallback;
}

// PUT /admin/settings übernimmt nur gesendete Felder (exclude_unset); die
// Modelle nicht mitschicken, sonst prüft das Backend sie bei OpenAI.
async function saveSiteSettings() {
  try {
    await adminApi.updateSettings({ max_share_days: siteMaxShareDays.value });
    toast("Einstellungen gespeichert", "success");
  } catch (e) {
    toast(
      apiDetail(e, "Einstellungen konnten nicht gespeichert werden"),
      "danger",
    );
  }
}

async function saveAiModels() {
  aiTestResult.value = null;
  aiTestError.value = null;
  try {
    // Backend prüft die Verfügbarkeit bei OpenAI und antwortet sonst mit 422/503
    const s = await adminApi.updateSettings({
      ai_model_text: aiModelText.value,
      ai_model_image: aiModelImage.value,
    });
    aiModelText.value = s.ai_model_text;
    aiModelImage.value = s.ai_model_image;
    toast("AI-Modelle gespeichert", "success");
  } catch (e) {
    toast(
      apiDetail(e, "AI-Modelle konnten nicht gespeichert werden"),
      "danger",
    );
    await loadSiteSettings(); // Eingabe auf den gespeicherten Stand zurücksetzen
  }
}

async function testAiConnection() {
  aiTesting.value = true;
  aiTestResult.value = null;
  aiTestError.value = null;
  try {
    aiTestResult.value = await adminApi.testAiConnection();
  } catch (e) {
    aiTestError.value = apiDetail(e, "Verbindungstest fehlgeschlagen");
  } finally {
    aiTesting.value = false;
  }
}
</script>

<template>
  <div class="mb-4">
    <h4><i class="bi bi-gear"></i> Einstellungen</h4>
    <div class="row align-items-center mb-2" style="max-width: 400px">
      <label class="col-auto col-form-label">Max. Share-Laufzeit (Tage)</label>
      <div class="col-auto">
        <input
          type="number"
          class="form-control form-control-sm"
          style="width: 80px"
          min="1"
          max="365"
          v-model.number="siteMaxShareDays"
          @change="saveSiteSettings"
        />
      </div>
    </div>

    <h5 class="mt-4"><i class="bi bi-robot"></i> AI-Import</h5>
    <p class="mb-2">
      OpenAI-Key konfiguriert:
      <strong :class="openaiKeyConfigured ? 'text-success' : 'text-danger'">
        {{ openaiKeyConfigured ? "ja" : "nein" }}
      </strong>
      <small class="text-muted"> (Umgebungsvariable OPENAI_API_KEY)</small>
    </p>
    <div class="row g-2 align-items-center mb-2" style="max-width: 500px">
      <label for="ai-model-text" class="col-sm-4 col-form-label"
        >Modell Text/URL</label
      >
      <div class="col-sm-8">
        <input
          id="ai-model-text"
          v-model.trim="aiModelText"
          class="form-control form-control-sm"
          autocomplete="off"
          placeholder="z. B. gpt-6-luna"
        />
      </div>
      <label for="ai-model-image" class="col-sm-4 col-form-label"
        >Modell Foto</label
      >
      <div class="col-sm-8">
        <input
          id="ai-model-image"
          v-model.trim="aiModelImage"
          class="form-control form-control-sm"
          autocomplete="off"
          placeholder="z. B. gpt-6-luna"
        />
      </div>
    </div>
    <BButton
      variant="primary"
      size="sm"
      :disabled="!aiModelText || !aiModelImage"
      @click="saveAiModels"
    >
      Modelle speichern
    </BButton>
    <BButton
      variant="secondary"
      size="sm"
      class="ms-2"
      :disabled="aiTesting || !openaiKeyConfigured"
      @click="testAiConnection"
    >
      <span
        v-if="aiTesting"
        class="spinner-border spinner-border-sm me-1"
      ></span>
      Verbindung testen
    </BButton>
    <ul v-if="aiTestResult" class="list-unstyled mt-2 mb-0">
      <li v-for="m in aiTestResult.models" :key="m.purpose">
        <i
          :class="
            m.available
              ? 'bi bi-check-circle text-success'
              : 'bi bi-x-circle text-danger'
          "
        ></i>
        {{ m.purpose }}: {{ m.model }}
        {{ m.available ? "verfügbar" : "nicht verfügbar" }}
      </li>
    </ul>
    <div v-if="aiTestError" class="alert alert-danger mt-2 mb-0">
      {{ aiTestError }}
    </div>
  </div>
</template>
