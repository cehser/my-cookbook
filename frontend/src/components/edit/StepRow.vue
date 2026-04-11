<script setup lang="ts">
import { computed } from "vue";
import { useTextareaAutosize } from "@vueuse/core";
import type { Step } from "@/types/recipe";

const props = defineProps<{
  step: Step;
  index: number;
  number: number;
}>();

const emit = defineEmits<{
  delete: [];
  "update:step": [value: string];
  "update:notes": [value: string[]];
}>();

const { textarea } = useTextareaAutosize({
  input: computed(() => props.step.step),
  onResize() {
    // auto-handled
  },
});

const notesText = computed(() => (props.step.notes ?? []).join("\n"));
const hasNotes = computed(() => notesText.value.length > 0);

function onInput(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value;
  emit("update:step", value);
}

function addNote() {
  emit("update:notes", [...(props.step.notes ?? []), ""]);
}

function updateNotes(text: string) {
  emit("update:notes", text ? text.split("\n") : []);
}

function removeNotes() {
  emit("update:notes", []);
}
</script>

<template>
  <div class="step-row-wrapper">
    <div class="step-row">
      <span class="drag-handle" title="Ziehen zum Verschieben">
        <i class="bi bi-grip-vertical"></i>
      </span>

      <span class="step-number">{{ number }}.</span>

      <div class="step-text">
        <textarea
          ref="textarea"
          class="form-control form-control-sm"
          placeholder="Schritt beschreiben..."
          :value="step.step"
          @input="onInput"
          rows="1"
        ></textarea>
      </div>

      <div class="step-actions">
        <BButton
          v-if="!hasNotes"
          size="sm"
          variant="outline-secondary"
          title="Notiz hinzufügen"
          aria-label="Notiz hinzufügen"
          @click="addNote"
        >
          <i class="bi bi-chat-square-text"></i>
        </BButton>
        <BButton
          size="sm"
          variant="outline-danger"
          title="Schritt löschen"
          aria-label="Schritt löschen"
          @click="emit('delete')"
        >
          <i class="bi bi-trash"></i>
        </BButton>
      </div>
    </div>

    <!-- Inline-Notiz -->
    <div v-if="hasNotes" class="step-notes">
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
        aria-label="Notiz entfernen"
        @click="removeNotes"
      >
        <i class="bi bi-x"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.step-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 2px;
}

.drag-handle {
  cursor: grab;
  padding: 4px;
  color: var(--color-text-muted);
  font-size: 1.1em;
  min-width: 20px;
  display: flex;
  align-items: center;
  margin-top: 4px;
}

.drag-handle:active {
  cursor: grabbing;
}

.step-number {
  font-weight: 600;
  min-width: 24px;
  text-align: right;
  margin-top: 6px;
  color: var(--color-text-muted);
}

.step-text {
  flex: 1;
  min-width: 0;
}

.step-text textarea {
  resize: none;
  overflow: hidden;
}

.step-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-top: 2px;
}

.step-notes {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin-left: 52px;
  margin-bottom: 4px;
}

.step-notes textarea {
  resize: none;
  font-size: 0.82em;
  color: var(--color-text-muted);
  flex: 1;
}

.btn-note-remove {
  background: none;
  border: none;
  color: var(--color-text-muted);
  padding: 2px 4px;
  cursor: pointer;
  font-size: 0.9em;
  line-height: 1;
}

.btn-note-remove:hover {
  color: var(--color-danger);
}

.step-row-wrapper {
  margin-bottom: 4px;
}

@media (max-width: 768px) {
  .drag-handle {
    min-width: 44px;
    min-height: 44px;
    justify-content: center;
    font-size: 1.3em;
  }

  .step-number {
    min-width: 20px;
  }

  .step-notes {
    margin-left: 44px;
  }
}
</style>
