<script setup lang="ts">
import { computed } from "vue";
import type { Ingredient, Section } from "@/types/recipe";
import { currentSectionOnly, effectiveSections } from "@/js/recipeSections";

const props = withDefaults(
  defineProps<{
    /** Vollständige Abschnittsliste des Rezepts (nie vorgefiltert, R-01) */
    sections: Section[];
    activeSection: string | null;
    ingredients: Ingredient[];
    /** Nur den aktiven Abschnitt zeigen („Nur aktuell“) */
    onlyCurrent?: boolean;
    /** Faktor der Portionen-Umrechnung */
    factor?: number;
  }>(),
  { onlyCurrent: false, factor: 1 },
);

const shownSections = computed(() => {
  const all = effectiveSections(props.sections, props.ingredients);
  return props.onlyCurrent ? currentSectionOnly(all, props.activeSection) : all;
});

function getSectionIngredients(sectionName: string) {
  return props.ingredients.filter((x) => (x.section ?? "") === sectionName);
}

function getUnit(ingredient: Ingredient) {
  return ingredient.amounts?.[0]?.unit || "";
}

function formatAmount(ingredient: Ingredient) {
  const amount = ingredient.amounts?.[0]?.amount;
  if (typeof amount !== "number") return amount;
  // Rundung auf 2 signifikante Stellen (Sprint 9)
  const rounded = parseFloat((amount * props.factor).toPrecision(2));
  return rounded.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
</script>

<template>
  <div class="ingredients-sections">
    <p v-if="!shownSections.length" class="ingredients-empty">
      <template v-if="activeSection">
        Keine Zutaten für „{{ activeSection }}“.
      </template>
      <template v-else>Keine Zutaten.</template>
    </p>
    <div
      v-for="section in shownSections"
      :key="'ing-section-' + section.section"
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
          {{ ingredient.name }}
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

.ingredients-empty {
  margin: 0;
  color: var(--color-text-muted);
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
