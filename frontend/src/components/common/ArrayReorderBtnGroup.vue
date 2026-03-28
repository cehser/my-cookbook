<script setup lang="ts" generic="T">
import { useRecipeHelper } from "@/composables/useRecipeHelper";
import { ref } from "vue";

defineProps<{
  array: T[];
  index: number;
}>();

const selectedRef = ref("");
const { swapElements } = useRecipeHelper({ recipeId: selectedRef });
</script>

<template>
  <div class="btn-group-vertical">
    <BButton
      class="btn-xs"
      @click="swapElements(array, index, index - 1)"
      :disabled="index == 0"
      ><i class="bi bi-chevron-up"></i
    ></BButton>
    <BButton
      class="btn-xs"
      @click="swapElements(array, index, index + 1)"
      :disabled="index == array.length - 1"
      ><i class="bi bi-chevron-down"></i
    ></BButton>
  </div>
</template>

<style scoped>
.btn-group-xs > .btn,
.btn-xs {
  padding: 0.125rem 0.2rem;
  font-size: 0.7rem;
  line-height: 0.5;
  border-radius: 0.2rem;
}
</style>
