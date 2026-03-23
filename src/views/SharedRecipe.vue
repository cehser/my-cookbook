<template>
  <div id="recipe" :class="{ 'shared-mode': true }">
    <!-- Minimale Navbar -->
    <nav class="navbar navbar-dark bg-dark sticky-top">
      <div class="container-fluid">
        <span class="navbar-brand">Kochbuch</span>
        <span class="badge bg-secondary"><i class="bi bi-share"></i> Geteiltes Rezept</span>
      </div>
    </nav>

    <!-- Loading -->
    <div v-if="loading" class="text-center mt-5">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">Laden...</span>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="container mt-5">
      <div class="alert alert-warning text-center">
        <i class="bi bi-exclamation-triangle me-2"></i>{{ error }}
      </div>
    </div>

    <template v-else-if="current_recipe">
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
                    :yields-value="yields_value"
                    :yields-unit="yields_unit"
                    variant="desktop"
                    @update:yields="setYieldsValue"
                  />
                  <div
                    v-if="current_recipe.sections.length > 1"
                    class="filter-controls mt-3"
                  >
                    <BButton
                      size="sm"
                      :variant="showAllIngredients ? 'primary' : 'outline-secondary'"
                      @click="showAllIngredients = true"
                    >Alle Zutaten</BButton>
                    <BButton
                      v-if="activeSection"
                      size="sm"
                      :variant="!showAllIngredients ? 'primary' : 'outline-secondary'"
                      @click="showAllIngredients = false"
                    >Nur aktuell</BButton>
                  </div>
                </div>
                <div class="card-body">
                  <IngredientsSection
                    :sections="visibleDesktopSections"
                    :active-section="activeSection"
                    :ingredients="current_recipe.ingredients"
                    :yields-value="yields_value"
                    :inline-editable="false"
                    :dirty-items="emptySet"
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
                  v-if="imageSrc"
                  class="card-img-top rounded-0"
                  :src="imageSrc"
                  alt="Rezeptbild"
                />
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
                  :recipe="current_recipe"
                  :yields-value="yields_value"
                  :yields-unit="yields_unit"
                  @close="showMetadata = false"
                />
                <div class="card-body" id="recipe_title">
                  <h2 class="card-title">{{ current_recipe.recipe_name }}</h2>
                  <p v-if="current_recipe.subtitle" class="card-text">{{ current_recipe.subtitle }}</p>
                  <div v-if="current_recipe.tags && current_recipe.tags.length" class="mt-2">
                    <span v-for="(tag, idx) in current_recipe.tags" :key="idx" class="badge bg-light text-dark me-1">{{ tag }}</span>
                  </div>
                </div>
              </div>
              <div class="card-body">
                <h3>Zubereitung</h3>
                <StepSection
                  :sections="current_recipe.sections"
                  :steps="current_recipe.steps"
                  :edit-mode="false"
                  :inline-editable="false"
                  :dirty-items="emptySet"
                  key-prefix="desktop-"
                  @select-step="selectStep"
                />
              </div>
            </div>
          </main>
        </div>
      </div>

      <!-- Mobile Layout -->
      <div v-else class="recipe-container mobile-view">
        <div class="recipe-content">
          <div class="card rounded-0">
            <div id="recipe_title_container" class="recipe-image-container">
              <img
                v-if="imageSrc"
                class="card-img-top rounded-0"
                :src="imageSrc"
                alt="Rezeptbild"
              />
              <div
                class="metadata-toggle-icon"
                @click.prevent.stop="showMetadata = !showMetadata"
              >
                <i class="bi bi-info-circle" title="Metadaten anzeigen"></i>
              </div>
              <div class="card-body" id="recipe_title">
                <h2 class="card-title">{{ current_recipe.recipe_name }}</h2>
                <p v-if="current_recipe.subtitle" class="card-text">{{ current_recipe.subtitle }}</p>
                <div v-if="current_recipe.tags && current_recipe.tags.length" class="mt-2">
                  <span v-for="(tag, idx) in current_recipe.tags" :key="idx" class="badge bg-light text-dark me-1">{{ tag }}</span>
                </div>
              </div>
            </div>
            <div class="card-body">
              <h3>Zubereitung</h3>
              <StepSection
                :sections="current_recipe.sections"
                :steps="current_recipe.steps"
                :edit-mode="false"
                :inline-editable="false"
                :dirty-items="emptySet"
                key-prefix="mobile-"
                @select-step="selectStep"
              />
            </div>
          </div>
        </div>

        <!-- Mobile Bottom Bar -->
        <MobileIngredientsBar
          :is-expanded="ingredientsExpanded"
          :yields-value="yields_value"
          :yields-unit="yields_unit"
          :show-only-current-section="showOnlyCurrentSection"
          :visible-sections="visibleIngredientSections"
          :sections="current_recipe.sections"
          :active-section="activeSection"
          :ingredients="current_recipe.ingredients"
          :inline-editable="false"
          :dirty-items="emptySet"
          @open="ingredientsExpanded = true"
          @close="ingredientsExpanded = false"
          @update:yields="setYieldsValue"
          @update:show-only-current-section="showOnlyCurrentSection = $event"
          @scroll-to-section="scrollToIngredientSection"
        />
      </div>

      <!-- Mobile: Metadaten Bottom Sheet -->
      <MetadataOverlay
        :show="isMobile && showMetadata"
        :is-mobile="true"
        :recipe="current_recipe"
        :yields-value="yields_value"
        :yields-unit="yields_unit"
        @close="showMetadata = false"
      />
    </template>

    <!-- Footer -->
    <div v-if="!loading && !error && current_recipe" class="container">
      <hr />
      <p class="text-muted small pb-3">
        Geteilt von <strong>{{ sharedBy }}</strong> am {{ sharedAt }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useViewport } from '@/composables/useViewport'
import MetadataOverlay from '@/components/recipe/display/MetadataOverlay.vue'
import PortionControl from '@/components/recipe/display/PortionControl.vue'
import IngredientsSection from '@/components/recipe/display/IngredientsSection.vue'
import MobileIngredientsBar from '@/components/recipe/display/MobileIngredientsBar.vue'
import StepSection from '@/components/recipe/display/StepSection.vue'
import type { Recipe } from '@/types/recipe'

const props = defineProps<{ token: string }>()

const { isMobile, isDesktopOrTablet } = useViewport()

const loading = ref(true)
const error = ref<string | null>(null)
const current_recipe = ref<Recipe | null>(null)
const sharedBy = ref('')
const sharedAt = ref('')
const imageSrc = ref<string | null>(null)

// UI state
const showMetadata = ref(false)
const showAllIngredients = ref(true)
const showOnlyCurrentSection = ref(true)
const ingredientsExpanded = ref(false)
const activeSection = ref<string | null>(null)
const emptySet = ref(new Set())

// Yields
const yields_unit = computed(() => {
  if (current_recipe.value?.yields?.length) {
    return current_recipe.value.yields[0].unit
  }
  return 'Units'
})

const yields_value = computed(() => {
  if (current_recipe.value?.yields?.length) {
    return current_recipe.value.yields[0].value
  }
  return 1
})

function setYieldsValue(val: number) {
  if (!current_recipe.value?.yields?.length || val <= 0) return
  const oldVal = current_recipe.value.yields[0].value
  current_recipe.value.yields[0].value = val
  calcNewAmounts(oldVal, val)
}

function calcNewAmounts(oldYield: number, newYield: number) {
  if (!current_recipe.value) return
  const exp = current_recipe.value.recalc_exp || 1
  current_recipe.value.ingredients.forEach(ingredient => {
    if (
      ingredient.amounts?.[0] &&
      typeof ingredient.amounts[0].amount === 'number'
    ) {
      ingredient.amounts[0].amount =
        (ingredient.amounts[0].amount * Math.pow(newYield, exp)) / Math.pow(oldYield, exp)
    }
  })
}

// Desktop sections filter
const visibleDesktopSections = computed(() => {
  if (!current_recipe.value) return []
  if (!showAllIngredients.value && activeSection.value) {
    return current_recipe.value.sections.filter(s => s.section === activeSection.value)
  }
  return current_recipe.value.sections
})

// Mobile sections filter
const visibleIngredientSections = computed(() => {
  if (!current_recipe.value) return []
  if (showOnlyCurrentSection.value && activeSection.value) {
    return current_recipe.value.sections.filter(s => s.section === activeSection.value)
  }
  return current_recipe.value.sections
})

function selectStep(ev: MouseEvent) {
  const target = ev.target as HTMLElement
  const doHighlight = !target.classList.contains('list-group-item-primary')
  document.querySelectorAll('#steps .list-group-item').forEach(el => {
    el.classList.remove('list-group-item-primary')
  })
  target.classList.toggle('list-group-item-primary', doHighlight)

  document.querySelectorAll('#ingredients .ingredients-section').forEach(el => {
    el.classList.remove('highlighted', 'list-group-item-primary', 'border-primary')
  })
  const section = target.dataset.section
  const box = document.querySelector('#box-ing-' + section)
  if (box) {
    box.classList.toggle('highlighted', doHighlight)
    box.classList.toggle('list-group-item-primary', doHighlight)
    box.classList.toggle('border-primary', doHighlight)
  }
}

function scrollToIngredientSection(sectionName: string) {
  const el = document.querySelector(`.ingredient-section[data-section="${sectionName}"]`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

onMounted(async () => {
  try {
    const response = await fetch(`/api/v1/shared/${encodeURIComponent(props.token)}`)
    if (!response.ok) {
      if (response.status === 404) {
        error.value = 'Dieser Link ist ungültig oder abgelaufen.'
      } else if (response.status === 410) {
        error.value = 'Dieser Share-Link ist abgelaufen.'
      } else {
        error.value = 'Fehler beim Laden des Rezepts.'
      }
      return
    }
    const json = await response.json()

    // Transform API response into Recipe shape
    const data = json.data || {}
    current_recipe.value = {
      recipe_uuid: '',
      recipe_name: json.recipe_name,
      subtitle: data.subtitle,
      author: data.author,
      source_url: data.source_url,
      source_book: data.source_book,
      prep_time: data.prep_time,
      cook_time: data.cook_time,
      bake_time: data.bake_time,
      total_time: data.total_time,
      servings: data.servings,
      difficulty: data.difficulty,
      notes: data.notes,
      yields: data.yields || [],
      ingredients: data.ingredients || [],
      steps: data.steps || [],
      sections: data.sections || [{ section: '' }],
      recalc_exp: data.recalc_exp,
      tags: json.tags || [],
      imageurl: null,
      lastUpdated: json.shared_at,
      first_image_id: json.first_image_id,
    }

    if (json.first_image_id) {
      imageSrc.value = `/api/v1/images/${json.first_image_id}`
    }

    sharedBy.value = json.shared_by
    sharedAt.value = formatDate(json.shared_at)

    // Setup section observer after DOM render
    nextTick(() => observeStepSections())
  } catch {
    error.value = 'Netzwerkfehler — bitte versuche es später erneut.'
  } finally {
    loading.value = false
  }
})

// Intersection Observer for active section tracking
let observer: IntersectionObserver | null = null
let sectionTimeout: ReturnType<typeof setTimeout> | null = null

function observeStepSections() {
  if (observer) observer.disconnect()
  const els = document.querySelectorAll('[data-step-section]')
  if (!els.length) {
    setTimeout(observeStepSections, 100)
    return
  }
  observer = new IntersectionObserver(() => {
    if (sectionTimeout) clearTimeout(sectionTimeout)
    sectionTimeout = setTimeout(() => {
      const all = document.querySelectorAll('[data-step-section]')
      let maxVis = 0
      let best: string | null = null
      all.forEach(el => {
        const rect = el.getBoundingClientRect()
        const h = window.innerHeight
        const top = Math.max(0, rect.top)
        const bot = Math.min(h, rect.bottom)
        const vis = Math.max(0, bot - top)
        if (vis > maxVis) { maxVis = vis; best = (el as HTMLElement).dataset.stepSection || null }
      })
      if (best) activeSection.value = best
    }, 100)
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] })
  els.forEach(el => observer!.observe(el))
}
</script>

<style scoped>
@import '@/assets/recipe-layout.css';
</style>
