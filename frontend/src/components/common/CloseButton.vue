<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
  }>(),
  {
    title: "Schließen",
  },
);

defineEmits<{
  close: [];
}>();
</script>

<template>
  <button
    class="btn-close-custom"
    @click="$emit('close')"
    :title="title"
    type="button"
  >
    <i class="bi bi-x-lg"></i>
  </button>
</template>

<style scoped>
.btn-close-custom {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  padding: var(--space-1);
  color: var(--color-text-muted);
  transition: var(--transition-transform);
}

.btn-close-custom:hover {
  transform: scale(1.1);
}
</style>
