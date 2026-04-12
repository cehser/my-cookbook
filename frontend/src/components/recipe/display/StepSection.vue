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

// Build effective sections: only sections that have steps, plus orphaned steps
const effectiveSections = computed(() => {
  const knownNames = new Set(props.sections.map((s) => s.section));
  const result: Section[] = [];

  // Orphaned steps (section name not in sections list) go first as unnamed
  const orphanedSteps = props.steps.filter(
    (s) => !knownNames.has(s.section ?? ""),
  );
  if (orphanedSteps.length > 0) {
    // Collect unique orphan section names and add them
    const orphanNames = new Set(orphanedSteps.map((s) => s.section ?? ""));
    for (const name of orphanNames) {
      result.push({ section: name });
    }
  }

  // Then add declared sections that actually have steps
  for (const section of props.sections) {
    const hasSteps = props.steps.some(
      (s) => (s.section ?? "") === section.section,
    );
    if (hasSteps) {
      result.push(section);
    }
  }

  return result;
});

function getFilteredSteps(sectionName: string) {
  return props.steps.filter((x) => (x.section ?? "") === sectionName);
}

function getStepNumber(sectionName: string, stepIndex: number) {
  let globalIndex = 0;
  for (const section of effectiveSections.value) {
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
    v-for="(section, sectionIndex) in effectiveSections"
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
