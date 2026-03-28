<script setup lang="ts">
import { computed } from "vue";
import type { Ingredient } from "@/types/recipe";

const props = defineProps<{
  ingredient: Ingredient;
  index: number;
}>();

const emit = defineEmits<{
  update: [value: Ingredient];
}>();

const ingredient_data = computed(() => props.ingredient);

const addNote = () => {
  const updatedIngredient = JSON.parse(JSON.stringify(props.ingredient));
  updatedIngredient.notes = updatedIngredient.notes || [];
  updatedIngredient.notes.push("Neue Notiz");
  emit("update", updatedIngredient);
};

const deleteNote = (index: number) => {
  const updatedIngredient = JSON.parse(JSON.stringify(props.ingredient));
  updatedIngredient.notes.splice(index, 1);
  emit("update", updatedIngredient);
};

const updateNote = (index: number, newValue: string) => {
  const updatedIngredient = JSON.parse(JSON.stringify(props.ingredient));
  updatedIngredient.notes[index] = newValue;
  emit("update", updatedIngredient);
};
</script>

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
