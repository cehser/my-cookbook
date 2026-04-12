<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useRecipeHelper } from "@/composables/useRecipeHelper";
import { useRecentRecipes } from "@/composables/useRecentRecipes";
import { useRecipeStore } from "@/store/recipeStore";
import { useUIStore } from "@/store/uiStore";
import RecipeDisplay from "@/components/recipe/display/RecipeDisplay.vue";
import ShareManager from "@/components/recipe/ui/ShareManager.vue";
import jsyaml from "js-yaml";
import { useToast } from "@/composables/useToast";
import { generateUUID } from "@/js/uuid";
import { deepCopyYaml } from "@/js/deepCopy";
import { recipeUrl, editUrl } from "@/js/slug";

const props = defineProps<{ id: string }>();

const router = useRouter();
const store = useRecipeStore();
const uiStore = useUIStore();
const { toast: showToast } = useToast();
const { trackRecipe } = useRecentRecipes();

const idRef = computed(() => props.id);
const { current_recipe, picture_src } = useRecipeHelper({
  recipeId: idRef,
});

// Header menu state
const headerMenuOpen = ref(false);
const showShareManager = ref(false);

// Computed
const settings = computed(() => store.settings);

const isFavorite = computed(() => {
  if (!current_recipe.value?.recipe_uuid) return false;
  return store.favorites.includes(current_recipe.value.recipe_uuid);
});

// Watch
watch(
  () => props.id,
  () => {
    window.scrollTo(0, 0);
  },
);

// Lifecycle
onMounted(() => {
  uiStore.restoreUIState();
  if (props.id) trackRecipe(props.id);
});

// Methods
function toggleFavorite() {
  if (!current_recipe.value?.recipe_uuid) return;
  if (isFavorite.value) {
    store.removeFavorite(current_recipe.value.recipe_uuid);
  } else {
    store.addFavorite(current_recipe.value.recipe_uuid);
  }
}

function goToEdit() {
  if (!current_recipe.value) return;
  headerMenuOpen.value = false;
  router.push(
    editUrl(current_recipe.value.recipe_uuid, current_recipe.value.recipe_name),
  );
}

function copyRecipe() {
  if (!current_recipe.value) {
    showToast("Rezept konnte nicht dupliziert werden", "danger");
    return;
  }
  try {
    headerMenuOpen.value = false;
    const recipe = deepCopyYaml(current_recipe.value);
    recipe.recipe_uuid = generateUUID();
    store.appendRecipe(recipe);
    router.push(recipeUrl(recipe.recipe_uuid, recipe.recipe_name));
  } catch (error) {
    console.error("Error copying recipe:", error);
    showToast("Fehler beim Duplizieren des Rezepts", "danger");
  }
}

function deleteRecipe() {
  if (!current_recipe.value) {
    showToast("Rezept konnte nicht gelöscht werden", "danger");
    return;
  }
  if (
    confirm(`Rezept "${current_recipe.value.recipe_name}" wirklich löschen?`)
  ) {
    try {
      headerMenuOpen.value = false;
      store.deleteRecipe(current_recipe.value.recipe_uuid);
      router.push("/");
    } catch (error) {
      console.error("Error deleting recipe:", error);
      showToast("Fehler beim Löschen des Rezepts", "danger");
    }
  }
}

function shareRecipe() {
  if (!current_recipe.value) return;
  headerMenuOpen.value = false;
  showShareManager.value = true;
}

function exportRecipe() {
  if (!current_recipe.value) return;
  headerMenuOpen.value = false;
  const yaml = jsyaml.dump(current_recipe.value);
  const blob = new Blob([yaml], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${current_recipe.value.recipe_name || "recipe"}.yaml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function goBack() {
  // If opened via direct link (no previous route), go to gallery
  if (!window.history.state?.back) {
    router.push("/");
  } else {
    router.back();
  }
}
</script>

<template>
  <div id="recipe">
    <div class="view-header">
      <button class="btn-icon" @click="goBack" title="Zurück">
        <i class="bi bi-arrow-left"></i>
      </button>
      <span class="view-header-title">{{
        current_recipe?.recipe_name || "Rezept"
      }}</span>
      <div
        v-if="current_recipe && !settings.read_only"
        class="view-header-actions"
      >
        <button
          class="btn-icon"
          @click="toggleFavorite"
          :title="
            isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'
          "
        >
          <i
            class="bi"
            :class="isFavorite ? 'bi-star-fill text-warning' : 'bi-star'"
          ></i>
        </button>
        <div class="header-menu-wrapper">
          <button
            class="btn-icon"
            @click="headerMenuOpen = !headerMenuOpen"
            title="Menü"
          >
            <i class="bi bi-three-dots-vertical"></i>
          </button>
          <transition name="header-menu">
            <div v-if="headerMenuOpen" class="header-dropdown" @click.stop>
              <button class="header-dropdown-item" @click="goToEdit">
                <i class="bi bi-pencil-square"></i> Bearbeiten
              </button>
              <button class="header-dropdown-item" @click="copyRecipe">
                <i class="bi bi-files"></i> Duplizieren
              </button>
              <button class="header-dropdown-item" @click="shareRecipe">
                <i class="bi bi-share"></i> Teilen
              </button>
              <button
                v-if="settings.expert_mode"
                class="header-dropdown-item"
                @click="exportRecipe"
              >
                <i class="bi bi-download"></i> YAML Export
              </button>
              <hr class="dropdown-divider" />
              <button
                class="header-dropdown-item text-danger"
                @click="deleteRecipe"
              >
                <i class="bi bi-trash"></i> Löschen
              </button>
            </div>
          </transition>
        </div>
      </div>
    </div>

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
      <RecipeDisplay :recipe="current_recipe" :image-src="picture_src">
        <template #after-content>
          <!-- Share Manager Overlay -->
          <ShareManager
            :show="showShareManager"
            :recipe-id="current_recipe?.recipe_uuid"
            @close="showShareManager = false"
          />
        </template>
      </RecipeDisplay>
    </template>

    <!-- Backdrop to close header menu -->
    <div
      v-if="headerMenuOpen"
      class="header-menu-backdrop"
      @click="headerMenuOpen = false"
    ></div>
  </div>
</template>

<style scoped>
#recipe {
  padding-top: 0;
}

/* Header menu */
.header-menu-wrapper {
  position: relative;
}

.header-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  min-width: 180px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--space-1) 0;
  z-index: var(--z-overlay);
}

.header-dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  background: none;
  font-size: var(--font-size-base);
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
}

.header-dropdown-item:hover {
  background: var(--color-divider);
}

.header-dropdown .dropdown-divider {
  margin: var(--space-1) 0;
}

.header-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1029;
}

/* Menu transition */
.header-menu-enter-active,
.header-menu-leave-active {
  transition: all var(--transition-fast);
}

.header-menu-enter-from,
.header-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
