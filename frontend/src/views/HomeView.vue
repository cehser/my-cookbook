<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  nextTick,
  watch,
} from "vue";
import { useRouter } from "vue-router";
import { useRecipeHelper } from "@/composables/useRecipeHelper";
import { useRecentRecipes } from "@/composables/useRecentRecipes";
import { useDraftIndex } from "@/composables/useDraftIndex";
import { useToast } from "@/composables/useToast";
import { useRecipeStore } from "@/store/recipeStore";
import { useUIStore } from "@/store/uiStore";
import RecipeCard from "@/components/recipe/ui/RecipeCard.vue";
import RecipeGrid from "@/components/recipe/ui/RecipeGrid.vue";
import AIRecipeImport from "@/components/features/AIRecipeImport.vue";
import {
  loadNewRecipe as createNewRecipe,
  loadSample as createSampleRecipe,
} from "@/js/recipes";
import jsyaml from "js-yaml";
import { editUrl } from "@/js/slug";

const router = useRouter();
const store = useRecipeStore();
const uiStore = useUIStore();
const { toast } = useToast();

const recipeId = ref("");
const { recipeThumbnailSrc } = useRecipeHelper({ recipeId });
const picture_src = recipeThumbnailSrc;

const { recentUuids } = useRecentRecipes();
const { hasDraft, refresh: refreshDrafts } = useDraftIndex();

const sortBy = ref("name-asc");
const showAIImport = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const fabOpen = ref(false);

function editUrlWithDraft(uuid: string, name: string) {
  return editUrl(uuid, name) + "?draft=1";
}

// Computed
const settings = computed(() => store.settings);
const recipes = computed(() => store.recipes);

const recentRecipes = computed(() => {
  return recentUuids.value
    .map((uuid) => store.recipes.find((r) => r.recipe_uuid === uuid))
    .filter(Boolean);
});

const draftRecipes = computed(() => {
  return store.recipes.filter((r) => hasDraft(r.recipe_uuid));
});

const sortedRecipes = computed(() => {
  const recipesWithIndex = store.recipes.map((recipe, index) => ({
    ...recipe,
    originalIndex: index,
  }));

  const sorted = [...recipesWithIndex];
  const favorites = store.favorites;

  sorted.sort((a, b) => {
    switch (sortBy.value) {
      case "name-asc":
        return a.recipe_name.localeCompare(b.recipe_name);
      case "name-desc":
        return b.recipe_name.localeCompare(a.recipe_name);
      case "date-new":
        return (
          new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
        );
      case "date-old":
        return (
          new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime()
        );
      case "favorites": {
        const aIsFav = favorites.includes(a.recipe_uuid);
        const bIsFav = favorites.includes(b.recipe_uuid);
        if (aIsFav && !bIsFav) return -1;
        if (!aIsFav && bIsFav) return 1;
        return a.recipe_name.localeCompare(b.recipe_name);
      }
      default:
        return 0;
    }
  });

  return sorted;
});

// Lifecycle
onMounted(() => {
  refreshDrafts();
  try {
    uiStore.restoreUIState();
    sortBy.value = uiStore.gallerySortBy || "name-asc";

    nextTick(() => {
      const scrollPos = uiStore.galleryScrollPosition || 0;
      if (scrollPos > 0) {
        window.scrollTo(0, scrollPos);
      }
    });
  } catch (e) {
    console.error("Failed to restore UI state:", e);
  }
});

onBeforeUnmount(() => {
  uiStore.setGalleryScrollPosition(window.scrollY);
});

// Persist sort selection
watch(sortBy, (val) => {
  uiStore.setGallerySortBy(val);
});

// Methods
function handleDeleteRecipe(uuid: string) {
  store.deleteRecipe(uuid);
}

function newRecipe() {
  const recipe = createNewRecipe();
  store.appendRecipe(recipe);
  toast("Neues Rezept erstellt.", "success");
  router.push(editUrl(recipe.recipe_uuid, recipe.recipe_name));
}

function loadSample() {
  store.appendRecipe(createSampleRecipe());
  toast("Beispielrezept geladen.", "success");
}

function onAIImport(recipe: { recipe_name: string }) {
  toast(`Rezept "${recipe.recipe_name}" importiert.`, "success");
  showAIImport.value = false;
}

function triggerImport() {
  fileInput.value?.click();
}

function importRecipe(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const recipe = jsyaml.load(e.target?.result as string) as {
        recipe_name: string;
      };
      store.appendRecipe(recipe);
      toast(`Rezept "${recipe.recipe_name}" importiert.`, "success");
      input.value = "";
    } catch (error) {
      toast("Fehler beim Importieren: " + (error as Error).message, "danger");
    }
  };
  reader.readAsText(file);
}
</script>

<template>
  <div id="home-view">
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
      <div
        v-if="settings.role === 'pending'"
        class="alert alert-info mt-4 text-center"
      >
        <i class="bi bi-hourglass-split fs-1 d-block mb-2"></i>
        <h5>Dein Account wartet auf Freigabe</h5>
        <p class="mb-0">
          Ein Administrator muss deinen Zugang erst freischalten, bevor du
          Rezepte sehen kannst.
        </p>
      </div>

      <template v-if="settings.role !== 'pending'">
        <!-- Recent Recipes -->
        <section v-if="recentRecipes.length" class="mt-3 mb-3">
          <h6 class="section-label">
            <i class="bi bi-clock-history"></i> Zuletzt geöffnet
          </h6>
          <div class="recent-scroll">
            <div
              v-for="recipe in recentRecipes"
              :key="'recent-' + recipe.recipe_uuid"
              class="recent-card"
            >
              <RecipeCard
                :recipe="recipe"
                :picture_src="picture_src(recipe)"
                :index="
                  store.recipes.findIndex(
                    (r) => r.recipe_uuid === recipe.recipe_uuid,
                  )
                "
                :read_only="settings.read_only"
                compact
                @delete="handleDeleteRecipe(recipe.recipe_uuid)"
              />
            </div>
          </div>
        </section>

        <!-- Drafts -->
        <section v-if="draftRecipes.length" class="mb-3">
          <h6 class="section-label">
            <i class="bi bi-pencil-square"></i>
            {{ draftRecipes.length }} Entwürf{{
              draftRecipes.length === 1 ? "" : "e"
            }}
          </h6>
          <div class="draft-scroll">
            <router-link
              v-for="recipe in draftRecipes"
              :key="'draft-' + recipe.recipe_uuid"
              :to="editUrlWithDraft(recipe.recipe_uuid, recipe.recipe_name)"
              class="draft-chip"
            >
              <i class="bi bi-pencil"></i>
              {{ recipe.recipe_name }}
            </router-link>
          </div>
        </section>

        <!-- All Recipes -->
        <section>
          <div
            class="d-flex justify-content-between align-items-center mb-2 mt-2"
          >
            <h6 class="section-label mb-0">
              Alle Rezepte
              <span class="text-muted fw-normal">({{ recipes.length }})</span>
            </h6>
            <BFormSelect v-model="sortBy" size="sm" style="width: auto">
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="date-new">Neueste zuerst</option>
              <option value="date-old">Älteste zuerst</option>
              <option value="favorites">Favoriten zuerst</option>
            </BFormSelect>
          </div>

          <RecipeGrid
            :recipes="sortedRecipes"
            :read-only="settings.read_only"
            @delete="handleDeleteRecipe"
          />
        </section>
      </template>

      <!-- Hidden file input for YAML import -->
      <input
        ref="fileInput"
        type="file"
        accept=".yaml,.yml"
        @change="importRecipe"
        style="display: none"
      />
    </BContainer>

    <!-- FAB -->
    <div v-if="!settings.read_only" class="fab-container" @click.stop>
      <transition name="fab-items">
        <div v-if="fabOpen" class="fab-menu">
          <button
            class="fab-menu-item"
            @click="
              newRecipe();
              fabOpen = false;
            "
          >
            <i class="bi bi-file-earmark-plus"></i> Neues Rezept
          </button>
          <button
            class="fab-menu-item"
            @click="
              showAIImport = true;
              fabOpen = false;
            "
          >
            <i class="bi bi-robot"></i> AI-Import
          </button>
          <button
            class="fab-menu-item"
            @click="
              loadSample();
              fabOpen = false;
            "
          >
            <i class="bi bi-file-earmark-text"></i> Beispiel
          </button>
          <button
            v-if="settings.expert_mode"
            class="fab-menu-item"
            @click="
              triggerImport();
              fabOpen = false;
            "
          >
            <i class="bi bi-upload"></i> YAML Import
          </button>
        </div>
      </transition>
      <button
        class="fab-button"
        :class="{ open: fabOpen }"
        @click="fabOpen = !fabOpen"
        :title="fabOpen ? 'Schließen' : 'Neues Rezept'"
      >
        <i class="bi" :class="fabOpen ? 'bi-x-lg' : 'bi-plus-lg'"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Horizontal scroll for recent recipes */
.recent-scroll {
  display: flex;
  gap: var(--space-3);
  overflow-x: auto;
  padding-bottom: var(--space-2);
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}

.recent-scroll::-webkit-scrollbar {
  height: 4px;
}

.recent-scroll::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
}

.recent-card {
  flex: 0 0 calc(50% - var(--space-3) / 2);
  max-width: 220px;
  scroll-snap-align: start;
}

.recent-card :deep(.card) {
  aspect-ratio: 3 / 2;
  overflow: hidden;
}

@media (min-width: 768px) {
  .recent-card {
    flex: 0 0 220px;
  }
}

/* Horizontal scroll for drafts */
.draft-scroll {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  padding-bottom: var(--space-1);
  -webkit-overflow-scrolling: touch;
}

.draft-scroll::-webkit-scrollbar {
  height: 4px;
}

.draft-scroll::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
}

.draft-chip {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--color-warning-bg);
  color: var(--color-warning-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  text-decoration: none;
  transition: background var(--transition-fast);
}

.draft-chip:hover {
  filter: brightness(0.95);
  text-decoration: none;
}

/* FAB */
.fab-container {
  position: fixed;
  bottom: calc(var(--bottom-nav-height) + var(--space-4));
  right: var(--space-4);
  z-index: var(--z-fab);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-2);
}

.fab-button {
  width: var(--fab-size);
  height: var(--fab-size);
  border-radius: var(--radius-circle);
  border: none;
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  font-size: var(--font-size-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-fab);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.fab-button:hover {
  box-shadow: var(--shadow-fab-hover);
  transform: scale(1.05);
}

.fab-button.open {
  background: var(--color-text-muted);
  transform: rotate(90deg);
}

.fab-menu {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  align-items: flex-end;
}

.fab-menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border: none;
  background: var(--color-chrome);
  color: var(--color-chrome-text);
  font-size: var(--font-size-sm);
  white-space: nowrap;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.fab-menu-item:hover {
  background: var(--color-chrome-hover);
}

.fab-items-enter-active,
.fab-items-leave-active {
  transition: all 0.2s ease;
}

.fab-items-enter-from,
.fab-items-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
