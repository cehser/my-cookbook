<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useClipboard } from "@vueuse/core";
import { adminApi } from "@/api/admin";
import { formatDate } from "./format";

interface ShareEntry {
  id: string;
  token: string;
  recipe_name: string;
  created_by_name: string;
  created_at: string;
  expires_at?: string | null;
  is_active: boolean;
}

const shares = ref<ShareEntry[]>([]);
const sharesLoading = ref(false);

const { copy } = useClipboard();

onMounted(loadShares);

function isExpired(expiresAt?: string | null) {
  return expiresAt && new Date(expiresAt) < new Date();
}

function isExpiringSoon(expiresAt?: string | null) {
  if (!expiresAt) return false;
  const diff = new Date(expiresAt).getTime() - new Date().getTime();
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
}

function shareRowClass(s: ShareEntry) {
  if (!s.is_active) return "text-muted";
  if (isExpired(s.expires_at)) return "text-muted";
  return "";
}

function shareUrl(token: string) {
  return `${window.location.origin}/s/${token}`;
}

async function copyShareLink(token: string) {
  try {
    await copy(shareUrl(token));
  } catch {
    /* ignore */
  }
}

async function loadShares() {
  sharesLoading.value = true;
  try {
    shares.value = await adminApi.listShares();
  } catch (e) {
    console.error("Failed to load shares", e);
  } finally {
    sharesLoading.value = false;
  }
}

async function revokeShare(share: ShareEntry) {
  if (!confirm(`Share-Link für "${share.recipe_name}" widerrufen?`)) return;
  try {
    await adminApi.revokeShare(share.id);
    share.is_active = false;
  } catch (e) {
    console.error("Failed to revoke share", e);
  }
}
</script>

<template>
  <div class="mb-4">
    <h4><i class="bi bi-share"></i> Share-Links</h4>
    <div v-if="sharesLoading" class="text-muted">Lade Share-Links…</div>
    <div v-else-if="!shares.length" class="text-muted">
      Keine Share-Links vorhanden.
    </div>
    <div v-else class="table-responsive">
      <table class="table table-sm table-hover align-middle">
        <thead class="table-light">
          <tr>
            <th>Rezept</th>
            <th>Link</th>
            <th>Erstellt von</th>
            <th>Erstellt am</th>
            <th>Läuft ab</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in shares" :key="s.id" :class="shareRowClass(s)">
            <td>{{ s.recipe_name }}</td>
            <td>
              <div class="d-flex align-items-center gap-1">
                <code
                  class="text-truncate"
                  style="max-width: 120px"
                  :title="shareUrl(s.token)"
                  >{{ s.token }}</code
                >
                <button
                  class="btn btn-sm btn-outline-secondary py-0 px-1"
                  @click="copyShareLink(s.token)"
                  title="Link kopieren"
                >
                  <i class="bi bi-clipboard"></i>
                </button>
              </div>
            </td>
            <td>{{ s.created_by_name }}</td>
            <td>{{ formatDate(s.created_at) }}</td>
            <td>{{ s.expires_at ? formatDate(s.expires_at) : "—" }}</td>
            <td>
              <span v-if="!s.is_active" class="badge bg-secondary"
                >Widerrufen</span
              >
              <span v-else-if="isExpired(s.expires_at)" class="badge bg-danger"
                >Abgelaufen</span
              >
              <span
                v-else-if="isExpiringSoon(s.expires_at)"
                class="badge bg-warning text-dark"
                >Läuft bald ab</span
              >
              <span v-else class="badge bg-success">Aktiv</span>
            </td>
            <td>
              <button
                v-if="s.is_active && !isExpired(s.expires_at)"
                class="btn btn-sm btn-outline-danger"
                @click="revokeShare(s)"
                title="Widerrufen"
              >
                <i class="bi bi-x-circle"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
