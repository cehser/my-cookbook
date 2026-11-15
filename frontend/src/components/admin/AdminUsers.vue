<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { adminApi, type AdminUser } from "@/api/admin";
import { useToast } from "@/composables/useToast";
import { formatDate } from "./format";

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

const { toast } = useToast();

const users = ref<UserEntry[]>([]);
const usersLoading = ref(false);
const usersError = ref<string | null>(null);

const pendingUsers = computed(() =>
  users.value.filter((u) => u.role === "pending"),
);

onMounted(loadUsers);

async function loadUsers() {
  usersLoading.value = true;
  usersError.value = null;
  try {
    users.value = (await adminApi.listUsers()).map(
      (u: AdminUser) => ({ ...u, saving: false }) as UserEntry,
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
</script>

<template>
  <div class="mb-4">
    <h4><i class="bi bi-people"></i> Benutzer</h4>
    <div v-if="usersLoading" class="text-muted">Lade Benutzer…</div>
    <div v-else-if="usersError" class="text-danger">{{ usersError }}</div>
    <div v-else>
      <div v-if="pendingUsers.length" class="alert alert-warning py-2 mb-3">
        <i class="bi bi-exclamation-triangle"></i>
        <strong>{{ pendingUsers.length }}</strong> Nutzer warten auf Freigabe
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
                    ? [u.given_name, u.family_name].filter(Boolean).join(" ")
                    : u.display_name
                }}
              </div>
              <small v-if="u.given_name || u.family_name" class="text-muted">{{
                u.display_name
              }}</small>
            </td>
            <td>
              <small>{{ u.email || "—" }}</small>
            </td>
            <td>
              <select
                class="form-select form-select-sm"
                style="width: auto; min-width: 120px"
                :value="u.role"
                @change="
                  changeRole(u, ($event.target as HTMLSelectElement).value)
                "
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
</template>
