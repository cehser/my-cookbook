<script setup lang="ts">
import { computed } from "vue";
import type { Ingredient, Section } from "@/types/recipe";

const props = defineProps<{
  sections: Section[];
  activeSection: string | null;
  ingredients: Ingredient[];
  yieldsValue: number;
}>();

// Only show sections that have ingredients, plus orphaned ingredients
const effectiveSections = computed(() => {
  const knownNames = new Set(props.sections.map((s) => s.section));
  const result: Section[] = [];

  // Orphaned ingredients (section name not in sections list)
  const orphaned = props.ingredients.filter(
    (i) => !knownNames.has(i.section ?? ""),
  );
  if (orphaned.length > 0) {
    const orphanNames = new Set(orphaned.map((i) => i.section ?? ""));
    for (const name of orphanNames) {
      result.push({ section: name });
    }
  }

  // Declared sections that actually have ingredients
  for (const section of props.sections) {
    const hasIngredients = props.ingredients.some(
      (i) => (i.section ?? "") === section.section,
    );
    if (hasIngredients) {
      result.push(section);
    }
  }

  return result;
});

function getSectionIngredients(sectionName: string) {
  return props.ingredients.filter((x) => (x.section ?? "") === sectionName);
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
  const rounded = parseFloat(amount.toPrecision(2));
  return rounded.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
</script>

<template>
  <div class="ingredients-sections">
    <div
      v-for="(section, index) in effectiveSections"
      :key="'ing-section-' + index"
      class="ingredients-section"
      :class="{ active: section.section === activeSection }"
      :data-section="section.section"
    >
      <h5 v-if="section.section">{{ section.section }}</h5>

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
