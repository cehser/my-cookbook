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
  gap: var(--space-5);
}

.ingredients-section {
  padding: var(--space-4);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border-left: 3px solid transparent;
  transition: all var(--transition-fast);
}

.ingredients-section.active {
  border-left-color: var(--color-primary);
  background: var(--color-primary-subtle);
}

.ingredients-section h5 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-4);
  color: var(--color-primary);
}

.ingredient-row {
  padding: var(--space-1) 0;
  border-bottom: 1px solid var(--color-divider);
}

.ingredient-row:last-child {
  border-bottom: none;
}

.ingredient-amount {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
}

.ingredient-name {
  color: var(--color-text);
}
</style>
