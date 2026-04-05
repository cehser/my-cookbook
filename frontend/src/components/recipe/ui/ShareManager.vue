<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { sharesApi, type Share } from "@/api/shares";
import { useToast } from "@/composables/useToast";

const props = defineProps<{
  show: boolean;
  recipeId: string;
}>();

defineEmits<{
  close: [];
}>();

const { toast } = useToast();
const shares = ref<Share[]>([]);
const loading = ref(false);
const creating = ref(false);
const maxShareDays = ref(30);
const expiresInDays = ref(7);

const expiryOptions = computed(() => {
  const max = maxShareDays.value;
  const options = [
    { value: 1, label: "1 Tag" },
    { value: 3, label: "3 Tage" },
    { value: 7, label: "7 Tage" },
    { value: 14, label: "14 Tage" },
    { value: 30, label: "30 Tage" },
    { value: 90, label: "90 Tage" },
    { value: 180, label: "180 Tage" },
    { value: 365, label: "365 Tage" },
  ];
  return options.filter((o) => o.value <= max);
});

function shareUrl(token: string): string {
  return `${window.location.origin}/s/${token}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isExpiringSoon(iso: string): boolean {
  const diff = new Date(iso).getTime() - Date.now();
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000; // < 3 Tage
}

async function loadConfig() {
  try {
    const config = await sharesApi.getConfig();
    maxShareDays.value = config.max_share_days;
    // Default to 7 days or max if lower
    expiresInDays.value = Math.min(7, config.max_share_days);
  } catch {
    /* fallback to defaults */
  }
}

async function loadShares() {
  loading.value = true;
  try {
    shares.value = await sharesApi.list(props.recipeId);
  } catch {
    toast("Share-Links konnten nicht geladen werden", "danger");
  } finally {
    loading.value = false;
  }
}

async function createLink() {
  creating.value = true;
  try {
    const share = await sharesApi.create(props.recipeId, expiresInDays.value);
    shares.value.unshift(share);
    await copyLink(share.token);
  } catch {
    toast("Link konnte nicht erstellt werden", "danger");
  } finally {
    creating.value = false;
  }
}

async function copyLink(token: string) {
  try {
    await navigator.clipboard.writeText(shareUrl(token));
    toast("Link kopiert!", "success");
  } catch {
    toast("Kopieren fehlgeschlagen", "danger");
  }
}

async function revokeLink(shareId: string) {
  try {
    await sharesApi.revoke(shareId);
    shares.value = shares.value.filter((s) => s.id !== shareId);
    toast("Link widerrufen", "success");
  } catch {
    toast("Widerrufen fehlgeschlagen", "danger");
  }
}

watch(
  () => props.show,
  (val) => {
    if (val) {
      loadConfig();
      loadShares();
    }
  },
);
</script>

<template>
  <Transition name="sidebar">
    <div
      v-if="show"
      class="share-sidebar-backdrop"
      @click.self="$emit('close')"
    >
      <aside class="share-sidebar">
        <div
          class="sidebar-header d-flex justify-content-between align-items-center"
        >
          <h5 class="mb-0"><i class="bi bi-share"></i> Share-Links</h5>
          <button
            type="button"
            class="btn-close"
            @click="$emit('close')"
          ></button>
        </div>

        <div class="sidebar-body">
          <!-- Neuen Link erstellen -->
          <div class="card mb-3">
            <div class="card-body p-3">
              <label class="form-label small fw-semibold"
                >Neuen Link erstellen</label
              >
              <div class="d-flex align-items-end gap-2">
                <div class="flex-grow-1">
                  <label class="form-label small text-muted mb-1"
                    >Gültig für</label
                  >
                  <select
                    v-model.number="expiresInDays"
                    class="form-select form-select-sm"
                  >
                    <option
                      v-for="opt in expiryOptions"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </option>
                  </select>
                </div>
                <button
                  class="btn btn-primary btn-sm"
                  @click="createLink"
                  :disabled="creating"
                >
                  <i class="bi bi-plus-circle"></i> Erstellen
                </button>
              </div>
            </div>
          </div>

          <!-- Lade-Spinner -->
          <div v-if="loading" class="text-center py-4">
            <div class="spinner-border spinner-border-sm" role="status"></div>
          </div>

          <!-- Keine Links -->
          <p
            v-else-if="!shares.length"
            class="text-muted small text-center py-3"
          >
            Noch keine Share-Links vorhanden.
          </p>

          <!-- Link-Liste -->
          <div v-else class="share-list">
            <div v-for="share in shares" :key="share.id" class="card mb-2">
              <div class="card-body p-2">
                <div class="d-flex align-items-start gap-2">
                  <div class="flex-grow-1 overflow-hidden">
                    <code class="small user-select-all text-break">{{
                      shareUrl(share.token)
                    }}</code>
                    <div class="text-muted mt-1" style="font-size: 0.72rem">
                      Erstellt: {{ formatDate(share.created_at) }}
                    </div>
                    <div
                      v-if="share.expires_at"
                      class="mt-1"
                      style="font-size: 0.72rem"
                      :class="
                        isExpiringSoon(share.expires_at)
                          ? 'text-warning'
                          : 'text-muted'
                      "
                    >
                      <i class="bi bi-clock"></i> Läuft ab:
                      {{ formatDate(share.expires_at) }}
                    </div>
                  </div>
                  <div class="d-flex flex-column gap-1">
                    <button
                      class="btn btn-sm btn-outline-secondary"
                      @click="copyLink(share.token)"
                      title="Link kopieren"
                    >
                      <i class="bi bi-clipboard"></i>
                    </button>
                    <button
                      class="btn btn-sm btn-outline-danger"
                      @click="revokeLink(share.id)"
                      title="Link widerrufen"
                    >
                      <i class="bi bi-x-circle"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.share-sidebar-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1060;
  background: rgba(0, 0, 0, 0.3);
}

.share-sidebar {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 380px;
  max-width: 90vw;
  background: #fff;
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  z-index: 1061;
}

.sidebar-header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #dee2e6;
  flex-shrink: 0;
}

.sidebar-body {
  padding: 1rem 1.25rem;
  overflow-y: auto;
  flex: 1;
}

.share-list {
  max-height: calc(100vh - 220px);
  overflow-y: auto;
}

/* Slide-in animation */
.sidebar-enter-active,
.sidebar-leave-active {
  transition: opacity 0.2s ease;
}
.sidebar-enter-active .share-sidebar,
.sidebar-leave-active .share-sidebar {
  transition: transform 0.25s ease;
}
.sidebar-enter-from,
.sidebar-leave-to {
  opacity: 0;
}
.sidebar-enter-from .share-sidebar,
.sidebar-leave-to .share-sidebar {
  transform: translateX(100%);
}
</style>
