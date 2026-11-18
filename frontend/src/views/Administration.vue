<script setup lang="ts">
import { computed } from "vue";
import { useRecipeStore } from "@/store/recipeStore";
import AdminUsers from "@/components/admin/AdminUsers.vue";
import AdminSettings from "@/components/admin/AdminSettings.vue";
import AdminShares from "@/components/admin/AdminShares.vue";
import AdminMaintenance from "@/components/admin/AdminMaintenance.vue";
import AdminRecipes from "@/components/admin/AdminRecipes.vue";

const store = useRecipeStore();

// Sichtbarkeit je Abschnitt allein nach Rolle
const isAdmin = computed(() => store.settings.role === "admin");
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

      <AdminRecipes :is-admin="isAdmin">
        <template #actions>
          <AdminMaintenance v-if="isAdmin" />
        </template>
      </AdminRecipes>
    </BContainer>
  </div>
</template>
