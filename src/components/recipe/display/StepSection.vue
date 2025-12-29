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

    <!-- Inline-Editable Steps -->
    <template v-if="inlineEditable">
      <div class="steps-inline-list">
        <StepInlineEdit
          v-for="(step, stepIndex) in getFilteredSteps(section.section)"
          :key="keyPrefix + 'step-inline-' + stepIndex"
          :step="step"
          :step-number="getStepNumber(section.section, stepIndex)"
          :is-dirty="
            dirtyItems.has(
              `step:${getStepNumber(section.section, stepIndex) - 1}`,
            )
          "
          :is-editing-other="
            currentEditingIndex !== null &&
            currentEditingIndex !==
              getStepNumber(section.section, stepIndex) - 1
          "
          @changed="$emit('changed', $event)"
          @unchanged="$emit('unchanged', $event)"
          @start-edit="handleStartEdit"
          @end-edit="handleEndEdit"
        />
      </div>
    </template>

    <!-- Original Edit Mode or Read-Only -->
    <ul v-else class="list-group list-group-numbered list-group-flush">
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

<script>
import { BFormInput, BFormTextarea } from "bootstrap-vue-next";
import StepInlineEdit from "./StepInlineEdit.vue";

export default {
  name: "StepSection",
  components: {
    BFormInput,
    BFormTextarea,
    StepInlineEdit,
  },
  props: {
    sections: {
      type: Array,
      required: true,
    },
    steps: {
      type: Array,
      required: true,
    },
    editMode: {
      type: Boolean,
      default: false,
    },
    inlineEditable: {
      type: Boolean,
      default: false,
    },
    keyPrefix: {
      type: String,
      default: "",
    },
    dirtyItems: {
      type: Set,
      default: () => new Set(),
    },
  },
  emits: ["select-step", "changed", "unchanged"],
  data() {
    return {
      currentEditingIndex: null,
    };
  },
  methods: {
    handleStartEdit(stepIndex) {
      this.currentEditingIndex = stepIndex;
    },
    handleEndEdit() {
      this.currentEditingIndex = null;
    },
    getFilteredSteps(sectionName) {
      return this.steps.filter((x) => x.section === sectionName);
    },
    getStepNumber(sectionName, stepIndex) {
      // Calculate the global step number based on previous sections
      let globalIndex = 0;
      for (const section of this.sections) {
        if (section.section === sectionName) {
          return globalIndex + stepIndex + 1;
        }
        globalIndex += this.steps.filter(
          (x) => x.section === section.section,
        ).length;
      }
      return stepIndex + 1;
    },
  },
};
</script>

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

.steps-inline-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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
