<template>
  <div
    class="ingredient-inline-edit"
    :class="{ editing: isEditing, dirty: isDirty }"
    @click="startEditing"
  >
    <div v-if="!isEditing" class="ingredient-display">
      <div class="ingredient-amount">{{ displayAmount }} {{ displayUnit }}</div>
      <div class="ingredient-name">
        {{ displayName }}
      </div>
      <BButton
        v-if="isDirty"
        size="sm"
        variant="link"
        class="undo-button"
        @click.stop="undoChanges"
        title="Änderungen rückgängig machen"
      >
        <i class="bi bi-arrow-counterclockwise"></i>
      </BButton>
    </div>

    <div v-else class="ingredient-edit-form" @click.stop>
      <div class="edit-fields">
        <BFormInput
          ref="amountInput"
          v-model="editAmount"
          type="text"
          size="sm"
          class="amount-input"
          placeholder="Menge"
          @update:model-value="markDirty"
        />
        <BFormInput
          v-model="editUnit"
          type="text"
          size="sm"
          class="unit-input"
          placeholder="Einheit"
          @update:model-value="markDirty"
        />
        <BFormInput
          ref="nameInput"
          v-model="editName"
          type="text"
          size="sm"
          class="name-input flex-grow-1"
          placeholder="Zutat"
          @update:model-value="markDirty"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from "vue";
import type { ComponentPublicInstance } from "vue";
import type { Ingredient } from "@/types/recipe";
import { BFormInput, BButton } from "bootstrap-vue-next";

const props = defineProps<{
  ingredient: Ingredient;
  yieldsValue: number;
  isDirty?: boolean;
  isEditingOther?: boolean;
}>();

const emit = defineEmits<{
  changed: [ingredientKey: string];
  unchanged: [ingredientKey: string];
  startEdit: [ingredientKey: string];
  endEdit: [];
}>();

// Editing state
const isEditing = ref(false);
const hasChanges = ref(false);
const isClickHandlerActive = ref(false);

// Edit values
const editAmount = ref("");
const editUnit = ref("");
const editName = ref("");

// Original values for undo (stored once when first marked as dirty)
const undoAmount = ref("");
const undoUnit = ref("");
const undoName = ref("");

// Last saved values for change detection
const originalAmount = ref("");
const originalUnit = ref("");
const originalName = ref("");

// Refs for focus management
const amountInput = ref<ComponentPublicInstance | null>(null);
const nameInput = ref<ComponentPublicInstance | null>(null);

// Display values
const displayName = computed(() => {
  // Filter out 'section' property to get the actual ingredient name
  const keys = Object.keys(props.ingredient).filter((key) => key !== "section");
  return keys[0];
});

// Helper to create unique ingredient key with section
function getIngredientKey(name: string): string {
  return `ingredient:${props.ingredient.section}:${name}`;
}

const displayAmount = computed(() => {
  const name = displayName.value;
  const ingredientData = props.ingredient[name];

  if (typeof ingredientData === "string") {
    return ingredientData;
  }

  const amount = ingredientData.amounts[0].amount;

  if (typeof amount !== "number") {
    return amount;
  }

  return Number(amount).toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
});

const displayUnit = computed(() => {
  const name = displayName.value;
  const ingredientData = props.ingredient[name];

  if (typeof ingredientData === "string") {
    return "";
  }

  return ingredientData.amounts[0].unit;
});

// Methods
function startEditing() {
  if (isEditing.value || props.isEditingOther) return;

  const name = displayName.value;
  emit("startEdit", getIngredientKey(name));

  const ingredientData = props.ingredient[name];

  if (typeof ingredientData === "string") {
    editAmount.value = "";
    editUnit.value = "";
    editName.value = name;
  } else {
    editAmount.value = String(ingredientData.amounts[0].amount);
    editUnit.value = ingredientData.amounts[0].unit;
    editName.value = name;
  }

  // Store originals for change detection
  originalAmount.value = editAmount.value;
  originalUnit.value = editUnit.value;
  originalName.value = editName.value;

  isEditing.value = true;
  hasChanges.value = false;
  isClickHandlerActive.value = false;

  nextTick(() => {
    // Access native input element from BFormInput component
    const inputEl = amountInput.value?.$el as HTMLInputElement;
    if (inputEl) {
      inputEl.focus();
      inputEl.select();
    }
    // Delay handlers to next animation frame to prevent immediate trigger
    requestAnimationFrame(() => {
      isClickHandlerActive.value = true;
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    });
  });
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    event.preventDefault();
    cancelEdit();
  } else if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey) {
    event.preventDefault();
    finishEdit();
  }
};

const handleClickOutside = (event: MouseEvent) => {
  if (!isClickHandlerActive.value) return;

  const target = event.target as HTMLElement;
  const editForm = target.closest(".ingredient-edit-form");
  if (!editForm) {
    finishEdit();
  }
};

function markDirty() {
  const changed =
    editAmount.value !== originalAmount.value ||
    editUnit.value !== originalUnit.value ||
    editName.value !== originalName.value;

  if (changed && !hasChanges.value) {
    hasChanges.value = true;
    // Store original values for undo (only once when first dirty)
    undoAmount.value = originalAmount.value;
    undoUnit.value = originalUnit.value;
    undoName.value = originalName.value;
    // Use original name for tracking (actual ingredient key doesn't change until save)
    emit("changed", getIngredientKey(originalName.value));
  }
}

function finishEdit() {
  if (hasChanges.value) {
    applyChanges();
  }
  isClickHandlerActive.value = false;
  document.removeEventListener("click", handleClickOutside);
  document.removeEventListener("keydown", handleKeyDown);
  isEditing.value = false;
  emit("endEdit");
}

function cancelEdit() {
  // If was marked as changed but actually didn't change, emit unchanged
  if (hasChanges.value) {
    // Use original name for unchanged event
    emit("unchanged", getIngredientKey(originalName.value));
  }

  editAmount.value = originalAmount.value;
  editUnit.value = originalUnit.value;
  editName.value = originalName.value;
  isClickHandlerActive.value = false;
  document.removeEventListener("click", handleClickOutside);
  document.removeEventListener("keydown", handleKeyDown);
  isEditing.value = false;
  hasChanges.value = false;
  emit("endEdit");
}

function undoChanges() {
  // Revert to UNDO values (original values from when first marked dirty)
  const currentName = displayName.value;
  const ingredientData = props.ingredient[currentName];

  if (typeof ingredientData === "string") {
    // Cannot undo for string-type ingredients
    return;
  }

  // Restore undo values
  ingredientData.amounts[0].amount = undoAmount.value.trim() || "0";
  ingredientData.amounts[0].unit = undoUnit.value.trim();

  // If name was changed, revert it back to undo name
  if (currentName !== undoName.value && undoName.value) {
    const data = props.ingredient[currentName];
    delete props.ingredient[currentName];
    props.ingredient[undoName.value] = data;
  }

  // Notify parent to remove from dirty items using UNDO name with section
  emit("unchanged", getIngredientKey(undoName.value));
}

function applyChanges() {
  const oldName = displayName.value;
  const newName = editName.value.trim();

  if (!newName) {
    cancelEdit();
    return;
  }

  const nameChanged = oldName !== newName;

  if (nameChanged) {
    const oldData = props.ingredient[oldName];
    delete props.ingredient[oldName];
    props.ingredient[newName] = oldData;

    // If name changed, we need to update the dirty tracking
    // Remove old key and add new key
    emit("unchanged", getIngredientKey(oldName));
    emit("changed", getIngredientKey(newName));
  }

  const ingredientData = props.ingredient[newName];
  if (typeof ingredientData !== "string") {
    ingredientData.amounts[0].amount = editAmount.value.trim() || "0";
    ingredientData.amounts[0].unit = editUnit.value.trim();
  }

  // After changes applied, update all originals to current values
  // This keeps the item dirty until manually saved
  originalAmount.value = editAmount.value;
  originalUnit.value = editUnit.value;
  originalName.value = newName;
}

watch(
  () => props.isDirty,
  (newVal) => {
    if (!newVal) {
      hasChanges.value = false;
    }
  },
);

// Watch for isEditingOther to close this editor if another one opens
watch(
  () => props.isEditingOther,
  (isOtherEditing) => {
    if (isOtherEditing && isEditing.value) {
      // Another ingredient is being edited, close this one
      finishEdit();
    }
  },
);
</script>

<style scoped>
.ingredient-inline-edit {
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
  min-height: 44px;
  display: flex;
  align-items: center;
  border: 2px solid transparent;
}

.ingredient-inline-edit:hover:not(.editing) {
  background-color: rgba(var(--bs-primary-rgb), 0.1);
}

.ingredient-inline-edit.editing {
  background-color: rgba(var(--bs-primary-rgb), 0.05);
  cursor: default;
}

.ingredient-inline-edit.dirty {
  border-left: 3px solid #ffc107;
  background-color: rgba(255, 193, 7, 0.05);
}

.ingredient-display {
  display: grid;
  grid-template-columns: 35% 1fr auto;
  gap: 0.5rem;
  width: 100%;
  align-items: center;
}

.ingredient-amount {
  font-weight: 500;
  color: var(--bs-body-color);
}

.ingredient-name {
  color: var(--bs-body-color);
}

.undo-button {
  padding: 0.25rem 0.5rem;
  color: var(--bs-warning);
  font-size: 1rem;
  line-height: 1;
  opacity: 0.8;
  transition: opacity 0.2s ease;
}

.undo-button:hover {
  opacity: 1;
  color: var(--bs-warning);
}

.ingredient-edit-form {
  width: 100%;
}

.edit-fields {
  display: flex;
  gap: 0.5rem;
}

.amount-input {
  width: 80px;
  flex-shrink: 0;
}

.unit-input {
  width: 80px;
  flex-shrink: 0;
}

.name-input {
  min-width: 150px;
}

@media (max-width: 767px) {
  .ingredient-inline-edit {
    min-height: 48px;
    padding: 0.75rem;
  }

  .edit-fields {
    flex-wrap: wrap;
  }

  .amount-input,
  .unit-input {
    width: 100px;
  }

  .name-input {
    width: 100%;
    min-width: unset;
  }
}
</style>
