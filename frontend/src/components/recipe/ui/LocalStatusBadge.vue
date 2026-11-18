<script setup lang="ts">
/**
 * Kennzeichnung lokaler Rezepte („Nur auf diesem Gerät“ bzw. „Vom Server
 * abgelehnt“), Quelle `store.localStatus(uuid)`. Karte und Rezeptansicht.
 */
defineProps<{ status: "pending" | "rejected" }>();
</script>

<template>
  <span
    class="local-badge"
    :class="{ 'local-badge-rejected': status === 'rejected' }"
    >{{
      status === "rejected" ? "Vom Server abgelehnt" : "Nur auf diesem Gerät"
    }}</span
  >
</template>

<style scoped>
/* Text, nicht größer als ein Tag-Chip */
.local-badge {
  display: inline-block;
  padding: 0.2em 0.5em;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
  line-height: 1.2;
  background-color: var(--color-warning-bg);
  color: var(--color-warning-text);
  box-shadow: var(--shadow-sm);
}

.local-badge-rejected {
  background-color: var(--color-danger);
  color: var(--color-text-on-primary);
}
</style>
