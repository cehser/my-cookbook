<script setup lang="ts">
defineProps<{
  onlyCurrent: boolean;
}>();

defineEmits<{
  "update:onlyCurrent": [value: boolean];
}>();
</script>

<template>
  <div class="filter-toggle" role="group" aria-label="Zutaten anzeigen">
    <button
      type="button"
      class="filter-option"
      :aria-pressed="onlyCurrent"
      @click="$emit('update:onlyCurrent', true)"
    >
      Nur aktuell
    </button>
    <button
      type="button"
      class="filter-option"
      :aria-pressed="!onlyCurrent"
      @click="$emit('update:onlyCurrent', false)"
    >
      Alle
    </button>
  </div>
</template>

<style scoped>
/* Segmented Control, 44 px hoch (X-03) */
.filter-toggle {
  display: flex;
  padding: 2px;
  background: var(--color-divider);
  border-radius: var(--radius-md);
}

.filter-option {
  flex: 1;
  min-height: var(--action-btn-size);
  padding: 0 var(--space-3);
  border: none;
  border-radius: calc(var(--radius-md) - 2px);
  background: transparent;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  touch-action: manipulation;
  transition: background var(--transition-fast);
}

.filter-option[aria-pressed="true"] {
  background: var(--color-primary-subtle);
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
  box-shadow: inset 0 0 0 1px var(--color-primary);
}

.filter-option:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}
</style>
