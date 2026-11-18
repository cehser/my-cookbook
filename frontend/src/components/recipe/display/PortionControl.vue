<script setup lang="ts">
import { useId } from "vue";
import { PORTIONS_MAX, PORTIONS_MIN } from "@/composables/usePortions";

const props = defineProps<{
  portions: number;
  unit: string;
  variant: "desktop" | "sheet";
}>();

const emit = defineEmits<{
  "update:portions": [value: number];
}>();

const inputId = useId();

function increase() {
  if (props.portions + 1 <= PORTIONS_MAX) {
    emit("update:portions", props.portions + 1);
  }
}

function decrease() {
  if (props.portions - 1 >= PORTIONS_MIN) {
    emit("update:portions", props.portions - 1);
  }
}

function onInput(ev: Event) {
  const raw = (ev.target as HTMLInputElement).value;
  if (raw === "") return;
  const value = Number(raw);
  if (value >= PORTIONS_MIN && value <= PORTIONS_MAX) {
    emit("update:portions", value);
  }
}

// Ungültige Eingabe beim Verlassen auf den geltenden Wert zurücksetzen
function onChange(ev: Event) {
  (ev.target as HTMLInputElement).value = String(props.portions);
}
</script>

<template>
  <div class="portion-control" :class="'portion-control--' + variant">
    <button
      type="button"
      class="portion-btn"
      aria-label="Portion weniger"
      :disabled="portions - 1 < PORTIONS_MIN"
      @click="decrease"
    >
      <i class="bi bi-dash-lg" aria-hidden="true"></i>
    </button>

    <div class="portion-display">
      <label :for="inputId" class="visually-hidden">Portionen</label>
      <input
        :id="inputId"
        type="number"
        inputmode="decimal"
        :min="PORTIONS_MIN"
        :max="PORTIONS_MAX"
        step="1"
        :value="portions"
        class="portion-input"
        @input="onInput"
        @change="onChange"
      />
      <span class="portion-unit">{{ unit }}</span>
    </div>

    <button
      type="button"
      class="portion-btn"
      aria-label="Portion mehr"
      :disabled="portions + 1 > PORTIONS_MAX"
      @click="increase"
    >
      <i class="bi bi-plus-lg" aria-hidden="true"></i>
    </button>
  </div>
</template>

<style scoped>
.portion-control {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  background: var(--color-divider);
  border-radius: var(--radius-pill);
}

.portion-control--desktop {
  margin-top: var(--space-4);
}

.portion-control--sheet {
  margin-top: var(--space-4);
}

.portion-btn {
  width: var(--action-btn-size);
  height: var(--action-btn-size);
  min-width: var(--action-btn-size);
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-circle);
  border: none;
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  font-size: var(--font-size-lg);
  flex-shrink: 0;
  transition: all var(--transition-fast);
  touch-action: manipulation;
}

.portion-btn:hover:not(:disabled) {
  transform: scale(1.05);
}

.portion-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.portion-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.portion-display {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  min-width: 0;
}

.portion-input {
  width: 64px;
  height: var(--action-btn-size);
  text-align: center;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  border: none;
  background: var(--color-surface-raised);
  border-radius: var(--radius-md);
  padding: var(--space-1);
  -webkit-appearance: none;
  -moz-appearance: textfield;
  appearance: textfield;
}

.portion-input::-webkit-outer-spin-button,
.portion-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.portion-input:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.portion-unit {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}
</style>
