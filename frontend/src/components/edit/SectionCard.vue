<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from "vue";
import Sortable from "sortablejs";
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
  "update-step-notes": [index: number, notes: string[]];
  "reorder-ingredient": [oldLocalIdx: number, newLocalIdx: number];
  "reorder-step": [oldLocalIdx: number, newLocalIdx: number];
  "cross-move-ingredient": [
    originalIndex: number,
    targetLocalIdx: number,
    targetSection: string,
  ];
  "cross-move-step": [
    originalIndex: number,
    targetLocalIdx: number,
    targetSection: string,
  ];
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

// --- Drag & Drop ---
const ingredientListRef = ref<HTMLElement>();
const stepListRef = ref<HTMLElement>();

let ingredientSortable: Sortable | null = null;
let stepSortable: Sortable | null = null;

function revertDom(evt: Sortable.SortableEvent) {
  const { item, from, oldIndex } = evt;
  from.removeChild(item);
  from.insertBefore(item, from.children[oldIndex!] || null);
}

function initSortables() {
  destroySortables();
  if (ingredientListRef.value) {
    ingredientSortable = Sortable.create(ingredientListRef.value, {
      group: "ingredients",
      handle: ".drag-handle",
      animation: 150,
      ghostClass: "sortable-ghost",
      dragClass: "sortable-drag",
      onUpdate(evt) {
        revertDom(evt);
        emit("reorder-ingredient", evt.oldIndex!, evt.newIndex!);
      },
      onAdd(evt) {
        const origIdx = parseInt(evt.item.dataset.originalIndex!);
        // Revert: move item back to source list (let Vue re-render)
        evt.from.insertBefore(
          evt.item,
          evt.from.children[evt.oldIndex!] || null,
        );
        emit(
          "cross-move-ingredient",
          origIdx,
          evt.newIndex!,
          sectionName.value,
        );
      },
    });
  }
  if (stepListRef.value) {
    stepSortable = Sortable.create(stepListRef.value, {
      group: "steps",
      handle: ".drag-handle",
      animation: 150,
      ghostClass: "sortable-ghost",
      dragClass: "sortable-drag",
      onUpdate(evt) {
        revertDom(evt);
        emit("reorder-step", evt.oldIndex!, evt.newIndex!);
      },
      onAdd(evt) {
        const origIdx = parseInt(evt.item.dataset.originalIndex!);
        evt.from.insertBefore(
          evt.item,
          evt.from.children[evt.oldIndex!] || null,
        );
        emit("cross-move-step", origIdx, evt.newIndex!, sectionName.value);
      },
    });
  }
}

function destroySortables() {
  ingredientSortable?.destroy();
  ingredientSortable = null;
  stepSortable?.destroy();
  stepSortable = null;
}

onMounted(() => {
  nextTick(() => initSortables());
});

onBeforeUnmount(() => {
  destroySortables();
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

        <div ref="ingredientListRef" class="ingredient-list">
          <IngredientRow
            v-for="item in filteredIngredients"
            :key="'ing-' + item.originalIndex"
            :data-original-index="item.originalIndex"
            :ingredient="item.ingredient"
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

        <div ref="stepListRef" class="step-list">
          <StepRow
            v-for="(item, localIdx) in filteredSteps"
            :key="'step-' + item.originalIndex"
            :data-original-index="item.originalIndex"
            :step="item.step"
            :index="item.originalIndex"
            :number="localIdx + 1"
            @delete="emit('delete-step', item.originalIndex)"
            @update:step="emit('update-step-text', item.originalIndex, $event)"
            @update:notes="
              emit('update-step-notes', item.originalIndex, $event)
            "
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

@media (max-width: 768px) {
  .drag-handle,
  .section-drag-handle {
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3em;
  }
}

.ingredient-list,
.step-list {
  min-height: 20px;
}
</style>

<!-- Sortable ghost/drag classes must be unscoped -->
<style>
.sortable-ghost {
  opacity: 0.4;
  background-color: #e3f2fd;
  border-radius: 4px;
}

.sortable-drag {
  opacity: 0.9;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-radius: 4px;
}
</style>
