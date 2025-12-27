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

<style scoped>
.btn-close-custom {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.25rem;
  color: var(--bs-secondary);
  transition: var(--transition-transform);
}

.btn-close-custom:hover {
  transform: scale(1.1);
}
</style>
