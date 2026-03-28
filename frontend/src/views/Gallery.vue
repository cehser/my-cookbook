<template>
  <div id="recipe">
    <AppNavbar
      @update:selected="navSelected"
      :recipes_list="recipes_list"
      selected=""
      :read_only="settings.read_only"
    >
      <BButton v-if="updateExists" @click="refreshApp">
        New version available! Click to update
      </BButton>
    </AppNavbar>
    <BContainer fluid>
      <!-- AI Import Modal -->
      <BModal
        v-model="showAIImport"
        title="AI-Rezept-Import"
        size="xl"
        hide-footer
      >
        <AIRecipeImport v-if="!settings.read_only" @imported="onAIImport" />
      </BModal>

      <!-- Pending User Alert -->
      <div v-if="settings.role === 'pending'" class="alert alert-info mt-4 text-center">
        <i class="bi bi-hourglass-split fs-1 d-block mb-2"></i>
        <h5>Dein Account wartet auf Freigabe</h5>
        <p class="mb-0">Ein Administrator muss deinen Zugang erst freischalten, bevor du Rezepte sehen kannst.</p>
      </div>

      <template v-if="settings.role !== 'pending'">
      <div class="d-flex justify-content-between align-items-center mt-2 mb-3">
        <h2 class="mb-0">Galerie</h2>
        <div class="d-flex gap-2 align-items-center">
          <span class="text-muted">
            {{ filteredRecipes.length }} / {{ recipes.length }} Rezept(e)
          </span>
          <!-- Sortierung -->
          <BFormSelect v-model="sortBy" size="sm" style="width: auto">
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="date-new">Neueste zuerst</option>
            <option value="date-old">Älteste zuerst</option>
            <option value="favorites">Favoriten zuerst</option>
          </BFormSelect>
          <!-- Admin Actions Dropdown -->
          <BDropdown
            v-if="!settings.read_only"
            variant="primary"
            size="sm"
            text="Aktionen"
          >
            <BDropdownItem @click="showAIImport = true">
              <i class="bi bi-robot"></i> AI-Import
            </BDropdownItem>
            <BDropdownDivider />
            <BDropdownItem @click="newRecipe">
              <i class="bi bi-file-earmark-plus"></i> Neues Rezept
            </BDropdownItem>
            <BDropdownItem @click="loadSample">
              <i class="bi bi-file-earmark-text"></i> Beispielrezept
            </BDropdownItem>
            <BDropdownItem v-if="settings.expert_mode" @click="triggerImport">
              <i class="bi bi-upload"></i> YAML Import
            </BDropdownItem>
          </BDropdown>
        </div>
      </div>

      <!-- Hidden file input for YAML import -->
      <input
        ref="fileInput"
        type="file"
        accept=".yaml,.yml"
        @change="importRecipe"
        style="display: none"
      />

      <!-- Search & Filter Section -->
      <div class="search-filter-section mb-3">
        <!-- Compact Single Row with Search and Filters -->
        <div class="d-flex flex-wrap gap-2 align-items-center">
          <!-- Title Search -->
          <BInputGroup style="flex: 1; min-width: 250px">
            <template #prepend>
              <BInputGroupText>
                <i class="bi bi-search"></i>
              </BInputGroupText>
            </template>
            <BFormInput
              v-model="filter"
              type="text"
              placeholder="Rezepte durchsuchen..."
              size="sm"
            ></BFormInput>
            <template #append>
              <BButton @click="filter = ''" :disabled="!filter" size="sm">
                <i class="bi bi-x"></i>
              </BButton>
            </template>
          </BInputGroup>

          <!-- Author Filter -->
          <BFormSelect
            v-model="selectedAuthor"
            size="sm"
            style="max-width: 150px"
          >
            <option :value="null">Alle Autoren</option>
            <option v-for="author in allAuthors" :key="author" :value="author">
              {{ author }}
            </option>
          </BFormSelect>

          <!-- Difficulty Filter -->
          <BFormSelect
            v-model="selectedDifficulty"
            size="sm"
            style="max-width: 140px"
          >
            <option :value="null">Schwierigkeit</option>
            <option value="easy">Einfach</option>
            <option value="medium">Mittel</option>
            <option value="hard">Schwer</option>
          </BFormSelect>

          <!-- Clear All Button -->
          <BButton
            v-if="hasActiveFilters"
            @click="clearAllFilters"
            size="sm"
            variant="outline-secondary"
            title="Alle Filter zurücksetzen"
          >
            <i class="bi bi-x-circle"></i>
          </BButton>
        </div>

        <!-- Tags Section (Compact) -->
        <div v-if="allTags.length || selectedTags.length" class="mt-2">
          <div class="d-flex flex-wrap gap-1 align-items-center">
            <small class="text-muted me-1">
              <i class="bi bi-tags"></i>
            </small>
            <span
              v-for="tag in allTags"
              :key="tag"
              @click="toggleTag(tag)"
              class="badge tag-badge-compact"
              :class="
                selectedTags.includes(tag)
                  ? 'bg-primary text-white'
                  : 'bg-light text-dark border'
              "
              style="cursor: pointer"
            >
              {{ tag }}
            </span>
            <!-- Show selected tags that don't exist anymore -->
            <span
              v-for="tag in orphanedTags"
              :key="'orphan-' + tag"
              @click="toggleTag(tag)"
              class="badge bg-danger badge-compact"
              style="cursor: pointer"
              :title="'Tag existiert nicht mehr'"
            >
              {{ tag }} <i class="bi bi-exclamation-triangle-fill"></i>
            </span>
          </div>
        </div>
      </div>
      <div
        class="row row-cols-1 row-cols-sm-2 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 mt-2"
      >
        <div
          v-for="(recipe, index) in filteredRecipes"
          :key="recipe.recipe_uuid || index"
          class="col mb-4"
        >
          <RecipeCard
            class="cardAspect"
            :recipe="recipe"
            :picture_src="picture_src(recipe)"
            :index="recipe.originalIndex"
            :highlight="filter"
            :read_only="settings.read_only"
            @delete="handleDeleteRecipe(recipe.recipe_uuid)"
          />
        </div>
      </div>
      </template>
    </BContainer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useRecipeHelper } from '@/composables/useRecipeHelper'
import { useToast } from '@/composables/useToast'
import { useRecipeStore } from '@/store/recipeStore'
import { useUIStore } from '@/store/uiStore'
import AppNavbar from '@/components/layout/AppNavbar.vue'
import RecipeCard from '@/components/recipe/ui/RecipeCard.vue'
import AIRecipeImport from '@/components/features/AIRecipeImport.vue'
import Recipes from '@/js/recipes'
import jsyaml from 'js-yaml'
import { recipeUrl } from '@/js/slug'

const router = useRouter()
const store = useRecipeStore()
const uiStore = useUIStore()
const { toast } = useToast()

const recipeId = ref('')
const { recipes_list, recipeThumbnailSrc } = useRecipeHelper({ recipeId })
const picture_src = recipeThumbnailSrc

// Data
const refreshing = ref(false)
const registration = ref<{ waiting?: { postMessage: (msg: string) => void } } | null>(null)
const updateExists = ref(false)
const filter = ref('')
const selectedTags = ref<string[]>([])
const selectedAuthor = ref<string | null>(null)
const selectedDifficulty = ref<string | null>(null)
const sortBy = ref('name-asc')
const showAIImport = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

// Computed
const settings = computed(() => store.settings)
const recipes = computed(() => store.recipes)

const allTags = computed(() => {
  const tags = new Set<string>()
  store.recipes.forEach((recipe) => {
    if (recipe.tags) {
      recipe.tags.forEach((tag: string) => tags.add(tag))
    }
  })
  return Array.from(tags).sort()
})

const allAuthors = computed(() => {
  const authors = new Set<string>()
  store.recipes.forEach((recipe) => {
    if (recipe.author) {
      authors.add(recipe.author)
    }
  })
  return Array.from(authors).sort()
})

const hasActiveFilters = computed(() => {
  return (
    filter.value ||
    selectedTags.value.length > 0 ||
    selectedAuthor.value ||
    selectedDifficulty.value
  )
})

const orphanedTags = computed(() => {
  return selectedTags.value.filter((tag) => !allTags.value.includes(tag))
})

const filteredRecipes = computed(() => {
  const recipesWithIndex = store.recipes.map((recipe, index) => ({
    ...recipe,
    originalIndex: index,
  }))

  const filtered = recipesWithIndex.filter((recipe) => {
    const matchesText =
      !filter.value ||
      recipe.recipe_name.toLowerCase().includes(filter.value.toLowerCase())

    const matchesTags =
      selectedTags.value.length === 0 ||
      (recipe.tags &&
        selectedTags.value.some((tag) => recipe.tags.includes(tag)))

    const matchesAuthor =
      !selectedAuthor.value || recipe.author === selectedAuthor.value

    const matchesDifficulty =
      !selectedDifficulty.value ||
      recipe.difficulty === selectedDifficulty.value

    return matchesText && matchesTags && matchesAuthor && matchesDifficulty
  })

  const sorted = [...filtered]
  const favorites = store.favorites

  sorted.sort((a, b) => {
    switch (sortBy.value) {
      case 'name-asc':
        return a.recipe_name.localeCompare(b.recipe_name)
      case 'name-desc':
        return b.recipe_name.localeCompare(a.recipe_name)
      case 'date-new':
        return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
      case 'date-old':
        return new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime()
      case 'favorites': {
        const aIsFav = favorites.includes(a.recipe_uuid)
        const bIsFav = favorites.includes(b.recipe_uuid)
        if (aIsFav && !bIsFav) return -1
        if (!aIsFav && bIsFav) return 1
        return a.recipe_name.localeCompare(b.recipe_name)
      }
      default:
        return 0
    }
  })

  return sorted
})

// Service Worker
document.addEventListener('swUpdated', showRefreshUI as EventListener, { once: true })
if (navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing.value) return
    refreshing.value = true
    window.location.reload()
  })
}

// Watchers
watch(filter, (newFilter) => {
  uiStore.setGalleryFilter(newFilter)
})

watch(selectedTags, (newTags) => {
  uiStore.setGallerySelectedTags(newTags)
}, { deep: true })

watch(sortBy, (newSortBy) => {
  uiStore.setGallerySortBy(newSortBy)
})

// Lifecycle
onMounted(() => {
  try {
    uiStore.restoreUIState()
    filter.value = uiStore.galleryFilter || ''
    selectedTags.value = uiStore.gallerySelectedTags
      ? [...uiStore.gallerySelectedTags]
      : []
    sortBy.value = uiStore.gallerySortBy || 'name-asc'

    nextTick(() => {
      const scrollPos = uiStore.galleryScrollPosition || 0
      if (scrollPos > 0) {
        window.scrollTo(0, scrollPos)
      }
    })
  } catch (e) {
    console.error('Failed to restore UI state:', e)
  }
})

onBeforeUnmount(() => {
  uiStore.setGalleryScrollPosition(window.scrollY)
})

// Methods
function navSelected(uuid: string) {
  const recipe = store.recipes.find(r => r.recipe_uuid === uuid)
  router.push(recipeUrl(uuid, recipe?.recipe_name))
}

function toggleTag(tag: string) {
  const index = selectedTags.value.indexOf(tag)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tag)
  }
}

function clearAllFilters() {
  filter.value = ''
  selectedTags.value = []
  selectedAuthor.value = null
  selectedDifficulty.value = null
}

function showRefreshUI(e: Event) {
  registration.value = (e as CustomEvent).detail
  updateExists.value = true
}

function refreshApp() {
  updateExists.value = false
  if (!registration.value?.waiting) return
  registration.value.waiting.postMessage('skipWaiting')
}

function handleDeleteRecipe(uuid: string) {
  store.deleteRecipe(uuid)
}

function newRecipe() {
  store.appendRecipe(Recipes.loadNewRecipe())
  toast('Neues Rezept erstellt.', 'success')
}

function loadSample() {
  store.appendRecipe(Recipes.loadSample())
  toast('Beispielrezept geladen.', 'success')
}

function onAIImport(recipe: { recipe_name: string }) {
  toast(`Rezept "${recipe.recipe_name}" importiert.`, 'success')
  showAIImport.value = false
}

function triggerImport() {
  fileInput.value?.click()
}

function importRecipe(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const recipe = jsyaml.load(e.target?.result as string) as { recipe_name: string }
      store.appendRecipe(recipe)
      toast(`Rezept "${recipe.recipe_name}" importiert.`, 'success')
      input.value = ''
    } catch (error) {
      toast('Fehler beim Importieren: ' + (error as Error).message, 'danger')
    }
  }
  reader.readAsText(file)
}
</script>

<style lang="scss">
@use "sass:math";
@use "sass:list";
@use "sass:string";

.search-filter-section {
  background-color: #f8f9fa;
  padding: 0.75rem;
  border-radius: 0.375rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.tag-badge-compact {
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem;
  transition: all 0.15s ease;
  font-weight: 400;
}

.tag-badge-compact:hover {
  transform: translateY(-1px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.badge {
  transition: all 0.2s ease;
}

.badge:hover {
  transform: scale(1.05);
}

@mixin fluid-aspect($ratio: 1 1, $selector: "> :first-child") {
  $selector: string.unquote($selector);

  padding-bottom: math.percentage(
    math.div(list.nth($ratio, 2), list.nth($ratio, 1))
  );
  position: relative;

  #{$selector} {
    left: 0;
    height: 100%;
    position: absolute !important;
    top: 0;
    width: 100%;
  }
}

.cardAspect {
  @include fluid-aspect(3 2);
}
</style>

<style scoped>
input {
  outline: none !important;
  box-shadow: none !important;
}

/* Mobile optimizations */
@media (max-width: 768px) {
  h2 {
    font-size: 1.5rem;
  }

  /* Stack filter and tags vertically on mobile */
  .d-flex.flex-wrap.gap-2 {
    flex-direction: column;
    gap: 1rem !important;
  }

  /* Full width filter on mobile */
  .input-group {
    max-width: 100% !important;
  }

  /* Larger touch targets for tags */
  .badge {
    padding: 0.5rem 0.75rem;
    font-size: 0.9rem;
    margin: 0.25rem;
  }

  /* Single column on small mobile */
  @media (max-width: 576px) {
    .row {
      --bs-gutter-x: 0.5rem;
    }

    .col {
      padding: 0.25rem;
    }
  }
}
</style>
