<template>
  <div>
    <form>
      <div class="form-group">
        <label :for="'new-ingredient-name' + index" class="col-form-label"
          >Neue Bezeichnung für {{ Object.keys(ingredient)[0] }}</label
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

interface Ingredient {
  [key: string]: any;
  section?: string;
}

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

  const oldName = Object.keys(props.ingredient)[0];

  // Create new ingredient object instead of mutating prop
  const ingredient: Ingredient = {};
  ingredient[newName.value] = props.ingredient[oldName];
  ingredient.section = props.ingredient.section;

  // Emit the new ingredient without mutating the prop
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
