<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useEventListener } from "@vueuse/core";
import PortionControl from "./PortionControl.vue";
import IngredientsSection from "./IngredientsSection.vue";
import IngredientFilterToggle from "./IngredientFilterToggle.vue";
import CloseButton from "@/components/common/CloseButton.vue";
import type { Ingredient, Section } from "@/types/recipe";
import { effectiveSections } from "@/js/recipeSections";

const props = defineProps<{
  isExpanded: boolean;
  portions: number;
  unit: string;
  factor: number;
  onlyCurrent: boolean;
  sections: Section[];
  activeSection?: string | null;
  ingredients: Ingredient[];
}>();

const emit = defineEmits<{
  open: [];
  close: [];
  "update:portions": [value: number];
  "update:onlyCurrent": [value: boolean];
}>();

// Abschnitte, die Zutaten haben: Filter und Chips nur, wenn es mehrere gibt
const ingredientSections = computed(() =>
  effectiveSections(props.sections, props.ingredients),
);
const hasSeveralSections = computed(() => ingredientSections.value.length > 1);
const filterActive = computed(
  () => props.onlyCurrent && hasSeveralSections.value,
);

const contentEl = ref<HTMLElement | null>(null);

function scrollToSection(name: string, smooth = true) {
  const container = contentEl.value;
  if (!container) return;
  const el = container.querySelector<HTMLElement>(
    `.ingredients-section[data-section="${CSS.escape(name)}"]`,
  );
  if (!el) return;
  container.scrollTo({
    top: el.offsetTop - container.offsetTop,
    behavior: smooth ? "smooth" : "auto",
  });
}

// Beim Öffnen mit „Alle“ und beim Wechsel auf „Alle“ zum aktiven Abschnitt
watch(
  () => props.isExpanded && !filterActive.value,
  (showAll) => {
    if (!showAll || props.activeSection == null) return;
    const name = props.activeSection;
    nextTick(() => scrollToSection(name, false));
  },
);

// Escape schließt das Sheet (vollständige Dialog-Semantik folgt mit U.11)
useEventListener(document, "keydown", (ev: KeyboardEvent) => {
  if (props.isExpanded && ev.key === "Escape") emit("close");
});
</script>

<template>
  <!-- Fläche hinter dem Sheet: Antippen schließt -->
  <Transition name="sheet-backdrop">
    <div
      v-if="isExpanded"
      class="sheet-backdrop"
      aria-hidden="true"
      @click="$emit('close')"
    ></div>
  </Transition>

  <div class="ingredients-bottom-bar" :class="{ expanded: isExpanded }">
    <!-- Collapsed: ein einziges Ziel (R-07) -->
    <button
      v-if="!isExpanded"
      type="button"
      class="bottom-bar-collapsed"
      aria-expanded="false"
      @click="$emit('open')"
    >
      <i class="bi bi-list-ul" aria-hidden="true"></i>
      <span class="bar-title">Zutaten</span>
      <span class="bar-portions">{{ portions }} {{ unit }}</span>
      <i class="bi bi-chevron-up" aria-hidden="true"></i>
    </button>

    <!-- Expanded State -->
    <div v-else class="bottom-bar-expanded">
      <div class="bar-header">
        <h6><i class="bi bi-list-ul me-2" aria-hidden="true"></i>Zutaten</h6>
        <CloseButton class="sheet-close" @close="$emit('close')" />
      </div>

      <PortionControl
        :portions="portions"
        :unit="unit"
        variant="sheet"
        @update:portions="$emit('update:portions', $event)"
      />

      <IngredientFilterToggle
        v-if="hasSeveralSections"
        class="sheet-filter"
        :only-current="onlyCurrent"
        @update:only-current="$emit('update:onlyCurrent', $event)"
      />

      <div ref="contentEl" class="ingredients-content">
        <IngredientsSection
          :sections="sections"
          :active-section="activeSection ?? null"
          :ingredients="ingredients"
          :only-current="filterActive"
          :factor="factor"
        />
      </div>

      <!-- Sprung zu Abschnitten -->
      <div v-if="!filterActive && hasSeveralSections" class="section-chips">
        <button
          v-for="section in ingredientSections"
          :key="'chip-' + section.section"
          type="button"
          class="section-chip"
          :aria-current="section.section === activeSection ? 'true' : undefined"
          @click="scrollToSection(section.section)"
        >
          {{ section.section || "Ohne Abschnitt" }}
        </button>
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
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-mobile-bar) - 1);
  background: rgba(0, 0, 0, 0.35);
}

.sheet-backdrop-enter-active,
.sheet-backdrop-leave-active {
  transition: opacity var(--transition-fast);
}

.sheet-backdrop-enter-from,
.sheet-backdrop-leave-to {
  opacity: 0;
}

/* Collapsed State */
.bottom-bar-collapsed {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 56px;
  padding: var(--space-3) var(--space-5);
  cursor: pointer;
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-md);
  color: var(--color-primary);
  background: none;
  border: none;
  width: 100%;
  text-align: left;
  touch-action: manipulation;
}

.bottom-bar-collapsed .bar-title {
  flex: 1;
}

.bottom-bar-collapsed .bar-portions {
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

/* Expanded State */
.ingredients-bottom-bar.expanded {
  max-height: 75vh;
  height: auto;
}

.bottom-bar-expanded {
  display: flex;
  flex-direction: column;
  max-height: 75vh;
  padding: var(--space-3) var(--space-4) var(--space-2);
}

.bar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.bar-header h6 {
  margin: 0;
  font-weight: var(--font-weight-semibold);
}

.sheet-close {
  width: var(--action-btn-size);
  height: var(--action-btn-size);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: calc(-1 * var(--space-2));
}

.bottom-bar-expanded > :deep(.portion-control) {
  margin-top: var(--space-2);
  flex-shrink: 0;
}

.sheet-filter {
  margin-top: var(--space-3);
  flex-shrink: 0;
}

/* Ingredients Content: schrumpft, Kopf und Chips nicht (R-11) */
.ingredients-content {
  position: relative;
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
  padding: var(--space-3) 0;
  border-top: 1px solid var(--color-border);
  margin-top: var(--space-3);
}

/* Section Quick-Jump Chips */
.section-chips {
  display: flex;
  flex-shrink: 0;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  overflow-x: auto;
  border-top: 1px solid var(--color-border);
  flex-wrap: nowrap;
  scrollbar-width: none;
}

.section-chips::-webkit-scrollbar {
  display: none;
}

.section-chip {
  flex-shrink: 0;
  min-height: var(--action-btn-size);
  padding: 0 var(--space-4);
  white-space: nowrap;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-md);
  touch-action: manipulation;
}

.section-chip[aria-current="true"] {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
}

.section-chip:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>
