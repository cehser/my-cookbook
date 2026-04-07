<script setup lang="ts">
import { computed } from "vue";
import { useTextareaAutosize } from "@vueuse/core";
import ArrayReorderBtnGroup from "@/components/common/ArrayReorderBtnGroup.vue";
import type { Step } from "@/types/recipe";

const props = defineProps<{
  step: Step;
  steps: Step[];
  index: number;
  number: number;
}>();

const emit = defineEmits<{
  delete: [];
  "update:step": [value: string];
}>();

const { textarea } = useTextareaAutosize({
  input: computed(() => props.step.step),
  onResize() {
    // auto-handled
  },
});

function onInput(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value;
  emit("update:step", value);
}
</script>

<template>
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
        size="sm"
        variant="outline-danger"
        title="Schritt löschen"
        @click="emit('delete')"
      >
        <i class="bi bi-trash"></i>
      </BButton>
      <ArrayReorderBtnGroup :array="steps" :index="index" />
    </div>
  </div>
</template>

<style scoped>
.step-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 4px;
}

.drag-handle {
  cursor: grab;
  padding: 4px;
  color: #999;
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
  min-width: 28px;
  text-align: right;
  margin-top: 6px;
  color: #666;
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

@media (max-width: 768px) {
  .drag-handle {
    min-width: 44px;
    min-height: 44px;
    justify-content: center;
    font-size: 1.3em;
  }
}
</style>
