<script setup lang="ts">
defineProps<{
  show: boolean;
  changedItemsCount: number;
}>();

defineEmits<{
  save: [];
  cancel: [];
}>();
</script>

<template>
  <transition name="slide-down">
    <div v-if="show" class="inline-edit-action-bar">
      <div class="action-bar-content">
        <div class="info-section">
          <i class="bi bi-pencil-square me-2"></i>
          <span class="mode-label">Inline-Bearbeitung</span>
          <span v-if="changedItemsCount > 0" class="changes-badge">
            {{ changedItemsCount }}
            {{ changedItemsCount === 1 ? "Änderung" : "Änderungen" }}
          </span>
        </div>
        <div class="action-buttons">
          <BButton
            variant="outline-light"
            size="sm"
            @click="$emit('cancel')"
            class="action-btn"
          >
            <i class="bi bi-x-lg me-1"></i>
            Abbrechen
          </BButton>
          <BButton
            variant="success"
            size="sm"
            @click="$emit('save')"
            :disabled="changedItemsCount === 0"
            class="action-btn"
          >
            <i class="bi bi-check-lg me-1"></i>
            Speichern
          </BButton>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.inline-edit-action-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1040;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
}

.action-bar-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0.75rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.info-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: white;
}

.mode-label {
  font-weight: 600;
  font-size: 0.95rem;
}

.changes-badge {
  background: rgba(255, 255, 255, 0.25);
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.action-buttons {
  display: flex;
  gap: 0.75rem;
}

.action-btn {
  min-width: 110px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

.slide-down-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}

.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

@media (max-width: 767px) {
  .action-bar-content {
    flex-direction: column;
    padding: 0.75rem 1rem;
    gap: 0.75rem;
  }

  .info-section {
    width: 100%;
    justify-content: center;
  }

  .action-buttons {
    width: 100%;
    justify-content: stretch;
  }

  .action-btn {
    flex: 1;
  }

  .mode-label {
    font-size: 0.9rem;
  }

  .changes-badge {
    font-size: 0.8rem;
  }
}
</style>
