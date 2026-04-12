<script setup lang="ts">
import { computed } from "vue";
import type { Step, Section } from "@/types/recipe";

const props = defineProps<{
  sections: Section[];
  steps: Step[];
  editMode?: boolean;
  keyPrefix?: string;
}>();

const keyPfx = computed(() => props.keyPrefix ?? "");

defineEmits<{
  "select-step": [event: Event];
}>();

function getFilteredSteps(sectionName: string) {
  return props.steps.filter((x) => x.section === sectionName);
}

function getStepNumber(sectionName: string, stepIndex: number) {
  let globalIndex = 0;
  for (const section of props.sections) {
    if (section.section === sectionName) {
      return globalIndex + stepIndex + 1;
    }
    globalIndex += props.steps.filter(
      (x) => x.section === section.section,
    ).length;
  }
  return stepIndex + 1;
}
</script>

<template>
  <div
    v-for="(section, sectionIndex) in sections"
    :key="keyPfx + sectionIndex"
    :data-step-section="section.section"
    class="step-section"
  >
    <h4 v-if="!editMode">{{ section.section }}</h4>
    <BFormInput
      v-else
      v-model="section.section"
      class="mb-2 fw-bold"
      placeholder="Abschnittsname"
    />

    <!-- Steps -->
    <ul class="list-group list-group-numbered list-group-flush">
      <li
        class="list-group-item"
        v-for="(step, stepIndex) in getFilteredSteps(section.section)"
        :key="keyPfx + 'step-' + stepIndex"
        :data-section="section.section"
        :data-step-number="getStepNumber(section.section, stepIndex)"
        @click="!editMode && $emit('select-step', $event)"
      >
        <span v-if="!editMode">{{ step.step }}</span>
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

@media (max-width: 767px) {
  .list-group-item {
    padding: var(--space-4);
    font-size: var(--font-size-lg);
  }
}
</style>
