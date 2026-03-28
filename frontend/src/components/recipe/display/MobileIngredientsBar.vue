<template>
  <div class="ingredients-bottom-bar" :class="{ expanded: isExpanded }">
    <!-- Collapsed State -->
    <div v-if="!isExpanded" class="bottom-bar-collapsed" @click="$emit('open')">
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
    </div>

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
          :active-section="activeSection"
          :ingredients="ingredients"
          :yields-value="yieldsValue"
          :inline-editable="inlineEditable"
          :dirty-items="dirtyItems"
          @changed="$emit('changed', $event)"
          @unchanged="$emit('unchanged', $event)"
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

<script setup lang="ts">
import PortionControl from './PortionControl.vue'
import IngredientsSection from './IngredientsSection.vue'
import CloseButton from '@/components/common/CloseButton.vue'
import { BButton } from 'bootstrap-vue-next'
import type { Ingredient, Section } from '@/types/recipe'

defineProps<{
  isExpanded: boolean
  yieldsValue: number
  yieldsUnit: string
  showOnlyCurrentSection: boolean
  visibleSections: Section[]
  sections: Section[]
  activeSection?: string
  ingredients: Ingredient[]
  inlineEditable?: boolean
  dirtyItems?: Set<string>
}>()

defineEmits<{
  open: []
  close: []
  'update:yields': [value: number]
  'update:showOnlyCurrentSection': [value: boolean]
  'scroll-to-section': [section: string]
  changed: [event: unknown]
  unchanged: [event: unknown]
}>()
</script>

<style scoped>
/* ============================================
   MOBILE: BOTTOM BAR LAYOUT
   ============================================ */
.ingredients-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: white;
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.15);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Collapsed State */
.bottom-bar-collapsed {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  color: var(--bs-primary);
}

.bottom-bar-collapsed .bar-title {
  flex: 1;
}

.bottom-bar-collapsed .active-section-chip {
  font-size: 0.85rem;
  color: var(--bs-secondary);
  font-weight: 400;
}

.divider-vertical {
  width: 1px;
  height: 28px;
  background: var(--bs-border-color);
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
  padding: 1rem;
}

.bar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--bs-border-color);
}

.bar-header h6 {
  margin: 0;
  font-weight: 600;
}

/* Filter Toggle */
.filter-toggle {
  display: flex;
  gap: 0.5rem;
  margin: 1rem 0;
}

.filter-toggle .btn {
  flex: 1;
}

/* Ingredients Content */
.ingredients-content {
  overflow-y: auto;
  flex: 1;
  padding: 0.5rem 0;
  margin-bottom: 1rem;
}

/* Section Quick-Jump Chips */
.section-chips {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 0 0.5rem;
  overflow-x: auto;
  border-top: 1px solid var(--bs-border-color);
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
