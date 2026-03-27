<template>
  <div>
    <form>
      <div class="form-group">
        <label :for="'new-ingredient-name' + index" class="col-form-label"
          >Neue Bezeichnung für {{ ingredient.name }}</label
        >
        <input
          type="text"
          class="form-control"
          :id="'new-ingredient-name' + index"
          v-model="newName"
          @keydown.enter.prevent="renameIngredient"
          ref="inputField"
        />
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import type { Ingredient } from "@/types/recipe";

const props = defineProps<{
  ingredient: Ingredient;
  index: number;
  sections: string[];
}>();

const emit = defineEmits<{
  update: [value: Ingredient];
}>();

const newName = ref("");
const inputField = ref<HTMLInputElement>();

const renameIngredient = () => {
  if (!newName.value.trim()) return;

  // Create new ingredient object with updated name
  const ingredient: Ingredient = {
    ...JSON.parse(JSON.stringify(props.ingredient)),
    name: newName.value,
  };

  emit("update", ingredient);
};

onMounted(() => {
  // Set focus when component mounts
  nextTick(() => {
    inputField.value?.focus();
  });
});
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped></style>
