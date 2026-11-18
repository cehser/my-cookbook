<script setup lang="ts">
import { computed } from "vue";
import type { Step, Section } from "@/types/recipe";
import { effectiveSections } from "@/js/recipeSections";

const props = defineProps<{
  sections: Section[];
  steps: Step[];
  editMode?: boolean;
  keyPrefix?: string;
  /** Index des markierten Schritts in `steps` */
  activeStep?: number | null;
}>();

const keyPfx = computed(() => props.keyPrefix ?? "");

defineEmits<{
  /** Index des angetippten Schritts in `steps` */
  "select-step": [index: number];
}>();

// Nur Abschnitte mit Schritten, verwaiste Schritte zuerst
const shownSections = computed(() =>
  effectiveSections(props.sections, props.steps),
);

function getFilteredSteps(sectionName: string) {
  return props.steps.filter((x) => (x.section ?? "") === sectionName);
}

function getStepNumber(sectionName: string, stepIndex: number) {
  let globalIndex = 0;
  for (const section of shownSections.value) {
    if (section.section === sectionName) {
      return globalIndex + stepIndex + 1;
    }
    globalIndex += props.steps.filter(
      (x) => (x.section ?? "") === section.section,
    ).length;
  }
  return stepIndex + 1;
}
</script>

<template>
  <div
    v-for="(section, sectionIndex) in shownSections"
    :key="keyPfx + sectionIndex"
    :data-step-section="section.section"
    class="step-section"
  >
    <h4 v-if="!editMode && section.section">{{ section.section }}</h4>
    <BFormInput
      v-else-if="editMode"
      v-model="section.section"
      class="mb-2 fw-bold"
      placeholder="Abschnittsname"
    />

    <!-- Steps -->
    <ul class="list-group list-group-numbered list-group-flush">
      <li
        class="list-group-item"
        :class="{
          'step-item': !editMode,
          'step-active': !editMode && steps.indexOf(step) === activeStep,
        }"
        v-for="(step, stepIndex) in getFilteredSteps(section.section)"
        :key="keyPfx + 'step-' + stepIndex"
        :data-section="section.section"
        :data-step-number="getStepNumber(section.section, stepIndex)"
      >
        <!-- Ganze Zeile antippbar (::after), Text bleibt normal umbrochen -->
        <button
          v-if="!editMode"
          type="button"
          class="step-btn"
          :aria-pressed="steps.indexOf(step) === activeStep"
          @click="$emit('select-step', steps.indexOf(step))"
        >
          {{ step.step }}
        </button>
        <BFormTextarea v-else v-model="step.step" rows="3" />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.step-section {
  margin-bottom: var(--space-6);
}

.step-section h4 {
  font-size: 1.25rem;
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-4);
  color: var(--color-text);
}

.list-group-item {
  padding: var(--space-4);
  font-size: 1.05rem;
  line-height: var(--line-height-base);
}

/* Schritt markieren (R-05) */
.step-item {
  position: relative;
  display: flex;
  gap: var(--space-1);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.step-btn {
  flex: 1;
  min-width: 0;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  line-height: inherit;
  text-align: left;
  touch-action: manipulation;
}

.step-btn::after {
  content: "";
  position: absolute;
  inset: 0;
}

.step-btn:focus-visible {
  outline: none;
}

.step-item:has(.step-btn:focus-visible) {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.step-item.step-active {
  background: var(--color-primary-subtle);
  box-shadow: inset 4px 0 0 var(--color-primary);
}

@media (max-width: 767px) {
  .list-group-item {
    padding: var(--space-4);
    font-size: var(--font-size-lg);
  }
}
</style>
