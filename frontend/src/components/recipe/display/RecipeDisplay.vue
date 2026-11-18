<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  nextTick,
  toRef,
  watch,
} from "vue";
import { useViewport } from "@/composables/useViewport";
import { usePortions } from "@/composables/usePortions";
import { useDebounceFn } from "@vueuse/core";
import MetadataOverlay from "@/components/recipe/display/MetadataOverlay.vue";
import PortionControl from "@/components/recipe/display/PortionControl.vue";
import IngredientsSection from "@/components/recipe/display/IngredientsSection.vue";
import IngredientFilterToggle from "@/components/recipe/display/IngredientFilterToggle.vue";
import MobileIngredientsBar from "@/components/recipe/display/MobileIngredientsBar.vue";
import StepSection from "@/components/recipe/display/StepSection.vue";
import LocalStatusBadge from "@/components/recipe/ui/LocalStatusBadge.vue";
import { effectiveSections } from "@/js/recipeSections";
import type { Recipe } from "@/types/recipe";

const props = withDefaults(
  defineProps<{
    recipe: Recipe;
    imageSrc: string;
    editMode?: boolean;
    /** Kennzeichnung im Kopf (`store.localStatus`), wie an der Karte */
    localStatus?: "pending" | "rejected" | null;
  }>(),
  {
    editMode: false,
    localStatus: null,
  },
);

// Portionen: nur Anzeige, das Rezept bleibt unverändert
const { portions, unit, factor, hasYields, setPortions } = usePortions(
  toRef(props, "recipe"),
);

const { isMobile, isDesktopOrTablet } = useViewport();

// UI state
const showMetadata = ref(false);
const onlyCurrentDesktop = ref(false);
const onlyCurrentMobile = ref(true);
const ingredientsExpanded = ref(false);

// Aktiver Abschnitt: Ein markierter Schritt hat Vorrang vor der
// Scroll-Erkennung (R-05).
const scrolledSection = ref<string | null>(null);
const activeStep = ref<number | null>(null);
const activeSection = computed<string | null>(() => {
  if (activeStep.value !== null) {
    const step = props.recipe.steps[activeStep.value];
    if (step) return step.section ?? "";
  }
  return scrolledSection.value;
});

function selectStep(index: number) {
  activeStep.value = activeStep.value === index ? null : index;
}

const hasSeveralIngredientSections = computed(
  () =>
    effectiveSections(props.recipe.sections, props.recipe.ingredients).length >
    1,
);

// Tablet: aktiven Zutatenblock in der Sticky-Spalte sichtbar halten (R-06)
const stickyEl = ref<HTMLElement | null>(null);

function revealActiveIngredients() {
  const container = stickyEl.value;
  const el = container?.querySelector<HTMLElement>(
    ".ingredients-section.active",
  );
  if (!container || !el) return;
  const c = container.getBoundingClientRect();
  const e = el.getBoundingClientRect();
  const pad = 8;
  let delta = 0;
  if (e.top < c.top) {
    delta = e.top - c.top - pad;
  } else if (e.bottom > c.bottom) {
    // so weit, dass das Blockende sichtbar ist, höchstens bis zum Blockanfang
    delta = Math.min(e.bottom - c.bottom + pad, e.top - c.top - pad);
  }
  if (delta === 0) return;
  const reduce = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  container.scrollBy({ top: delta, behavior: reduce ? "auto" : "smooth" });
}

watch(activeSection, () => {
  if (isDesktopOrTablet.value) nextTick(revealActiveIngredients);
});

// Intersection Observer for active section tracking
let observer: IntersectionObserver | null = null;

const updateActiveSection = useDebounceFn(() => {
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
  if (best) scrolledSection.value = best;
}, 100);

function observeStepSections() {
  if (observer) observer.disconnect();
  const els = document.querySelectorAll("[data-step-section]");
  if (!els.length) {
    setTimeout(observeStepSections, 100);
    return;
  }
  observer = new IntersectionObserver(() => updateActiveSection(), {
    threshold: [0, 0.25, 0.5, 0.75, 1],
  });
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
});

// Watch recipe changes to re-init observer
watch(
  () => props.recipe.recipe_uuid,
  () => {
    activeStep.value = null;
    scrolledSection.value = null;
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
        <div ref="stickyEl" class="sticky-wrapper">
          <div class="card rounded-0">
            <div class="card-header">
              <h3 class="card-title mb-0">Zutaten</h3>

              <PortionControl
                v-if="!editMode"
                :portions="portions"
                :unit="unit"
                variant="desktop"
                @update:portions="setPortions"
              />

              <IngredientFilterToggle
                v-if="!editMode && hasSeveralIngredientSections"
                class="mt-3"
                :only-current="onlyCurrentDesktop"
                @update:only-current="onlyCurrentDesktop = $event"
              />
            </div>
            <div class="card-body">
              <IngredientsSection
                :sections="recipe.sections"
                :active-section="activeSection"
                :ingredients="recipe.ingredients"
                :only-current="
                  onlyCurrentDesktop && hasSeveralIngredientSections
                "
                :factor="factor"
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
              :yields-value="hasYields ? portions : null"
              :yields-unit="hasYields ? unit : null"
              @close="showMetadata = false"
            />

            <div class="card-body" id="recipe_title">
              <LocalStatusBadge
                v-if="localStatus"
                class="title-local-badge"
                :status="localStatus"
              />
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
              :active-step="activeStep"
              key-prefix="desktop-"
              @select-step="selectStep"
            />
            <!-- Slot unter der Zubereitung (z. B. Vorlage des Imports) -->
            <slot name="after-steps" />
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
            <LocalStatusBadge
              v-if="localStatus"
              class="title-local-badge"
              :status="localStatus"
            />
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
            :active-step="activeStep"
            key-prefix="mobile-"
            @select-step="selectStep"
          />
          <slot name="after-steps" />
        </div>
      </div>
    </div>

    <!-- Mobile Bottom Bar -->
    <MobileIngredientsBar
      :is-expanded="ingredientsExpanded"
      :portions="portions"
      :unit="unit"
      :factor="factor"
      :only-current="onlyCurrentMobile"
      :sections="recipe.sections"
      :active-section="activeSection"
      :ingredients="recipe.ingredients"
      @open="ingredientsExpanded = true"
      @close="ingredientsExpanded = false"
      @update:portions="setPortions"
      @update:only-current="onlyCurrentMobile = $event"
    />
  </div>

  <!-- Mobile: Metadaten Bottom Sheet -->
  <MetadataOverlay
    :show="isMobile && showMetadata"
    :is-mobile="true"
    :recipe="recipe"
    :yields-value="hasYields ? portions : null"
    :yields-unit="hasYields ? unit : null"
    @close="showMetadata = false"
  />

  <!-- Slot for extra content (FAB, ShareManager, etc.) -->
  <slot name="after-content" />
</template>

<style scoped>
@import "@/assets/recipe-layout.css";

.title-local-badge {
  margin-bottom: var(--space-1);
}
</style>
