<script setup lang="ts">
import { computed } from "vue";
import InlineEditField from "@/components/edit/InlineEditField.vue";
import type { Ingredient } from "@/types/recipe";

const props = defineProps<{
  ingredient: Ingredient;
  index: number;
  ingredientUnits: string[];
}>();

const emit = defineEmits<{
  delete: [];
  update: [value: Ingredient];
}>();

const notesText = computed(() => (props.ingredient.notes ?? []).join("\n"));
const hasNotes = computed(() => notesText.value.length > 0);

function clone(): Ingredient {
  return JSON.parse(JSON.stringify(props.ingredient));
}

function updateName(newName: string) {
  const u = clone();
  u.name = newName;
  emit("update", u);
}

function updateAmount(newAmount: number) {
  const u = clone();
  u.amounts[0].amount = Number(newAmount);
  emit("update", u);
}

function updateUnit(newUnit: string) {
  const u = clone();
  u.amounts[0].unit = newUnit;
  emit("update", u);
}

function addNote() {
  const u = clone();
  u.notes = u.notes ?? [];
  u.notes.push("");
  emit("update", u);
}

function updateNotes(text: string) {
  const u = clone();
  u.notes = text ? text.split("\n") : [];
  emit("update", u);
}

function removeNotes() {
  const u = clone();
  u.notes = [];
  emit("update", u);
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
          v-if="!hasNotes"
          size="sm"
          variant="outline-secondary"
          title="Notiz hinzufügen"
          @click="addNote"
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
      </div>
    </div>

    <!-- Inline-Notiz: nur wenn gefüllt -->
    <div v-if="hasNotes" class="ingredient-notes">
      <textarea
        class="form-control form-control-sm"
        rows="1"
        placeholder="Notiz..."
        :value="notesText"
        @input="updateNotes(($event.target as HTMLTextAreaElement).value)"
      ></textarea>
      <button
        class="btn-note-remove"
        title="Notiz entfernen"
        @click="removeNotes"
      >
        <i class="bi bi-x"></i>
      </button>
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
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin-left: 26px;
  margin-top: 2px;
  margin-bottom: 4px;
}

.ingredient-notes textarea {
  resize: none;
  font-size: 0.82em;
  color: #666;
  flex: 1;
}

.btn-note-remove {
  background: none;
  border: none;
  color: #999;
  padding: 2px 4px;
  cursor: pointer;
  font-size: 0.9em;
  line-height: 1;
}

.btn-note-remove:hover {
  color: #dc3545;
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
    order: 1;
  }

  .drag-handle {
    order: 0;
  }

  .ingredient-amount {
    width: auto;
    flex: 1;
    order: 2;
  }

  .ingredient-unit {
    width: auto;
    flex: 1;
    order: 3;
  }

  .ingredient-actions {
    order: 4;
  }

  .ingredient-notes {
    margin-left: 44px;
  }
}
</style>
