<script setup lang="ts">
import { computed } from "vue";
import { useRecipeStore } from "@/store/recipeStore";
import AdminUsers from "@/components/admin/AdminUsers.vue";
import AdminSettings from "@/components/admin/AdminSettings.vue";
import AdminShares from "@/components/admin/AdminShares.vue";
import AdminMaintenance from "@/components/admin/AdminMaintenance.vue";
import AdminRecipes from "@/components/admin/AdminRecipes.vue";

const store = useRecipeStore();

// Sichtbarkeit je Abschnitt: Rolle, read_only, expert_mode
const settings = computed(() => store.settings);
const isAdmin = computed(() => settings.value.role === "admin");
</script>

<template>
  <div id="administration">
    <BContainer>
      <h2 class="mt-3">Verwaltung</h2>

      <AdminUsers />

      <hr />

      <AdminSettings v-if="isAdmin" />

      <hr />

      <AdminShares v-if="isAdmin" />

      <hr />

      <AdminRecipes
        :read-only="settings.read_only"
        :expert-mode="settings.expert_mode"
      >
        <template #actions>
          <AdminMaintenance v-if="!settings.read_only && isAdmin" />
        </template>
      </AdminRecipes>
    </BContainer>
  </div>
</template>
