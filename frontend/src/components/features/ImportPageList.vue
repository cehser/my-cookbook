<script setup lang="ts">
export interface ImportPage {
  id: number;
  blob: Blob;
  url: string;
}

defineProps<{
  pages: ImportPage[];
  disabled?: boolean;
}>();

const emit = defineEmits<{
  remove: [id: number];
}>();
</script>

<template>
  <ol class="page-list">
    <li v-for="(page, index) in pages" :key="page.id" class="page-item">
      <img :src="page.url" :alt="`Seite ${index + 1}`" class="page-thumb" />
      <span class="page-number">{{ index + 1 }}</span>
      <BButton
        size="sm"
        variant="danger"
        class="page-remove"
        :disabled="disabled"
        :aria-label="`Seite ${index + 1} entfernen`"
        @click="emit('remove', page.id)"
      >
        <i class="bi bi-trash"></i>
      </BButton>
    </li>
  </ol>
</template>

<style scoped>
.page-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.page-item {
  position: relative;
}

.page-thumb {
  display: block;
  width: 110px;
  height: 140px;
  object-fit: cover;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.page-number {
  position: absolute;
  top: 4px;
  left: 4px;
  min-width: 1.5rem;
  padding: 0 0.4rem;
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  text-align: center;
  font-size: 0.85rem;
}

.page-remove {
  position: absolute;
  right: 4px;
  bottom: 4px;
}
</style>
