<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import AppNavbar from "@/components/layout/AppNavbar.vue";
import { adminApi } from "@/api/admin";
import { useRecipeHelper } from "@/composables/useRecipeHelper";
import { useToast } from "@/composables/useToast";
import { useRecipeStore } from "@/store/recipeStore";
import { generateUUID } from "@/js/uuid";
import { deepCopyYaml } from "@/js/deepCopy";
import {
  loadNewRecipe as createNewRecipe,
  loadSample as createSampleRecipe,
} from "@/js/recipes";
import jsyaml from "js-yaml";
import { recipeUrl } from "@/js/slug";

const router = useRouter();
const store = useRecipeStore();
const { toast } = useToast();

const recipeId = ref("");
const { recipes_list, current_recipe } = useRecipeHelper({ recipeId });

// Data
interface UserEntry {
  oidc_sub: string;
  display_name: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  role: string;
  created_at: string;
  last_login?: string;
  saving: boolean;
}

interface ShareEntry {
  id: string;
  token: string;
  recipe_name: string;
  created_by_name: string;
  created_at: string;
  expires_at?: string;
  is_active: boolean;
}

const users = ref<UserEntry[]>([]);
const usersLoading = ref(false);
const usersError = ref<string | null>(null);
const siteMaxShareDays = ref(30);
const shares = ref<ShareEntry[]>([]);
const sharesLoading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

// Computed
const settings = computed(() => store.settings);
const recipes = computed(() => store.recipes);
const recipe_pictures = computed(() => store.recipe_pictures);

const pendingUsers = computed(() =>
  users.value.filter((u) => u.role === "pending"),
);

// Lifecycle
function onKeyDown(event: KeyboardEvent) {
  if (event.ctrlKey && event.code === "KeyS") {
    event.preventDefault();
    saveToLocalStorage();
  }
}

onMounted(() => {
  loadUsers();
  loadSiteSettings();
  loadShares();
  document.addEventListener("keydown", onKeyDown);
});

onUnmounted(() => {
  document.removeEventListener("keydown", onKeyDown);
});

// Methods
function formatDate(iso: string | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isExpired(expiresAt?: string) {
  return expiresAt && new Date(expiresAt) < new Date();
}

function isExpiringSoon(expiresAt?: string) {
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
    await navigator.clipboard.writeText(shareUrl(token));
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

async function loadUsers() {
  usersLoading.value = true;
  usersError.value = null;
  try {
    users.value = (await adminApi.listUsers()).map(
      (u: Record<string, unknown>) => ({ ...u, saving: false }) as UserEntry,
    );
  } catch {
    usersError.value = "Benutzer konnten nicht geladen werden.";
  } finally {
    usersLoading.value = false;
  }
}

async function changeRole(user: UserEntry, newRole: string) {
  const oldRole = user.role;
  user.role = newRole;
  user.saving = true;
  try {
    await adminApi.updateRole(user.oidc_sub, newRole);
    toast(`Rolle von ${user.display_name} → ${newRole}`, "success");
  } catch (e) {
    user.role = oldRole;
    toast(
      "Rolle konnte nicht geändert werden: " + (e as Error).message,
      "danger",
    );
  } finally {
    user.saving = false;
  }
}

async function loadSiteSettings() {
  try {
    const s = await adminApi.getSettings();
    siteMaxShareDays.value = s.max_share_days;
  } catch {
    /* ignore if not admin */
  }
}

async function saveSiteSettings() {
  try {
    await adminApi.updateSettings({ max_share_days: siteMaxShareDays.value });
    toast("Einstellungen gespeichert", "success");
  } catch {
    toast("Einstellungen konnten nicht gespeichert werden", "danger");
  }
}

function navSelected(uuid: string) {
  const recipe = store.recipes.find((r) => r.recipe_uuid === uuid);
  router.push(recipeUrl(uuid, recipe?.recipe_name));
}

function deleteRecipe(index: number) {
  store.deleteRecipe(index);
}

function copyRecipe(index: number) {
  const recipe = deepCopyYaml(store.recipes[index]);
  recipe.recipe_uuid = generateUUID();
  store.appendRecipe(recipe);
}

function newRecipe() {
  store.appendRecipe(createNewRecipe());
}

function loadSample() {
  store.appendRecipe(createSampleRecipe());
}

async function migrateImages() {
  try {
    const { api } = await import("@/api/client");
    const result = await api.post<{ migrated: number; failed: number }>(
      "/admin/migrate-images",
    );
    toast(
      `Migration: ${result.migrated} Bilder gespeichert, ${result.failed} fehlgeschlagen.`,
      result.failed > 0 ? "warning" : "success",
    );
    store.loadRecipesFromApi();
  } catch (e) {
    toast("Migration fehlgeschlagen: " + (e as Error).message, "danger");
  }
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
      const recipe = jsyaml.load(e.target?.result as string) as {
        recipe_name: string;
      };
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
  <div id="administration">
    <AppNavbar
      @update:selected="navSelected"
      :recipes_list="recipes_list"
      selected=""
      :read_only="settings.read_only"
    >
    </AppNavbar>
    <BContainer>
      <h2>Verwaltung</h2>

      <!-- User Management Section -->
      <div class="mb-4">
        <h4><i class="bi bi-people"></i> Benutzer</h4>
        <div v-if="usersLoading" class="text-muted">Lade Benutzer…</div>
        <div v-else-if="usersError" class="text-danger">{{ usersError }}</div>
        <div v-else>
          <div v-if="pendingUsers.length" class="alert alert-warning py-2 mb-3">
            <i class="bi bi-exclamation-triangle"></i>
            <strong>{{ pendingUsers.length }}</strong> Nutzer warten auf
            Freigabe
          </div>
          <table class="table table-sm table-hover align-middle">
            <thead class="table-light">
              <tr>
                <th>Name</th>
                <th>E-Mail</th>
                <th>Rolle</th>
                <th>Erstellt</th>
                <th>Letzter Login</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="u in users"
                :key="u.oidc_sub"
                :class="{ 'table-warning': u.role === 'pending' }"
              >
                <td>
                  <div>
                    {{
                      u.given_name || u.family_name
                        ? [u.given_name, u.family_name]
                            .filter(Boolean)
                            .join(" ")
                        : u.display_name
                    }}
                  </div>
                  <small
                    v-if="u.given_name || u.family_name"
                    class="text-muted"
                    >{{ u.display_name }}</small
                  >
                </td>
                <td>
                  <small>{{ u.email || "—" }}</small>
                </td>
                <td>
                  <select
                    class="form-select form-select-sm"
                    style="width: auto; min-width: 120px"
                    :value="u.role"
                    @change="changeRole(u, $event.target.value)"
                    :disabled="u.saving"
                  >
                    <option value="pending">⏳ Pending</option>
                    <option value="readonly">👁️ Readonly</option>
                    <option value="editor">✏️ Editor</option>
                    <option value="admin">🛡️ Admin</option>
                  </select>
                </td>
                <td>{{ formatDate(u.created_at) }}</td>
                <td>{{ u.last_login ? formatDate(u.last_login) : "—" }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <hr />

      <!-- Site Settings (Admin only) -->
      <div v-if="settings.role === 'admin'" class="mb-4">
        <h4><i class="bi bi-gear"></i> Einstellungen</h4>
        <div class="row align-items-center mb-2" style="max-width: 400px">
          <label class="col-auto col-form-label"
            >Max. Share-Laufzeit (Tage)</label
          >
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
      </div>

      <hr />

      <!-- Share-Links Übersicht (Admin only) -->
      <div v-if="settings.role === 'admin'" class="mb-4">
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
                  <span
                    v-else-if="isExpired(s.expires_at)"
                    class="badge bg-danger"
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

      <hr />

      <div class="d-flex flex-wrap">
        <BButton
          v-if="!settings.read_only && settings.role === 'admin'"
          class="btn m-2"
          @click="migrateImages"
          ><i class="bi bi-images"></i><br />Bild-URLs migrieren</BButton
        >
        <BButton v-if="!settings.read_only" class="btn m-2" @click="newRecipe"
          ><i class="bi bi-file-earmark-plus"></i><br />Neues Rezept</BButton
        >
        <BButton v-if="!settings.read_only" class="btn m-2" @click="loadSample"
          ><i class="bi bi-file-earmark-text"></i><br />Beispielrezept</BButton
        >
        <BButton
          v-if="!settings.read_only && settings.expert_mode"
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

      <BListGroup flush v-for="(recipe, index) in recipes" :key="index">
        <BListGroupItem
          >{{ recipe.recipe_name }}
          <BButton
            v-if="!settings.read_only"
            class="btn-sm"
            @click="deleteRecipe(index)"
            ><i class="bi bi-x"></i
          ></BButton>
          <BButton
            v-if="!settings.read_only"
            class="btn-sm"
            @click="copyRecipe(index)"
            ><i class="bi bi-files"></i
          ></BButton>
          <BButton
            v-if="settings.expert_mode"
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
    </BContainer>
  </div>
</template>
