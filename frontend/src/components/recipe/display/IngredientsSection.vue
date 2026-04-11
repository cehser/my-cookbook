<script setup lang="ts">
import type { Ingredient, Section } from "@/types/recipe";

const props = defineProps<{
  sections: Section[];
  activeSection: string | null;
  ingredients: Ingredient[];
  yieldsValue: number;
}>();

function getSectionIngredients(sectionName: string) {
  return props.ingredients.filter((x) => x.section === sectionName);
}

function getIngredientName(ingredient: Ingredient) {
  return ingredient.name;
}

function getUnit(ingredient: Ingredient) {
  return ingredient.amounts?.[0]?.unit || "";
}

function formatAmount(ingredient: Ingredient) {
  const amount = ingredient.amounts?.[0]?.amount;
  if (typeof amount !== "number") return amount;
  return Number(amount).toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
</script>

<template>
  <div class="ingredients-sections">
    <div
      v-for="(section, index) in sections"
      :key="'ing-section-' + index"
      class="ingredients-section"
      :class="{ active: section.section === activeSection }"
      :data-section="section.section"
    >
      <h5>{{ section.section }}</h5>

      <div
        class="row mb-2 ingredient-row"
        v-for="(ingredient, idx) in getSectionIngredients(section.section)"
        :key="'ing-' + idx"
      >
        <div class="col-4 ingredient-amount">
          {{ formatAmount(ingredient) }}
          {{ getUnit(ingredient) }}
        </div>
        <div class="col-8 ingredient-name">
          {{ getIngredientName(ingredient) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ingredients-sections {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.ingredients-section {
  padding: 1rem;
  background: var(--bs-body-bg);
  border-radius: 8px;
  border-left: 3px solid transparent;
  transition: all 0.2s ease;
}

.ingredients-section.active {
  border-left-color: var(--bs-primary);
  background: rgba(var(--bs-primary-rgb), 0.05);
}

.ingredients-section h5 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--bs-primary);
}

.ingredient-row {
  padding: 0.35rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.ingredient-row:last-child {
  border-bottom: none;
}

.ingredient-amount {
  font-weight: 600;
  color: var(--bs-secondary);
}

.ingredient-name {
  color: var(--bs-body-color);
}
</style>
