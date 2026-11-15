<script setup lang="ts">
import { ref } from "vue";
import { adminApi } from "@/api/admin";
import { useToast } from "@/composables/useToast";
import { useRecipeStore } from "@/store/recipeStore";

// Zwei Wurzelknoten ohne Hülle: Die Knöpfe stehen in der Knopfleiste der
// Rezeptverwaltung (Slot `actions`) wie bisher in einer Reihe.

const store = useRecipeStore();
const { toast } = useToast();

const cleanupRunning = ref(false);

async function migrateImages() {
  try {
    const { api } = await import("@/api/client");
    // Long-running migration: no client timeout
    const result = await api.post<{ migrated: number; failed: number }>(
      "/admin/migrate-images",
      undefined,
      { timeoutMs: 0 },
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

async function cleanupImages() {
  cleanupRunning.value = true;
  try {
    const result = await adminApi.cleanupImages();
    const stripped = await adminApi.stripImageIds();
    const messages: string[] = [];
    if (result.removed > 0) {
      messages.push(`${result.removed} verwaiste Bild-Einträge entfernt`);
    }
    if (stripped.cleaned > 0) {
      messages.push(
        `${stripped.cleaned} Rezepte mit veralteter Image-ID bereinigt`,
      );
    }
    if (messages.length === 0) {
      toast("Keine Probleme gefunden.", "success");
    } else {
      toast(messages.join(". ") + ".", "success");
      store.loadRecipesFromApi();
    }
  } catch (e) {
    toast("Bereinigung fehlgeschlagen: " + (e as Error).message, "danger");
  } finally {
    cleanupRunning.value = false;
  }
}
</script>

<template>
  <BButton class="btn m-2" @click="migrateImages"
    ><i class="bi bi-images"></i><br />Bild-URLs migrieren</BButton
  >
  <BButton class="btn m-2" :disabled="cleanupRunning" @click="cleanupImages"
    ><i class="bi bi-trash3"></i><br />Verwaiste Bilder bereinigen</BButton
  >
</template>
