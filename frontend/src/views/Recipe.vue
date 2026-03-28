<template>
  <div id="recipe" :class="{ 'inline-edit-active': inlineEditMode }">
    <AppNavbar
      @update:selected="navSelected"
      :recipes_list="recipes_list"
      :selected="id"
      :read_only="settings.read_only"
    />

    <!-- Pending user hint -->
    <BContainer v-if="settings.role === 'pending'" class="mt-5">
      <div class="alert alert-info text-center">
        <i class="bi bi-hourglass-split"></i>
        Dein Account wartet auf Freigabe durch einen Admin.
      </div>
    </BContainer>

    <!-- Loading state -->
    <div v-else-if="!current_recipe" class="text-center mt-5">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">Laden...</span>
      </div>
    </div>

    <template v-else>
    <!-- Inline-Edit Action Bar -->
    <InlineEditActionBar
      :show="inlineEditMode"
      :changed-items-count="dirtyItems.size"
      @save="saveInlineChanges"
      @cancel="cancelInlineEdit"
    />

    <!-- Desktop/Tablet: Split-View Layout + Mobile: Bottom Bar Layout -->
    <RecipeDisplay
      ref="recipeDisplay"
      :recipe="current_recipe"
      :image-src="picture_src"
      :edit-mode="editMode"
      :inline-editable="inlineEditMode"
      :dirty-items="dirtyItems"
      @ingredient-changed="handleIngredientChanged"
      @ingredient-unchanged="handleIngredientUnchanged"
      @step-changed="handleStepChanged"
      @step-unchanged="handleStepUnchanged"
    >
      <template #image-overlays>
        <div
          v-if="!settings.read_only"
          class="favorite-star"
          @click.prevent.stop="toggleFavorite"
        >
          <i
            class="bi"
            :class="
              isFavorite
                ? 'bi-star-fill text-warning'
                : 'bi-star text-white'
            "
            :title="
              isFavorite
                ? 'Aus Favoriten entfernen'
                : 'Zu Favoriten hinzufügen'
            "
          ></i>
        </div>
      </template>
      <template v-if="editMode" #title>
        <BFormInput
          v-model="current_recipe.recipe_name"
          size="lg"
          class="fw-bold"
        />
      </template>
      <template v-if="editMode" #subtitle>
        <BFormInput
          v-model="current_recipe.subtitle"
          placeholder="Untertitel"
        />
      </template>
      <template #after-content>
        <!-- Floating Action Button (FAB) mit Menü -->
        <RecipeFabMenu
          :edit-mode="editMode"
          :read-only="settings.read_only"
          :expert-mode="settings.expert_mode"
          :menu-open="fabMenuOpen"
          @toggle-menu="fabMenuOpen = !fabMenuOpen"
          @inline-edit="toggleEditMode"
          @edit="goToEdit"
          @copy="copyRecipe"
          @delete="deleteRecipe"
          @share="shareRecipe"
          @export="exportRecipe"
        />

        <!-- Share Manager Overlay -->
        <ShareManager
          :show="showShareManager"
          :recipe-id="current_recipe?.recipe_uuid"
          @close="showShareManager = false"
        />
      </template>
    </RecipeDisplay>

    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useRecipeHelper } from '@/composables/useRecipeHelper'
import { useRecipeStore } from '@/store/recipeStore'
import { useUIStore } from '@/store/uiStore'
import AppNavbar from '@/components/layout/AppNavbar.vue'
import RecipeDisplay from '@/components/recipe/display/RecipeDisplay.vue'
import RecipeFabMenu from '@/components/recipe/ui/RecipeFabMenu.vue'
import InlineEditActionBar from '@/components/recipe/ui/InlineEditActionBar.vue'
import ShareManager from '@/components/recipe/ui/ShareManager.vue'
import jsyaml from 'js-yaml'
import { useToast } from 'bootstrap-vue-next'
import UUID from '@/js/uuid'
import { deepCopyYaml } from '@/js/deepCopy'
import { recipeUrl, editUrl } from '@/js/slug'

const props = defineProps<{ id: string }>()

const router = useRouter()
const store = useRecipeStore()
const uiStore = useUIStore()
const bvnToast = useToast()

const idRef = computed(() => props.id)
const {
  current_recipe,
  selected,
  recipes_list,
  picture_src,
} = useRecipeHelper({ recipeId: idRef })

// FAB Menu State
const fabMenuOpen = ref(false)

// Inline Edit Mode State
const inlineEditMode = ref(false)
const dirtyItems = ref(new Set<string>())

// Data
const editMode = ref(false)
const originalRecipe = ref<ReturnType<typeof deepCopyYaml> | null>(null)
const showShareManager = ref(false)
const recipeDisplay = ref<InstanceType<typeof RecipeDisplay> | null>(null)

// Computed
const settings = computed(() => store.settings)
const recipes = computed(() => store.recipes)

const isFavorite = computed(() => {
  if (!current_recipe.value?.recipe_uuid) return false
  return store.favorites.includes(current_recipe.value.recipe_uuid)
})

// Watch
watch(() => props.id, () => {
  window.scrollTo(0, 0)
})

// Lifecycle
onMounted(() => {
  uiStore.restoreUIState()
})

// Methods
function showToast(content: string, variant = 'info') {
  bvnToast?.show?.({
    props: {
      body: content,
      variant,
      pos: 'bottom-left',
    },
  })
}

function navSelected(uuid: string) {
  const recipe = store.recipes.find(r => r.recipe_uuid === uuid)
  router.push(recipeUrl(uuid, recipe?.recipe_name))
}

function exportRecipe() {
  if (!current_recipe.value) return
  const yaml = jsyaml.dump(current_recipe.value)
  const blob = new Blob([yaml], { type: 'text/yaml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${current_recipe.value.recipe_name || 'recipe'}.yaml`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function prevRecipe() {
  if (selected.value > 0) {
    const prev = store.recipes[selected.value - 1]
    router.push(recipeUrl(prev.recipe_uuid, prev.recipe_name))
  }
}

function nextRecipe() {
  if (selected.value < store.recipes.length - 1) {
    const next = store.recipes[selected.value + 1]
    router.push(recipeUrl(next.recipe_uuid, next.recipe_name))
  }
}

function copyRecipe() {
  if (!current_recipe.value) {
    showToast('Rezept konnte nicht dupliziert werden', 'danger')
    return
  }
  try {
    const recipe = deepCopyYaml(current_recipe.value)
    recipe.recipe_uuid = UUID.generateUUID()
    store.appendRecipe(recipe)
    nextTick(() => {
      router.push(recipeUrl(recipe.recipe_uuid, recipe.recipe_name))
    })
  } catch (error) {
    console.error('Error copying recipe:', error)
    showToast('Fehler beim Duplizieren des Rezepts', 'danger')
  }
}

function deleteRecipe() {
  if (!current_recipe.value) {
    showToast('Rezept konnte nicht gelöscht werden', 'danger')
    return
  }
  if (confirm(`Rezept "${current_recipe.value.recipe_name}" wirklich löschen?`)) {
    try {
      store.deleteRecipe(current_recipe.value.recipe_uuid)
      router.push('/')
    } catch (error) {
      console.error('Error deleting recipe:', error)
      showToast('Fehler beim Löschen des Rezepts', 'danger')
    }
  }
}

function shareRecipe() {
  if (!current_recipe.value) return
  showShareManager.value = true
}

function toggleFavorite() {
  if (!current_recipe.value?.recipe_uuid) return
  if (isFavorite.value) {
    store.removeFavorite(current_recipe.value.recipe_uuid)
  } else {
    store.addFavorite(current_recipe.value.recipe_uuid)
  }
}

function goToEdit() {
  if (!current_recipe.value) return
  router.push(editUrl(current_recipe.value.recipe_uuid, current_recipe.value.recipe_name))
}

function toggleEditMode() {
  if (!current_recipe.value) {
    showToast('Rezept konnte nicht bearbeitet werden', 'danger')
    return
  }
  inlineEditMode.value = !inlineEditMode.value
  if (inlineEditMode.value) {
    originalRecipe.value = deepCopyYaml(current_recipe.value)
    dirtyItems.value.clear()
  } else {
    if (dirtyItems.value.size === 0) {
      originalRecipe.value = null
    }
  }
}

async function saveRecipe() {
  if (!current_recipe.value) {
    showToast('Rezept konnte nicht gespeichert werden', 'danger')
    return
  }
  try {
    await store.setRecipe({
      index: selected.value,
      recipe: current_recipe.value,
    })
    editMode.value = false
    originalRecipe.value = null
    showToast('Rezept gespeichert', 'success')
  } catch (error) {
    console.error('Error saving recipe:', error)
    showToast('Fehler beim Speichern des Rezepts', 'danger')
  }
}

function handleIngredientChanged(ingredientKey: string) {
  dirtyItems.value.add(ingredientKey)
}

function handleIngredientUnchanged(ingredientKey: string) {
  dirtyItems.value.delete(ingredientKey)
}

function handleStepChanged(stepIndex: number) {
  dirtyItems.value.add(`step:${stepIndex}`)
}

function handleStepUnchanged(stepIndex: number) {
  dirtyItems.value.delete(`step:${stepIndex}`)
}

async function saveInlineChanges() {
  if (!current_recipe.value) {
    showToast('Rezept konnte nicht gespeichert werden', 'danger')
    return
  }
  try {
    await store.setRecipe({
      index: selected.value,
      recipe: current_recipe.value,
    })
    inlineEditMode.value = false
    originalRecipe.value = null
    dirtyItems.value.clear()
    showToast('Änderungen gespeichert', 'success')
  } catch (error) {
    console.error('Error saving inline changes:', error)
    showToast('Fehler beim Speichern der Änderungen', 'danger')
  }
}

function cancelInlineEdit() {
  if (originalRecipe.value) {
    current_recipe.value = deepCopyYaml(originalRecipe.value)
  }
  inlineEditMode.value = false
  originalRecipe.value = null
  dirtyItems.value.clear()
  showToast('Änderungen verworfen', 'info')
}

function cancelEdit() {
  if (originalRecipe.value) {
    current_recipe.value = deepCopyYaml(originalRecipe.value)
  }
  editMode.value = false
  originalRecipe.value = null
}
</script>

<style scoped>
/* ============================================
   INLINE EDIT MODE ADJUSTMENTS
   ============================================ */
#recipe {
  padding-top: 0;
  transition: padding-top 0.3s ease;
}

#recipe.inline-edit-active {
  padding-top: 60px;
}

@media (max-width: 767px) {
  #recipe.inline-edit-active {
    padding-top: 80px;
  }
}
</style>
