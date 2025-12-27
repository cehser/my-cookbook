<template>
  <div id="recipe">
    <AppNavbar
      @input="selected = $event"
      :recipes_list="recipes_list"
      :selected="selected"
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
            <BDropdownDivider />
            <BDropdownItem @click="syncWithWebDAV">
              <i class="bi bi-arrow-repeat"></i> Cloud-Sync
            </BDropdownItem>
            <BDropdownItem @click="loadFromWebDAV">
              <i class="bi bi-cloud-download"></i> Cloud-Download
            </BDropdownItem>
            <BDropdownItem @click="loadPictures">
              <i class="bi bi-image"></i> Bilder-Download
            </BDropdownItem>
            <BDropdownItem @click="saveToWebDAV">
              <i class="bi bi-cloud-upload"></i> Cloud-Upload
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
            @delete="deleteRecipe(recipe.originalIndex)"
          />
        </div>
      </div>
    </BContainer>
  </div>
</template>

<script>
// @ is an alias to /src
import { useRecipeHelper } from "@/composables/useRecipeHelper";
import { useToast } from "@/composables/useToast";
import AppNavbar from "@/components/layout/AppNavbar.vue";
import RecipeCard from "@/components/recipe/ui/RecipeCard.vue";
import AIRecipeImport from "@/components/features/AIRecipeImport.vue";
import { mapState } from "vuex";
import { computed } from "vue";
import Recipes from "@/js/recipes";
import Cloud from "@/js/cloud";
import jsyaml from "js-yaml";

export default {
  name: "Recipe",
  props: {
    selected: {
      type: Number,
      default: 0,
    },
  },
  components: {
    AppNavbar,
    RecipeCard,
    AIRecipeImport,
  },
  setup(props) {
    const selectedRef = computed(() => props.selected);
    const recipeHelper = useRecipeHelper({ selected: selectedRef });
    const { toast } = useToast();

    return {
      ...recipeHelper,
      toast,
      picture_src: recipeHelper.recipePictureSrc,
    };
  },
  data() {
    return {
      refreshing: false,
      registration: null,
      updateExists: false,
      filter: "",
      selectedTags: [],
      selectedAuthor: null,
      selectedDifficulty: null,
      sortBy: "name-asc",
      showAIImport: false,
    };
  },
  created() {
    document.addEventListener("swUpdated", this.showRefreshUI, { once: true });
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (this.refreshing) return;
        this.refreshing = true;
        window.location.reload();
      });
    }
  },
  mounted() {
    // Restore UI state
    try {
      this.$store.dispatch("restoreUIState");
      this.filter = this.$store.getters.galleryFilter || "";
      this.selectedTags = this.$store.getters.gallerySelectedTags
        ? [...this.$store.getters.gallerySelectedTags]
        : [];
      this.sortBy = this.$store.getters.gallerySortBy || "name-asc";

      // Restore scroll position
      this.$nextTick(() => {
        const scrollPos = this.$store.getters.galleryScrollPosition || 0;
        if (scrollPos > 0) {
          window.scrollTo(0, scrollPos);
        }
      });
    } catch (e) {
      console.error("Failed to restore UI state:", e);
    }
  },
  beforeUnmount() {
    // Save scroll position before leaving
    this.$store.dispatch("setGalleryScrollPosition", window.scrollY);
  },
  watch: {
    filter(newFilter) {
      try {
        this.$store.dispatch("setGalleryFilter", newFilter);
      } catch (e) {
        console.error("Failed to save filter:", e);
      }
    },
    selectedTags: {
      deep: true,
      handler(newTags) {
        try {
          this.$store.dispatch("setGallerySelectedTags", newTags);
        } catch (e) {
          console.error("Failed to save tags:", e);
        }
      },
    },
    sortBy(newSortBy) {
      try {
        this.$store.dispatch("setGallerySortBy", newSortBy);
      } catch (e) {
        console.error("Failed to save sortBy:", e);
      }
    },
  },
  computed: {
    ...mapState(["settings", "recipes"]),
    allTags() {
      const tags = new Set();
      this.recipes.forEach((recipe) => {
        if (recipe.tags) {
          recipe.tags.forEach((tag) => tags.add(tag));
        }
      });
      return Array.from(tags).sort();
    },
    allAuthors() {
      const authors = new Set();
      this.recipes.forEach((recipe) => {
        if (recipe.author) {
          authors.add(recipe.author);
        }
      });
      return Array.from(authors).sort();
    },
    hasActiveFilters() {
      return (
        this.filter ||
        this.selectedTags.length > 0 ||
        this.selectedAuthor ||
        this.selectedDifficulty
      );
    },
    orphanedTags() {
      // Tags that are selected but don't exist in any recipe
      return this.selectedTags.filter((tag) => !this.allTags.includes(tag));
    },
    filteredRecipes() {
      // Add original index to each recipe
      const recipesWithIndex = this.recipes.map((recipe, index) => ({
        ...recipe,
        originalIndex: index,
      }));

      const filtered = recipesWithIndex.filter((recipe) => {
        // Text filter
        const matchesText =
          !this.filter ||
          recipe.recipe_name.toLowerCase().includes(this.filter.toLowerCase());

        // Tag filter (OR logic: recipe must have at least one selected tag)
        const matchesTags =
          this.selectedTags.length === 0 ||
          (recipe.tags &&
            this.selectedTags.some((tag) => recipe.tags.includes(tag)));

        // Author filter
        const matchesAuthor =
          !this.selectedAuthor || recipe.author === this.selectedAuthor;

        // Difficulty filter
        const matchesDifficulty =
          !this.selectedDifficulty ||
          recipe.difficulty === this.selectedDifficulty;

        return matchesText && matchesTags && matchesAuthor && matchesDifficulty;
      });

      // Sortierung
      const sorted = [...filtered];
      const favorites = this.$store.state.favorites || [];

      sorted.sort((a, b) => {
        switch (this.sortBy) {
          case "name-asc":
            return a.recipe_name.localeCompare(b.recipe_name);
          case "name-desc":
            return b.recipe_name.localeCompare(a.recipe_name);
          case "date-new":
            return new Date(b.lastUpdated) - new Date(a.lastUpdated);
          case "date-old":
            return new Date(a.lastUpdated) - new Date(b.lastUpdated);
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
    },
  },
  methods: {
    toggleTag(tag) {
      const index = this.selectedTags.indexOf(tag);
      if (index > -1) {
        this.selectedTags.splice(index, 1);
      } else {
        this.selectedTags.push(tag);
      }
    },
    clearAllFilters() {
      this.filter = "";
      this.selectedTags = [];
      this.selectedAuthor = null;
      this.selectedDifficulty = null;
    },
    showRefreshUI(e) {
      this.registration = e.detail;
      this.updateExists = true;
    },
    refreshApp() {
      this.updateExists = false;
      if (!this.registration || !this.registration.waiting) {
        return;
      }
      this.registration.waiting.postMessage("skipWaiting");
    },
    handleDeleteRecipe(index) {
      this.$store.dispatch("deleteRecipe", index);
    },
    newRecipe() {
      this.$store.dispatch("appendRecipe", Recipes.loadNewRecipe());
      this.toast("Neues Rezept erstellt.", "success");
    },
    loadSample() {
      this.$store.dispatch("appendRecipe", Recipes.loadSample());
      this.toast("Beispielrezept geladen.", "success");
    },
    onAIImport(recipe) {
      this.$store.dispatch("appendRecipe", recipe);
      this.toast(`Rezept "${recipe.recipe_name}" importiert.`, "success");
      this.showAIImport = false;
    },
    triggerImport() {
      this.$refs.fileInput.click();
    },
    importRecipe(ev) {
      const file = ev.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const recipe = jsyaml.load(e.target.result);
          this.$store.dispatch("appendRecipe", recipe);
          this.toast(`Rezept "${recipe.recipe_name}" importiert.`, "success");
          this.$refs.fileInput.value = "";
        } catch (error) {
          this.toast("Fehler beim Importieren: " + error.message, "danger");
        }
      };
      reader.readAsText(file);
    },
    syncWithWebDAV() {
      const spinner = document.querySelector("#loading-spinner");
      if (spinner) spinner.classList.remove("d-none");
      this.$store
        .dispatch("syncRecipesWithCloud")
        .then(() => this.toast("Synchronisiert.", "success"))
        .catch(() => this.toast("Fehler.", "danger"))
        .finally(() => {
          if (spinner) spinner.classList.add("d-none");
        });
    },
    loadFromWebDAV() {
      const spinner = document.querySelector("#loading-spinner");
      if (spinner) spinner.classList.remove("d-none");
      Cloud.getRecipesFromCloud(this.settings)
        .then((recipes) => {
          this.$store.dispatch("setRecipes", recipes);
          this.toast("Rezepte heruntergeladen.", "success");
        })
        .catch(() => this.toast("Cloud-Download fehlgeschlagen.", "danger"))
        .finally(() => {
          if (spinner) spinner.classList.add("d-none");
        });
    },
    saveToWebDAV() {
      const spinner = document.querySelector("#loading-spinner");
      if (spinner) spinner.classList.remove("d-none");
      Cloud.pushRecipesToCloud(this.recipes, this.settings)
        .then(() => this.toast("Rezepte hochgeladen.", "success"))
        .catch(() => this.toast("Cloud-Upload fehlgeschlagen.", "danger"))
        .finally(() => {
          if (spinner) spinner.classList.add("d-none");
        });
    },
    loadPictures() {
      const spinner = document.querySelector("#loading-spinner");
      if (spinner) spinner.classList.remove("d-none");
      Cloud.loadPictures(this.recipes, this.settings)
        .then(() => this.toast("Bilder heruntergeladen.", "success"))
        .catch(() => this.toast("Bilder-Download fehlgeschlagen.", "danger"))
        .finally(() => {
          if (spinner) spinner.classList.add("d-none");
        });
    },
  },
};
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
