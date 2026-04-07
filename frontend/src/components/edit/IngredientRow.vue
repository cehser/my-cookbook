<script setup lang="ts">
import { ref, computed } from "vue";
import InlineEditField from "@/components/edit/InlineEditField.vue";
import ArrayReorderBtnGroup from "@/components/common/ArrayReorderBtnGroup.vue";
import IngredientNotesFormRow from "@/components/edit/IngredientNotesFormRow.vue";
import type { Ingredient } from "@/types/recipe";

const props = defineProps<{
  ingredient: Ingredient;
  ingredients: Ingredient[];
  index: number;
  ingredientUnits: string[];
}>();

const emit = defineEmits<{
  delete: [];
  update: [value: Ingredient];
}>();

const showNotes = ref(false);

const hasNotes = computed(
  () => props.ingredient.notes && props.ingredient.notes.length > 0,
);

function updateName(newName: string) {
  const updated = JSON.parse(JSON.stringify(props.ingredient)) as Ingredient;
  updated.name = newName;
  emit("update", updated);
}

function updateAmount(newAmount: number) {
  const updated = JSON.parse(JSON.stringify(props.ingredient)) as Ingredient;
  updated.amounts[0].amount = Number(newAmount);
  emit("update", updated);
}

function updateUnit(newUnit: string) {
  const updated = JSON.parse(JSON.stringify(props.ingredient)) as Ingredient;
  updated.amounts[0].unit = newUnit;
  emit("update", updated);
}

function updateIngredient(ingredient: Ingredient) {
  emit("update", ingredient);
}
</script>

<template>
  <div class="ingredient-row">
    <div class="ingredient-row-main">
      <span class="drag-handle" title="Ziehen zum Verschieben">
        <i class="bi bi-grip-vertical"></i>
      </span>

      <div class="ingredient-name">
        <InlineEditField
          :model-value="ingredient.name"
          placeholder="Zutatname"
          @update:model-value="updateName"
        />
      </div>

      <div class="ingredient-amount">
        <input
          type="number"
          class="form-control form-control-sm"
          placeholder="Menge"
          min="0.001"
          step="0.001"
          :value="ingredient.amounts[0]?.amount"
          @input="
            updateAmount(Number(($event.target as HTMLInputElement).value))
          "
        />
      </div>

      <div class="ingredient-unit">
        <input
          class="form-control form-control-sm"
          placeholder="Einheit"
          list="ingredient-units-list"
          :value="ingredient.amounts[0]?.unit"
          @change="updateUnit(($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="ingredient-actions">
        <BButton
          size="sm"
          variant="outline-secondary"
          :class="{ active: hasNotes }"
          title="Notizen"
          @click="showNotes = !showNotes"
        >
          <i class="bi bi-chat-square-text"></i>
        </BButton>
        <BButton
          size="sm"
          variant="outline-danger"
          title="Zutat löschen"
          @click="emit('delete')"
        >
          <i class="bi bi-trash"></i>
        </BButton>
        <ArrayReorderBtnGroup :array="ingredients" :index="index" />
      </div>
    </div>

    <div v-if="showNotes" class="ingredient-notes">
      <IngredientNotesFormRow
        :ingredient="ingredient"
        :index="index"
        @update="updateIngredient($event)"
      />
    </div>
  </div>
</template>

<style scoped>
.ingredient-row {
  margin-bottom: 4px;
}

.ingredient-row-main {
  display: flex;
  align-items: center;
  gap: 6px;
}

.drag-handle {
  cursor: grab;
  padding: 4px;
  color: #999;
  font-size: 1.1em;
  min-width: 20px;
  display: flex;
  align-items: center;
}

.drag-handle:active {
  cursor: grabbing;
}

.ingredient-name {
  flex: 2;
  min-width: 0;
}

.ingredient-amount {
  width: 80px;
  flex-shrink: 0;
}

.ingredient-unit {
  width: 100px;
  flex-shrink: 0;
}

.ingredient-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.ingredient-notes {
  margin-left: 26px;
  margin-top: 4px;
  margin-bottom: 8px;
}

@media (max-width: 768px) {
  .drag-handle {
    min-width: 44px;
    min-height: 44px;
    justify-content: center;
    font-size: 1.3em;
  }

  .ingredient-row-main {
    flex-wrap: wrap;
  }

  .ingredient-name {
    flex-basis: calc(100% - 50px);
  }

  .ingredient-amount,
  .ingredient-unit {
    width: auto;
    flex: 1;
  }
}
</style>
