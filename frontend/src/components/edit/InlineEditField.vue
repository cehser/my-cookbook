<script setup lang="ts">
import { ref, nextTick } from "vue";
import { onClickOutside } from "@vueuse/core";

const props = defineProps<{
  modelValue: string;
  placeholder?: string;
  tag?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const editing = ref(false);
const editValue = ref("");
const inputRef = ref<HTMLInputElement | null>(null);
const wrapperRef = ref<HTMLElement | null>(null);

function startEdit() {
  editValue.value = props.modelValue;
  editing.value = true;
  nextTick(() => {
    inputRef.value?.focus();
    inputRef.value?.select();
  });
}

function commit() {
  if (!editing.value) return;
  editing.value = false;
  const trimmed = editValue.value.trim();
  if (trimmed && trimmed !== props.modelValue) {
    emit("update:modelValue", trimmed);
  }
}

function cancel() {
  editing.value = false;
}

onClickOutside(wrapperRef, () => {
  if (editing.value) commit();
});
</script>

<template>
  <span ref="wrapperRef" class="inline-edit-field">
    <input
      v-if="editing"
      ref="inputRef"
      v-model="editValue"
      :placeholder="placeholder"
      class="inline-edit-input"
      @keydown.enter.prevent="commit"
      @keydown.escape.prevent="cancel"
    />
    <span
      v-else
      class="inline-edit-display"
      role="button"
      tabindex="0"
      @click="startEdit"
      @keydown.enter.prevent="startEdit"
    >
      {{ modelValue || placeholder }}
      <i class="bi bi-pencil inline-edit-icon"></i>
    </span>
  </span>
</template>

<style scoped>
.inline-edit-field {
  display: inline-flex;
  align-items: center;
}

.inline-edit-display {
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid transparent;
  transition:
    background-color 0.15s,
    border-color 0.15s;
}

.inline-edit-display:hover,
.inline-edit-display:focus-visible {
  background-color: rgba(0, 0, 0, 0.05);
  border-color: rgba(0, 0, 0, 0.15);
}

.inline-edit-icon {
  font-size: 0.75em;
  opacity: 0;
  margin-left: 4px;
  transition: opacity 0.15s;
}

.inline-edit-display:hover .inline-edit-icon,
.inline-edit-display:focus-visible .inline-edit-icon {
  opacity: 0.5;
}

.inline-edit-input {
  font: inherit;
  padding: 2px 6px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  outline: none;
  width: 100%;
}
</style>
