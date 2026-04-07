<script setup lang="ts">
import { computed } from "vue";
import InlineEditField from "@/components/edit/InlineEditField.vue";
import IngredientRow from "@/components/edit/IngredientRow.vue";
import StepRow from "@/components/edit/StepRow.vue";
import type { Ingredient, Step, Section } from "@/types/recipe";

const props = defineProps<{
  section: Section;
  ingredients: Ingredient[];
  steps: Step[];
  sectionIndex: number;
  totalSections: number;
  showHeader: boolean;
  ingredientUnits: string[];
}>();

const emit = defineEmits<{
  "update:sectionName": [name: string];
  "delete-section": [];
  "move-section": [direction: "up" | "down"];
  "add-ingredient": [section: string];
  "add-step": [section: string];
  "delete-ingredient": [index: number];
  "update-ingredient": [index: number, ingredient: Ingredient];
  "delete-step": [index: number];
  "update-step-text": [index: number, text: string];
}>();

const sectionName = computed(() => props.section.section);

// Filtered items for this section (with original indices for mutation)
const filteredIngredients = computed(() => {
  return props.ingredients
    .map((ing, idx) => ({ ingredient: ing, originalIndex: idx }))
    .filter((item) => item.ingredient.section === sectionName.value);
});

const filteredSteps = computed(() => {
  return props.steps
    .map((step, idx) => ({ step, originalIndex: idx }))
    .filter((item) => item.step.section === sectionName.value);
});
</script>

<template>
  <div class="section-card card mb-3">
    <!-- Section Header -->
    <div v-if="showHeader" class="card-header section-header">
      <span
        class="section-drag-handle drag-handle"
        title="Abschnitt verschieben"
      >
        <i class="bi bi-grip-vertical"></i>
      </span>

      <InlineEditField
        :model-value="section.section"
        placeholder="Abschnittsname"
        @update:model-value="emit('update:sectionName', $event)"
      />

      <div class="section-actions ms-auto">
        <BButton
          size="sm"
          variant="outline-secondary"
          title="Nach oben"
          :disabled="sectionIndex === 0"
          @click="emit('move-section', 'up')"
        >
          <i class="bi bi-chevron-up"></i>
        </BButton>
        <BButton
          size="sm"
          variant="outline-secondary"
          title="Nach unten"
          :disabled="sectionIndex >= totalSections - 1"
          @click="emit('move-section', 'down')"
        >
          <i class="bi bi-chevron-down"></i>
        </BButton>
        <BButton
          size="sm"
          variant="outline-danger"
          title="Abschnitt löschen"
          @click="emit('delete-section')"
        >
          <i class="bi bi-trash"></i>
        </BButton>
      </div>
    </div>

    <!-- Card Body: 2-Column Layout -->
    <div class="card-body section-body">
      <!-- Ingredients Column -->
      <div class="section-col section-ingredients">
        <h6 class="section-col-title"><i class="bi bi-basket"></i> Zutaten</h6>

        <div class="ingredient-list">
          <IngredientRow
            v-for="item in filteredIngredients"
            :key="'ing-' + item.originalIndex"
            :ingredient="item.ingredient"
            :ingredients="ingredients"
            :index="item.originalIndex"
            :ingredient-units="ingredientUnits"
            @delete="emit('delete-ingredient', item.originalIndex)"
            @update="emit('update-ingredient', item.originalIndex, $event)"
          />
        </div>

        <BButton
          size="sm"
          variant="outline-primary"
          class="mt-2"
          @click="emit('add-ingredient', sectionName)"
        >
          <i class="bi bi-plus"></i> Zutat
        </BButton>
      </div>

      <!-- Steps Column -->
      <div class="section-col section-steps">
        <h6 class="section-col-title">
          <i class="bi bi-list-ol"></i> Schritte
        </h6>

        <div class="step-list">
          <StepRow
            v-for="(item, localIdx) in filteredSteps"
            :key="'step-' + item.originalIndex"
            :step="item.step"
            :steps="steps"
            :index="item.originalIndex"
            :number="localIdx + 1"
            @delete="emit('delete-step', item.originalIndex)"
            @update:step="emit('update-step-text', item.originalIndex, $event)"
          />
        </div>

        <BButton
          size="sm"
          variant="outline-primary"
          class="mt-2"
          @click="emit('add-step', sectionName)"
        >
          <i class="bi bi-plus"></i> Schritt
        </BButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-card {
  border: 1px solid rgba(0, 0, 0, 0.125);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: rgba(0, 0, 0, 0.03);
}

.section-actions {
  display: flex;
  gap: 2px;
}

.section-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 768px) {
  .section-body {
    grid-template-columns: 1fr;
  }
}

.section-col {
  min-width: 0;
}

.section-col-title {
  font-size: 0.85em;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #666;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.drag-handle {
  cursor: grab;
  padding: 4px;
  color: #999;
  font-size: 1.1em;
}

.drag-handle:active {
  cursor: grabbing;
}
</style>
