<template>
  <div
    v-if="!editMode && (!readOnly || expertMode)"
    class="fab-container"
    :class="{ 'read-only': readOnly }"
  >
    <transition name="fab-items">
      <div v-if="menuOpen" class="fab-menu">
        <!-- Actions (nur wenn nicht read-only) -->
        <template v-if="!readOnly">
          <BButton
            @click="handleAction('inline-edit')"
            class="fab-menu-item"
            variant="light"
            size="sm"
            title="Inline bearbeiten"
          >
            <i class="bi bi-pencil"></i>
            <span>Inline-Edit</span>
          </BButton>
          <BButton
            @click="handleAction('edit')"
            class="fab-menu-item"
            variant="light"
            size="sm"
            title="Vollständig bearbeiten"
          >
            <i class="bi bi-pencil-square"></i>
            <span>Bearbeiten</span>
          </BButton>
          <BButton
            @click="handleAction('copy')"
            class="fab-menu-item"
            variant="light"
            size="sm"
            title="Duplizieren"
          >
            <i class="bi bi-files"></i>
            <span>Duplizieren</span>
          </BButton>
          <BButton
            @click="handleAction('delete')"
            class="fab-menu-item"
            variant="danger"
            size="sm"
            title="Löschen"
          >
            <i class="bi bi-trash"></i>
            <span>Löschen</span>
          </BButton>
          <BButton
            @click="handleAction('share')"
            class="fab-menu-item"
            variant="light"
            size="sm"
            title="Teilen"
          >
            <i class="bi bi-share"></i>
            <span>Teilen</span>
          </BButton>
        </template>

        <!-- Export (nur im Expert-Modus) -->
        <BButton
          v-if="expertMode"
          @click="handleAction('export')"
          class="fab-menu-item"
          variant="light"
          size="sm"
          title="Als YAML exportieren"
        >
          <i class="bi bi-download"></i>
          <span>YAML Export</span>
        </BButton>
      </div>
    </transition>
    <BButton
      @click="toggleMenu"
      class="fab-edit-button fab-main"
      variant="primary"
      :class="{ 'fab-open': menuOpen }"
      title="Menü"
    >
      <i
        class="bi"
        :class="menuOpen ? 'bi-x-lg' : 'bi-three-dots-vertical'"
      ></i>
    </BButton>
  </div>
</template>

<script>
import { BButton } from "bootstrap-vue-next";

export default {
  name: "RecipeFabMenu",
  components: {
    BButton,
  },
  props: {
    editMode: {
      type: Boolean,
      default: false,
    },
    readOnly: {
      type: Boolean,
      default: false,
    },
    expertMode: {
      type: Boolean,
      default: false,
    },
    menuOpen: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["toggle-menu", "inline-edit", "edit", "copy", "delete", "share", "export"],
  methods: {
    toggleMenu() {
      this.$emit("toggle-menu");
    },
    handleAction(action) {
      this.$emit(action);
      this.$emit("toggle-menu"); // Close menu after action
    },
  },
};
</script>

<style scoped>
/* FAB Container and Menu */
.fab-container {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: var(--z-fab);
  display: flex;
  flex-direction: column; /* Menü ÜBER Button */
  align-items: flex-end;
}

.fab-menu {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem; /* Abstand zum FAB-Button */
  align-items: flex-end;
}

.fab-menu-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  box-shadow: var(--shadow-md);
  border-radius: var(--radius-lg);
  white-space: nowrap;
  min-width: 140px;
  justify-content: flex-start;
}

.fab-menu-item i {
  font-size: 1.1rem;
}

.fab-menu-item span {
  font-weight: 500;
}

.fab-edit-button {
  width: var(--fab-size);
  height: var(--fab-size);
  border-radius: var(--radius-circle);
  box-shadow: var(--shadow-fab);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  transition: var(--transition-all-normal);
}

.fab-edit-button:hover {
  transform: scale(1.1);
  box-shadow: var(--shadow-fab-hover);
}

.fab-main {
  transition: var(--transition-transform) 0.3s;
}

.fab-main.fab-open {
  transform: rotate(90deg);
}

.fab-items-enter-active,
.fab-items-leave-active {
  transition: var(--transition-all-normal);
}

.fab-items-enter-from,
.fab-items-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.fab-items-enter-to,
.fab-items-leave-from {
  opacity: 1;
  transform: translateY(0);
}

/* Responsive adjustments */
@media (max-width: 767px) {
  /* Mobile: FAB deutlich höher positionieren wegen Bottom-Bar */
  .fab-container {
    bottom: 7rem; /* Über der Bottom-Bar */
  }
}

@media (min-width: 768px) {
  /* Desktop/Tablet: Normale FAB Position */
  .fab-container {
    bottom: 2rem;
    right: 2rem;
  }
}
</style>
