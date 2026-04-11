<script setup lang="ts">
import type { Step, Section } from "@/types/recipe";

const props = defineProps<{
  sections: Section[];
  steps: Step[];
  editMode?: boolean;
  keyPrefix?: string;
}>();

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
    :key="keyPrefix + sectionIndex"
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
        :key="keyPrefix + 'step-' + stepIndex"
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
  margin-bottom: 2rem;
}

.step-section h4 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--bs-dark);
}

.list-group-item {
  padding: 1rem;
  font-size: 1.05rem;
  line-height: 1.5;
}

@media (max-width: 767px) {
  .list-group-item {
    padding: 1rem;
    font-size: 1.1rem;
  }
}
</style>
