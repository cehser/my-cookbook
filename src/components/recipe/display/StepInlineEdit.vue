<template>
  <div
    class="step-inline-edit"
    :class="{ editing: isEditing, dirty: isDirty }"
    @click="startEditing"
  >
    <div v-if="!isEditing" class="step-display">
      <span class="step-number">{{ stepNumber }}.</span>
      <span class="step-text">{{ step.step }}</span>
      <span v-if="step.notes && step.notes.length" class="step-notes-indicator">
        <i class="bi bi-sticky"></i>
      </span>
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

    <div v-else class="step-edit-form" @click.stop>
      <div class="edit-header">
        <span class="step-number">{{ stepNumber }}.</span>
        <span class="edit-hint"
          >ESC zum Abbrechen • Click außerhalb zum Speichern</span
        >
      </div>
      <BFormTextarea
        ref="textInput"
        v-model="editText"
        rows="3"
        max-rows="10"
        class="step-textarea"
        placeholder="Zubereitungsschritt beschreiben..."
        @update:model-value="markDirty"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from "vue";
import type { ComponentPublicInstance } from "vue";
import type { Step } from "@/types/recipe";
import { BFormTextarea, BButton } from "bootstrap-vue-next";

const props = defineProps<{
  step: Step;
  stepNumber: number;
  isDirty?: boolean;
  isEditingOther?: boolean;
}>();

const emit = defineEmits<{
  changed: [stepIndex: number];
  unchanged: [stepIndex: number];
  startEdit: [stepIndex: number];
  endEdit: [];
}>();

// Editing state
const isEditing = ref(false);
const hasChanges = ref(false);
const isClickHandlerActive = ref(false);

// Edit values
const editText = ref("");
const originalText = ref("");

// Refs for focus management
const textInput = ref<ComponentPublicInstance | null>(null);

// Methods
function startEditing() {
  if (isEditing.value || props.isEditingOther) return;

  emit("startEdit", props.stepNumber - 1);

  editText.value = props.step.step;
  originalText.value = props.step.step;

  isEditing.value = true;
  hasChanges.value = false;
  isClickHandlerActive.value = false;

  nextTick(() => {
    // Access native textarea element from BFormTextarea component
    const textareaEl = textInput.value?.$el as HTMLTextAreaElement;
    if (textareaEl) {
      textareaEl.focus();
      const len = editText.value.length;
      textareaEl.setSelectionRange(len, len);
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
  } else if (event.key === "Enter" && event.ctrlKey) {
    event.preventDefault();
    finishEdit();
  }
};

const handleClickOutside = (event: MouseEvent) => {
  if (!isClickHandlerActive.value) return;

  const target = event.target as HTMLElement;
  const editForm = target.closest(".step-edit-form");
  if (!editForm) {
    finishEdit();
  }
};

function markDirty() {
  const changed = editText.value !== originalText.value;

  if (changed && !hasChanges.value) {
    hasChanges.value = true;
    emit("changed", props.stepNumber - 1);
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
    emit("unchanged", props.stepNumber - 1);
  }

  editText.value = originalText.value;
  isClickHandlerActive.value = false;
  document.removeEventListener("click", handleClickOutside);
  document.removeEventListener("keydown", handleKeyDown);
  isEditing.value = false;
  hasChanges.value = false;
  emit("endEdit");
}

function undoChanges() {
  // Revert to original value
  props.step.step = originalText.value;

  // Notify parent to remove from dirty items
  emit("unchanged", props.stepNumber - 1);
}

function applyChanges() {
  const newText = editText.value.trim();

  if (!newText) {
    cancelEdit();
    return;
  }

  props.step.step = newText;
}

watch(
  () => props.isDirty,
  (newVal) => {
    if (!newVal) {
      hasChanges.value = false;
    }
  },
);

watch(
  () => props.isEditingOther,
  (isOtherEditing) => {
    if (isOtherEditing && isEditing.value) {
      finishEdit();
    }
  },
);
</script>

<style scoped>
.step-inline-edit {
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
  min-height: 44px;
  border: 2px solid transparent;
  margin-bottom: 0.75rem;
}

.step-inline-edit:hover:not(.editing) {
  background-color: rgba(var(--bs-primary-rgb), 0.1);
}

.step-inline-edit.editing {
  background-color: rgba(var(--bs-primary-rgb), 0.05);
  cursor: default;
}

.step-inline-edit.dirty {
  border-left: 3px solid #ffc107;
  background-color: rgba(255, 193, 7, 0.05);
}

.step-display {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.step-number {
  font-weight: 600;
  color: var(--bs-primary);
  flex-shrink: 0;
  min-width: 1.5rem;
}

.step-inline-edit.editing .step-number,
.edit-header .step-number {
  color: var(--bs-body-color);
}

.step-text {
  flex: 1;
  line-height: 1.5;
}

.step-notes-indicator {
  flex-shrink: 0;
  color: var(--bs-warning);
  font-size: 0.875rem;
}

.undo-button {
  margin-left: auto;
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

.step-edit-form {
  width: 100%;
}

.edit-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.edit-hint {
  font-size: 0.75rem;
  color: var(--bs-secondary);
  font-style: italic;
}

.step-textarea {
  width: 100%;
  font-size: 0.95rem;
  line-height: 1.5;
}

@media (max-width: 767px) {
  .step-inline-edit {
    min-height: 48px;
    padding: 1rem;
  }

  .edit-hint {
    font-size: 0.7rem;
  }
}
</style>
