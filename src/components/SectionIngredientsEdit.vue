<template>
  <div>
    <h3>{{ section }}</h3>
    <div
      v-for="(ingredient, index) in ingredients"
      :key="'ingredient-edit-' + section + '-' + index"
    >
      <ingredient-edit
        v-if="section === ingredient.section"
        :ingredients="ingredients"
        :ingredient="ingredient"
        :index="index"
        :sections="sections"
        @update="ingredients.splice(index, 1, $event)"
        @delete="ingredients.splice(index, 1)"
      ></ingredient-edit>
    </div>
  </div>
</template>

<script setup lang="ts">
import IngredientEdit from "@/components/IngredientEdit.vue";

interface Ingredient {
  section?: string;
  [key: string]: any;
}

defineProps<{
  section: string;
  sections: string[];
}>();

const ingredients = defineModel<Ingredient[]>({ required: true });
</script>
