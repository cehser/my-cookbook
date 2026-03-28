<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  nextTick,
  watch,
} from "vue";
import { useViewport } from "@/composables/useViewport";
import MetadataOverlay from "@/components/recipe/display/MetadataOverlay.vue";
import PortionControl from "@/components/recipe/display/PortionControl.vue";
import IngredientsSection from "@/components/recipe/display/IngredientsSection.vue";
import MobileIngredientsBar from "@/components/recipe/display/MobileIngredientsBar.vue";
import StepSection from "@/components/recipe/display/StepSection.vue";
import type { Recipe } from "@/types/recipe";

const props = withDefaults(
  defineProps<{
    recipe: Recipe;
    imageSrc: string;
    editMode?: boolean;
    inlineEditable?: boolean;
    dirtyItems?: Set<string>;
  }>(),
  {
    editMode: false,
    inlineEditable: false,
    dirtyItems: () => new Set<string>(),
  },
);

const emit = defineEmits<{
  "ingredient-changed": [key: string];
  "ingredient-unchanged": [key: string];
  "step-changed": [idx: number];
  "step-unchanged": [idx: number];
}>();

// Yields — computed from recipe prop, mutated in-place
const yieldsVal = computed(() => {
  if (props.recipe.yields?.length) return props.recipe.yields[0].value;
  return 1;
});
const yieldsUnitVal = computed(() => {
  if (props.recipe.yields?.length) return props.recipe.yields[0].unit;
  return "Units";
});
function setYieldsValue(val: number) {
  if (!props.recipe.yields?.length || val <= 0) return;
  const oldVal = props.recipe.yields[0].value;
  props.recipe.yields[0].value = val;
  const exp = props.recipe.recalc_exp || 1;
  props.recipe.ingredients.forEach((ing) => {
    if (ing.amounts?.[0] && typeof ing.amounts[0].amount === "number") {
      ing.amounts[0].amount =
        (ing.amounts[0].amount * Math.pow(val, exp)) / Math.pow(oldVal, exp);
    }
  });
}

const { isMobile, isDesktopOrTablet } = useViewport();

// UI state
const showMetadata = ref(false);
const showAllIngredients = ref(true);
const showOnlyCurrentSection = ref(true);
const ingredientsExpanded = ref(false);
const activeSection = ref<string | null>(null);

// Desktop sections filter
const visibleDesktopSections = computed(() => {
  if (!showAllIngredients.value && activeSection.value) {
    return props.recipe.sections.filter(
      (s) => s.section === activeSection.value,
    );
  }
  return props.recipe.sections;
});

// Mobile sections filter
const visibleIngredientSections = computed(() => {
  if (showOnlyCurrentSection.value && activeSection.value) {
    return props.recipe.sections.filter(
      (s) => s.section === activeSection.value,
    );
  }
  return props.recipe.sections;
});

// Step selection highlighting
function selectStep(ev: MouseEvent) {
  const target = ev.target as HTMLElement;
  const doHighlight = !target.classList.contains("list-group-item-primary");
  document.querySelectorAll("#steps .list-group-item").forEach((el) => {
    el.classList.remove("list-group-item-primary");
  });
  target.classList.toggle("list-group-item-primary", doHighlight);

  document
    .querySelectorAll("#ingredients .ingredients-section")
    .forEach((el) => {
      el.classList.remove(
        "highlighted",
        "list-group-item-primary",
        "border-primary",
      );
    });
  const section = target.dataset.section;
  const box = document.querySelector("#box-ing-" + section);
  if (box) {
    box.classList.toggle("highlighted", doHighlight);
    box.classList.toggle("list-group-item-primary", doHighlight);
    box.classList.toggle("border-primary", doHighlight);
  }
}

function scrollToIngredientSection(sectionName: string) {
  const el = document.querySelector(
    `.ingredient-section[data-section="${sectionName}"]`,
  );
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openIngredientsBar() {
  ingredientsExpanded.value = true;
  if (!showOnlyCurrentSection.value && activeSection.value) {
    nextTick(() => {
      const sectionEl = document.querySelector(
        `.ingredient-section[data-section="${activeSection.value}"]`,
      );
      sectionEl?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

// Intersection Observer for active section tracking
let observer: IntersectionObserver | null = null;
let sectionTimeout: ReturnType<typeof setTimeout> | null = null;

function observeStepSections() {
  if (observer) observer.disconnect();
  const els = document.querySelectorAll("[data-step-section]");
  if (!els.length) {
    setTimeout(observeStepSections, 100);
    return;
  }
  observer = new IntersectionObserver(
    () => {
      if (sectionTimeout) clearTimeout(sectionTimeout);
      sectionTimeout = setTimeout(() => {
        const all = document.querySelectorAll("[data-step-section]");
        let maxVis = 0;
        let best: string | null = null;
        all.forEach((el) => {
          const rect = el.getBoundingClientRect();
          const h = window.innerHeight;
          const visTop = Math.max(0, rect.top);
          const visBot = Math.min(h, rect.bottom);
          const vis = Math.max(0, visBot - visTop);
          const centerOffset = Math.abs(rect.top + rect.height / 2 - h / 3);
          const score = vis - centerOffset * 0.5;
          if (score > maxVis && vis > 50) {
            maxVis = score;
            best = (el as HTMLElement).dataset.stepSection || null;
          }
        });
        if (best) activeSection.value = best;
      }, 100);
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1] },
  );
  els.forEach((el) => observer!.observe(el));
}

// Public method for parent to re-trigger observer (e.g. on route change)
function reinitObserver() {
  nextTick(() => observeStepSections());
}

onMounted(() => {
  nextTick(() => observeStepSections());
});

onBeforeUnmount(() => {
  if (observer) observer.disconnect();
  if (sectionTimeout) clearTimeout(sectionTimeout);
});

// Watch recipe changes to re-init observer
watch(
  () => props.recipe.recipe_uuid,
  () => {
    reinitObserver();
  },
);

defineExpose({ reinitObserver });
</script>

<template>
  <!-- Desktop/Tablet: Split-View Layout -->
  <div v-if="isDesktopOrTablet" class="recipe-container split-view">
    <div class="split-layout">
      <!-- Left Column: Sticky Ingredients -->
      <aside class="ingredients-column">
        <div class="sticky-wrapper">
          <div class="card rounded-0">
            <div class="card-header">
              <h3 class="card-title mb-0">Zutaten</h3>

              <PortionControl
                v-if="!editMode"
                :yields-value="yieldsVal"
                :yields-unit="yieldsUnitVal"
                variant="desktop"
                @update:yields="setYieldsValue"
              />

              <div
                v-if="!editMode && recipe.sections.length > 1"
                class="filter-controls mt-3"
              >
                <BButton
                  size="sm"
                  :variant="
                    showAllIngredients ? 'primary' : 'outline-secondary'
                  "
                  @click="showAllIngredients = true"
                >
                  Alle Zutaten
                </BButton>
                <BButton
                  v-if="activeSection"
                  size="sm"
                  :variant="
                    !showAllIngredients ? 'primary' : 'outline-secondary'
                  "
                  @click="showAllIngredients = false"
                >
                  Nur aktuell
                </BButton>
              </div>
            </div>
            <div class="card-body">
              <IngredientsSection
                :sections="visibleDesktopSections"
                :active-section="activeSection"
                :ingredients="recipe.ingredients"
                :yields-value="yieldsVal"
                :inline-editable="inlineEditable"
                :dirty-items="dirtyItems"
                @changed="$emit('ingredient-changed', $event)"
                @unchanged="$emit('ingredient-unchanged', $event)"
              />
            </div>
          </div>
        </div>
      </aside>

      <!-- Right Column: Recipe Content -->
      <main class="steps-column">
        <div class="card rounded-0">
          <div id="recipe_title_container" class="recipe-image-container">
            <img
              class="card-img-top rounded-0"
              id="recipe_img"
              :src="imageSrc"
              alt="Rezeptbild"
            />
            <!-- Slot for overlays on the image (e.g. favorite star) -->
            <slot name="image-overlays" />

            <!-- Metadaten-Button -->
            <div
              class="metadata-toggle-icon"
              @click.prevent.stop="showMetadata = !showMetadata"
            >
              <i class="bi bi-info-circle" title="Metadaten anzeigen"></i>
            </div>

            <MetadataOverlay
              :show="showMetadata && !isMobile"
              :is-mobile="false"
              :recipe="recipe"
              :yields-value="yieldsVal"
              :yields-unit="yieldsUnitVal"
              @close="showMetadata = false"
            />

            <div class="card-body" id="recipe_title">
              <h2 class="card-title">
                <slot name="title">
                  {{ recipe.recipe_name }}
                </slot>
              </h2>
              <slot name="subtitle">
                <p v-if="recipe.subtitle" class="card-text">
                  {{ recipe.subtitle }}
                </p>
              </slot>
              <div v-if="recipe.tags && recipe.tags.length" class="mt-2">
                <span
                  v-for="(tag, idx) in recipe.tags"
                  :key="idx"
                  class="badge bg-light text-dark me-1"
                  >{{ tag }}</span
                >
              </div>
            </div>
          </div>

          <div class="card-body">
            <h3>Zubereitung</h3>
            <StepSection
              :sections="recipe.sections"
              :steps="recipe.steps"
              :edit-mode="editMode"
              :inline-editable="inlineEditable"
              :dirty-items="dirtyItems"
              key-prefix="desktop-"
              @select-step="selectStep"
              @changed="$emit('step-changed', $event)"
              @unchanged="$emit('step-unchanged', $event)"
            />
          </div>
        </div>
      </main>
    </div>
  </div>

  <!-- Mobile: Bottom Bar Layout -->
  <div v-else class="recipe-container mobile-view">
    <div class="recipe-content">
      <div class="card rounded-0">
        <div id="recipe_title_container" class="recipe-image-container">
          <img
            class="card-img-top rounded-0"
            id="recipe_img"
            :src="imageSrc"
            alt="Rezeptbild"
          />
          <!-- Slot for overlays on the image (e.g. favorite star) -->
          <slot name="image-overlays" />

          <!-- Metadaten-Button -->
          <div
            class="metadata-toggle-icon"
            @click.prevent.stop="showMetadata = !showMetadata"
          >
            <i class="bi bi-info-circle" title="Metadaten anzeigen"></i>
          </div>
          <div class="card-body" id="recipe_title">
            <h2 class="card-title">
              <slot name="title">
                {{ recipe.recipe_name }}
              </slot>
            </h2>
            <slot name="subtitle">
              <p v-if="recipe.subtitle" class="card-text">
                {{ recipe.subtitle }}
              </p>
            </slot>
            <div v-if="recipe.tags && recipe.tags.length" class="mt-2">
              <span
                v-for="(tag, idx) in recipe.tags"
                :key="idx"
                class="badge bg-light text-dark me-1"
                >{{ tag }}</span
              >
            </div>
          </div>
        </div>
        <div class="card-body">
          <h3>Zubereitung</h3>
          <StepSection
            :sections="recipe.sections"
            :steps="recipe.steps"
            :edit-mode="editMode"
            :inline-editable="inlineEditable"
            :dirty-items="dirtyItems"
            key-prefix="mobile-"
            @select-step="selectStep"
            @changed="$emit('step-changed', $event)"
            @unchanged="$emit('step-unchanged', $event)"
          />
        </div>
      </div>
    </div>

    <!-- Mobile Bottom Bar -->
    <MobileIngredientsBar
      :is-expanded="ingredientsExpanded"
      :yields-value="yieldsVal"
      :yields-unit="yieldsUnitVal"
      :show-only-current-section="showOnlyCurrentSection"
      :visible-sections="visibleIngredientSections"
      :sections="recipe.sections"
      :active-section="activeSection"
      :ingredients="recipe.ingredients"
      :inline-editable="inlineEditable"
      :dirty-items="dirtyItems"
      @open="openIngredientsBar"
      @close="ingredientsExpanded = false"
      @update:yields="setYieldsValue"
      @update:show-only-current-section="showOnlyCurrentSection = $event"
      @scroll-to-section="scrollToIngredientSection"
      @changed="$emit('ingredient-changed', $event)"
      @unchanged="$emit('ingredient-unchanged', $event)"
    />
  </div>

  <!-- Mobile: Metadaten Bottom Sheet -->
  <MetadataOverlay
    :show="isMobile && showMetadata"
    :is-mobile="true"
    :recipe="recipe"
    :yields-value="yieldsVal"
    :yields-unit="yieldsUnitVal"
    @close="showMetadata = false"
  />

  <!-- Slot for extra content (FAB, ShareManager, etc.) -->
  <slot name="after-content" />
</template>

<style scoped>
@import "@/assets/recipe-layout.css";
</style>
