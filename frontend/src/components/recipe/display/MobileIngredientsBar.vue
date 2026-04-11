<script setup lang="ts">
import PortionControl from "./PortionControl.vue";
import IngredientsSection from "./IngredientsSection.vue";
import CloseButton from "@/components/common/CloseButton.vue";
import type { Ingredient, Section } from "@/types/recipe";

defineProps<{
  isExpanded: boolean;
  yieldsValue: number;
  yieldsUnit: string;
  showOnlyCurrentSection: boolean;
  visibleSections: Section[];
  sections: Section[];
  activeSection?: string | null;
  ingredients: Ingredient[];
}>();

defineEmits<{
  open: [];
  close: [];
  "update:yields": [value: number];
  "update:showOnlyCurrentSection": [value: boolean];
  "scroll-to-section": [section: string];
}>();
</script>

<template>
  <div class="ingredients-bottom-bar" :class="{ expanded: isExpanded }">
    <!-- Collapsed State -->
    <button
      v-if="!isExpanded"
      class="bottom-bar-collapsed"
      aria-label="Zutaten öffnen"
      @click="$emit('open')"
    >
      <!-- Portionen-Kontrolle (Mobile Collapsed) -->
      <PortionControl
        :yields-value="yieldsValue"
        :yields-unit="yieldsUnit"
        variant="mobile-collapsed"
        @update:yields="$emit('update:yields', $event)"
        @click.stop
      />

      <div class="divider-vertical"></div>

      <i class="bi bi-list-ul"></i>
      <span class="bar-title">Zutaten</span>
      <i class="bi bi-chevron-up"></i>
    </button>

    <!-- Expanded State -->
    <div v-else class="bottom-bar-expanded">
      <div class="bar-header">
        <h6><i class="bi bi-list-ul me-2"></i>Zutaten</h6>
        <CloseButton @close="$emit('close')" />
      </div>

      <!-- Portionen-Kontrolle (Mobile Expanded) -->
      <PortionControl
        :yields-value="yieldsValue"
        :yields-unit="yieldsUnit"
        variant="mobile-expanded"
        @update:yields="$emit('update:yields', $event)"
      />

      <!-- Filter Toggle -->
      <div class="filter-toggle">
        <BButton
          size="sm"
          :variant="showOnlyCurrentSection ? 'primary' : 'outline-secondary'"
          @click="$emit('update:showOnlyCurrentSection', true)"
        >
          Nur aktuell
        </BButton>
        <BButton
          size="sm"
          :variant="!showOnlyCurrentSection ? 'primary' : 'outline-secondary'"
          @click="$emit('update:showOnlyCurrentSection', false)"
        >
          Alle
        </BButton>
      </div>

      <!-- Ingredients Content -->
      <div class="ingredients-content">
        <IngredientsSection
          :sections="visibleSections"
          :active-section="activeSection ?? null"
          :ingredients="ingredients"
          :yields-value="yieldsValue"
        />
      </div>

      <!-- Section Quick-Jump Chips -->
      <div
        v-if="!showOnlyCurrentSection && sections.length > 1"
        class="section-chips"
      >
        <BButton
          v-for="section in sections"
          :key="'chip-' + section.section"
          size="sm"
          :variant="
            section.section === activeSection ? 'primary' : 'outline-secondary'
          "
          @click="$emit('scroll-to-section', section.section)"
        >
          {{ section.section }}
        </BButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ============================================
   MOBILE: BOTTOM BAR LAYOUT
   ============================================ */
.ingredients-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: var(--z-mobile-bar);
  background: var(--color-surface-raised);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: 0 -2px 12px rgba(60, 50, 40, 0.15);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Collapsed State */
.bottom-bar-collapsed {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  cursor: pointer;
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-md);
  color: var(--color-primary);
  background: none;
  border: none;
  width: 100%;
  text-align: left;
}

.bottom-bar-collapsed .bar-title {
  flex: 1;
}

.bottom-bar-collapsed .active-section-chip {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  font-weight: var(--font-weight-normal);
}

.divider-vertical {
  width: 1px;
  height: 28px;
  background: var(--color-border);
  flex-shrink: 0;
}

/* Expanded State */
.ingredients-bottom-bar.expanded {
  max-height: 60vh;
  height: auto;
}

.bottom-bar-expanded {
  display: flex;
  flex-direction: column;
  max-height: 60vh;
  padding: var(--space-4);
}

.bar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.bar-header h6 {
  margin: 0;
  font-weight: var(--font-weight-semibold);
}

/* Filter Toggle */
.filter-toggle {
  display: flex;
  gap: var(--space-2);
  margin: var(--space-4) 0;
}

.filter-toggle .btn {
  flex: 1;
}

/* Ingredients Content */
.ingredients-content {
  overflow-y: auto;
  flex: 1;
  padding: var(--space-2) 0;
  margin-bottom: var(--space-4);
}

/* Section Quick-Jump Chips */
.section-chips {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3) 0 var(--space-2);
  overflow-x: auto;
  border-top: 1px solid var(--color-border);
  flex-wrap: nowrap;
  scrollbar-width: none;
}

.section-chips::-webkit-scrollbar {
  display: none;
}

.section-chips .btn {
  white-space: nowrap;
  flex-shrink: 0;
}
</style>
