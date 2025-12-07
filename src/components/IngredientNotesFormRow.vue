<template>
  <BRow>
    <BCol offset="1" sm="1">Notizen</BCol>
    <BCol sm="10">
      <BRow v-for="(note, index) in ingredient_data.notes" :key="index">
        <BCol sm="8"
          ><BFormInput
            :model-value="note"
            @update:model-value="updateNote(index, $event)"
          ></BFormInput
        ></BCol>
        <BCol sm="1"
          ><BButton @click="deleteNote(index)"
            ><i class="bi bi-trash"></i></BButton
        ></BCol>
      </BRow>
      <BRow>
        <BButton @click="addNote"><i class="bi bi-plus"></i></BButton>
      </BRow>
    </BCol>
  </BRow>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Ingredient {
  [key: string]: {
    notes?: string[];
  };
}

const props = defineProps<{
  ingredient: Ingredient;
  index: number;
}>();

const emit = defineEmits<{
  update: [value: Ingredient];
}>();

const ingredient_data = computed(() => {
  return props.ingredient[Object.keys(props.ingredient)[0]];
});

const addNote = () => {
  const updatedIngredient = JSON.parse(JSON.stringify(props.ingredient));
  const ingredientData = updatedIngredient[Object.keys(updatedIngredient)[0]];
  ingredientData.notes = ingredientData.notes || [];
  ingredientData.notes.push("Neue Notiz");
  emit("update", updatedIngredient);
};

const deleteNote = (index: number) => {
  const updatedIngredient = JSON.parse(JSON.stringify(props.ingredient));
  const ingredientData = updatedIngredient[Object.keys(updatedIngredient)[0]];
  ingredientData.notes.splice(index, 1);
  emit("update", updatedIngredient);
};

const updateNote = (index: number, newValue: string) => {
  const updatedIngredient = JSON.parse(JSON.stringify(props.ingredient));
  const ingredientData = updatedIngredient[Object.keys(updatedIngredient)[0]];
  ingredientData.notes[index] = newValue;
  emit("update", updatedIngredient);
};
</script>
