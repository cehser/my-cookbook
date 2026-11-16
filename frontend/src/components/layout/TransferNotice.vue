<script setup lang="ts">
// Meldet das Ergebnis der Übertragung vorgemerkter Rezepte als Toast. Liegt
// innerhalb von <BApp>, weil useToast den Orchestrator von BApp braucht.
import { watch } from "vue";
import { useRecipeStore } from "@/store/recipeStore";
import { useToast } from "@/composables/useToast";
import { transferToasts } from "@/js/appendFeedback";

const store = useRecipeStore();
const { toast } = useToast();

watch(
  () => store.transferReport,
  (report) => {
    if (!report) return;
    for (const { message, variant } of transferToasts(report)) {
      toast(message, variant);
    }
  },
);
</script>

<template>
  <span hidden></span>
</template>
