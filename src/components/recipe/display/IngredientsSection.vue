<template>
  <div class="ingredients-sections">
    <div
      v-for="(section, index) in sections"
      :key="'ing-section-' + index"
      class="ingredients-section"
      :class="{ active: section.section === activeSection }"
      :data-section="section.section"
    >
      <h5>{{ section.section }}</h5>

      <!-- Inline-Editable Ingredients -->
      <template v-if="inlineEditable">
        <IngredientInlineEdit
          v-for="(ingredient, idx) in getSectionIngredients(section.section)"
          :key="'ing-edit-' + idx"
          :ingredient="ingredient"
          :yields-value="yieldsValue"
          :is-dirty="
            dirtyItems.has(
              `ingredient:${section.section}:${getIngredientName(ingredient)}`,
            )
          "
          :is-editing-other="
            currentEditingKey !== null &&
            currentEditingKey !==
              `ingredient:${section.section}:${getIngredientName(ingredient)}`
          "
          @changed="$emit('changed', $event)"
          @unchanged="$emit('unchanged', $event)"
          @start-edit="handleStartEdit"
          @end-edit="handleEndEdit"
        />
      </template>

      <!-- Read-Only Display -->
      <template v-else>
        <div
          class="row mb-2 ingredient-row"
          v-for="(ingredient, idx) in getSectionIngredients(section.section)"
          :key="'ing-' + idx"
        >
          <div class="col-4 ingredient-amount">
            {{ formatAmount(ingredient) }}
            {{ getUnit(ingredient) }}
          </div>
          <div class="col-8 ingredient-name">
            {{ getIngredientName(ingredient) }}
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import IngredientInlineEdit from "./IngredientInlineEdit.vue";

export default {
  name: "IngredientsSection",
  components: {
    IngredientInlineEdit,
  },
  props: {
    sections: {
      type: Array,
      required: true,
    },
    activeSection: {
      type: String,
      default: null,
    },
    ingredients: {
      type: Array,
      required: true,
    },
    yieldsValue: {
      type: Number,
      required: true,
    },
    inlineEditable: {
      type: Boolean,
      default: false,
    },
    dirtyItems: {
      type: Set,
      default: () => new Set(),
    },
  },
  emits: ["changed", "unchanged"],
  data() {
    return {
      currentEditingKey: null,
    };
  },
  methods: {
    handleStartEdit(ingredientKey) {
      this.currentEditingKey = ingredientKey;
    },
    handleEndEdit() {
      this.currentEditingKey = null;
    },
    getSectionIngredients(sectionName) {
      return this.ingredients.filter((x) => x.section === sectionName);
    },
    getIngredientName(ingredient) {
      // Filter out 'section' property
      const keys = Object.keys(ingredient).filter((key) => key !== "section");
      return keys[0];
    },
    getUnit(ingredient) {
      const name = this.getIngredientName(ingredient);
      return ingredient[name].amounts[0].unit;
    },
    formatAmount(ingredient) {
      const name = this.getIngredientName(ingredient);
      const amount = ingredient[name].amounts[0].amount;

      if (typeof amount !== "number") {
        return amount;
      }

      return Number(amount).toLocaleString("de-DE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    },
  },
};
</script>

<style scoped>
.ingredients-sections {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.ingredients-section {
  padding: 1rem;
  background: var(--bs-body-bg);
  border-radius: 8px;
  border-left: 3px solid transparent;
  transition: all 0.2s ease;
}

.ingredients-section.active {
  border-left-color: var(--bs-primary);
  background: rgba(var(--bs-primary-rgb), 0.05);
}

.ingredients-section h5 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--bs-primary);
}

.ingredient-row {
  padding: 0.35rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.ingredient-row:last-child {
  border-bottom: none;
}

.ingredient-amount {
  font-weight: 600;
  color: var(--bs-secondary);
}

.ingredient-name {
  color: var(--bs-body-color);
}
</style>
