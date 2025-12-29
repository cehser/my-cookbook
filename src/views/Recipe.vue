<template>
  <div id="recipe" :class="{ 'inline-edit-active': inlineEditMode }">
    <AppNavbar
      @input="selected = $event"
      :recipes_list="recipes_list"
      :selected="selected"
      :read_only="settings.read_only"
    />

    <!-- Inline-Edit Action Bar -->
    <InlineEditActionBar
      :show="inlineEditMode"
      :changed-items-count="dirtyItems.size"
      @save="saveInlineChanges"
      @cancel="cancelInlineEdit"
    />

    <!-- Desktop/Tablet: Split-View Layout -->
    <div v-if="isDesktopOrTablet" class="recipe-container split-view">
      <div class="split-layout">
        <!-- Left Column: Sticky Ingredients -->
        <aside class="ingredients-column">
          <div class="sticky-wrapper">
            <div class="card rounded-0">
              <div class="card-header">
                <h3 class="card-title mb-0">Zutaten</h3>

                <!-- Portionen-Kontrolle (Desktop) -->
                <PortionControl
                  v-if="!editMode"
                  :yields-value="yields_value"
                  :yields-unit="yields_unit"
                  variant="desktop"
                  @update:yields="setYieldsValue"
                />

                <!-- Filter Toggle (Desktop) -->
                <div
                  v-if="!editMode && current_recipe.sections.length > 1"
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
                <!-- Zutaten-Sections (Desktop) -->
                <IngredientsSection
                  :sections="visibleDesktopSections"
                  :active-section="activeSection"
                  :ingredients="current_recipe.ingredients"
                  :yields-value="yields_value"
                  :inline-editable="inlineEditMode"
                  :dirty-items="dirtyItems"
                  @changed="handleIngredientChanged"
                  @unchanged="handleIngredientUnchanged"
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
                :src="picture_src"
                alt="Rezeptbild"
              />
              <!-- Favoriten-Stern (immer sichtbar, links oben) -->
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
              <!-- Metadaten-Button (rechts oben) -->
              <div
                class="metadata-toggle-icon"
                @click.prevent.stop="showMetadata = !showMetadata"
              >
                <i class="bi bi-info-circle" title="Metadaten anzeigen"></i>
              </div>

              <!-- Metadaten-Sidebar-Overlay (Desktop/Tablet) -->
              <MetadataOverlay
                :show="showMetadata && !isMobile"
                :is-mobile="false"
                :recipe="current_recipe"
                :yields-value="yields_value"
                :yields-unit="yields_unit"
                @close="showMetadata = false"
              />

              <div class="card-body" id="recipe_title">
                <h2 class="card-title">
                  <div v-if="!editMode">
                    {{ current_recipe.recipe_name }}
                  </div>
                  <BFormInput
                    v-else
                    v-model="current_recipe.recipe_name"
                    size="lg"
                    class="fw-bold"
                  />
                </h2>
                <p
                  v-if="!editMode && current_recipe.subtitle"
                  class="card-text"
                >
                  {{ current_recipe.subtitle }}
                </p>
                <BFormInput
                  v-else-if="editMode"
                  v-model="current_recipe.subtitle"
                  placeholder="Untertitel"
                />

                <div
                  v-if="current_recipe.tags && current_recipe.tags.length"
                  class="mt-2"
                >
                  <span
                    v-for="(tag, idx) in current_recipe.tags"
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
                :sections="current_recipe.sections"
                :steps="current_recipe.steps"
                :edit-mode="editMode"
                :inline-editable="inlineEditMode"
                :dirty-items="dirtyItems"
                key-prefix="desktop-"
                @select-step="selectStep"
                @changed="handleStepChanged"
                @unchanged="handleStepUnchanged"
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
              :src="picture_src"
              alt="Rezeptbild"
            />

            <!-- Favoriten-Stern (immer sichtbar, links oben) -->
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

            <!-- Metadaten-Button (rechts oben) -->
            <div
              class="metadata-toggle-icon"
              @click.prevent.stop="showMetadata = !showMetadata"
            >
              <i class="bi bi-info-circle" title="Metadaten anzeigen"></i>
            </div>
            <div class="card-body" id="recipe_title">
              <h2 class="card-title">
                <div v-if="!editMode">
                  {{ current_recipe.recipe_name }}
                </div>
                <BFormInput
                  v-else
                  v-model="current_recipe.recipe_name"
                  size="lg"
                  class="fw-bold"
                />
              </h2>
              <p v-if="!editMode && current_recipe.subtitle" class="card-text">
                {{ current_recipe.subtitle }}
              </p>
              <BFormInput
                v-else-if="editMode"
                v-model="current_recipe.subtitle"
                placeholder="Untertitel"
              />

              <div
                v-if="current_recipe.tags && current_recipe.tags.length"
                class="mt-2"
              >
                <span
                  v-for="(tag, idx) in current_recipe.tags"
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
              :sections="current_recipe.sections"
              :steps="current_recipe.steps"
              :edit-mode="editMode"
              :inline-editable="inlineEditMode"
              :dirty-items="dirtyItems"
              key-prefix="mobile-"
              @select-step="selectStep"
              @changed="handleStepChanged"
              @unchanged="handleStepUnchanged"
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
        :inline-editable="inlineEditMode"
        :dirty-items="dirtyItems"
        @open="openIngredientsBar"
        @close="closeIngredientsBar"
        @update:yields="setYieldsValue"
        @update:show-only-current-section="showOnlyCurrentSection = $event"
        @scroll-to-section="scrollToIngredientSection"
        @changed="handleIngredientChanged"
        @unchanged="handleIngredientUnchanged"
      />
    </div>

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
      @export="exportRecipe"
    />

    <!-- Mobile: Metadaten Bottom Sheet -->
    <MetadataOverlay
      :show="isMobile && showMetadata"
      :is-mobile="true"
      :recipe="current_recipe"
      :yields-value="yields_value"
      :yields-unit="yields_unit"
      @close="showMetadata = false"
    />
  </div>
</template>

<script>
// @ is an alias to /src
import { useRecipeHelper } from "@/composables/useRecipeHelper";
import { useViewport } from "@/composables/useViewport";
import AppNavbar from "@/components/layout/AppNavbar.vue";
import MetadataOverlay from "@/components/recipe/display/MetadataOverlay.vue";
import PortionControl from "@/components/recipe/display/PortionControl.vue";
import IngredientsSection from "@/components/recipe/display/IngredientsSection.vue";
import MobileIngredientsBar from "@/components/recipe/display/MobileIngredientsBar.vue";
import RecipeFabMenu from "@/components/recipe/ui/RecipeFabMenu.vue";
import InlineEditActionBar from "@/components/recipe/ui/InlineEditActionBar.vue";
import StepSection from "@/components/recipe/display/StepSection.vue";
import jsyaml from "js-yaml";
import { mapState } from "vuex";
import { computed, ref, nextTick } from "vue";
import { useToast } from "bootstrap-vue-next";
import UUID from "@/js/uuid";
import { deepCopyYaml } from "@/js/deepCopy";

export default {
  name: "Recipe",
  components: {
    AppNavbar,
    MetadataOverlay,
    PortionControl,
    IngredientsSection,
    MobileIngredientsBar,
    RecipeFabMenu,
    InlineEditActionBar,
    StepSection,
  },
  props: {
    selected: {
      type: Number,
      default: 0,
    },
  },
  setup(props) {
    const selectedRef = computed(() => props.selected);
    const recipeHelper = useRecipeHelper({ selected: selectedRef });
    const viewport = useViewport();

    // Mobile Bottom Bar State
    const ingredientsExpanded = ref(false);
    const showOnlyCurrentSection = ref(true); // Mobile: Default only current section
    const activeSection = ref(null);

    // Desktop Filter State
    const showAllIngredients = ref(true); // Desktop: Default show all

    // FAB Menu State (Mobile)
    const fabMenuOpen = ref(false);

    // Inline Edit Mode State
    const inlineEditMode = ref(false);
    const dirtyItems = ref(new Set());
    const toast = useToast();

    return {
      ...recipeHelper,
      ...viewport,
      ingredientsExpanded,
      showOnlyCurrentSection,
      showAllIngredients,
      activeSection,
      fabMenuOpen,
      inlineEditMode,
      dirtyItems,
      toast,
    };
  },
  data() {
    return {
      showIngredients: true, // control ingredients panel visibility
      editMode: false, // inline edit mode
      originalRecipe: null, // backup for cancel
      showMetadata: false, // toggle metadata visibility
      observer: null, // Intersection Observer instance
      sectionUpdateTimeout: null, // Debounce timeout for section updates
    };
  },
  mounted() {
    // Restore UI state
    this.$store.dispatch("restoreUIState");
    const savedShowIngredients = this.$store.getters.recipeShowIngredients;

    //hide ingredients sidebar on default in portrait mode (unless user has preference)
    let x = window.matchMedia("(max-width: 812px)");
    if (x.matches && savedShowIngredients === true) {
      // Only hide on mobile if no saved preference
      this.showIngredients = false;
    } else {
      this.showIngredients = savedShowIngredients;
    }

    // Setup Intersection Observer
    this.$nextTick(() => {
      this.observeStepSections();
    });
  },
  beforeUnmount() {
    window.removeEventListener("scroll", this.handleScroll);
    // Cleanup Intersection Observer
    if (this.observer) {
      this.observer.disconnect();
    }
    // Cleanup debounce timeout
    if (this.sectionUpdateTimeout) {
      clearTimeout(this.sectionUpdateTimeout);
    }
  },
  watch: {
    selected(newSelected) {
      // Reload recipe when selected prop changes (prev/next navigation)
      if (this.recipes[newSelected]) {
        this.loadRecipe(this.recipes[newSelected]);
        // Scroll to top when changing recipes
        window.scrollTo(0, 0);
        // Re-observe step sections
        this.$nextTick(() => {
          this.observeStepSections();
        });
      }
    },
  },
  computed: {
    ...mapState(["settings", "recipes"]),
    stepsFullWidth() {
      return !this.showIngredients;
    },
    hasMetadata() {
      if (!this.current_recipe) return false;
      return !!(
        this.current_recipe.author ||
        this.current_recipe.source_url ||
        this.current_recipe.source_book ||
        this.current_recipe.servings ||
        this.current_recipe.prep_time ||
        this.current_recipe.cook_time ||
        this.current_recipe.bake_time ||
        this.current_recipe.total_time ||
        this.current_recipe.difficulty ||
        this.current_recipe.notes
      );
    },
    // Mobile: Filtered sections for bottom bar
    visibleIngredientSections() {
      if (this.showOnlyCurrentSection && this.activeSection) {
        return this.current_recipe.sections.filter(
          (section) => section.section === this.activeSection,
        );
      }
      return this.current_recipe.sections;
    },
    // Desktop: Filtered sections for split-view
    visibleDesktopSections() {
      if (!this.showAllIngredients && this.activeSection) {
        return this.current_recipe.sections.filter(
          (section) => section.section === this.activeSection,
        );
      }
      return this.current_recipe.sections;
    },
    // Check if current recipe is in favorites
    isFavorite() {
      if (!this.current_recipe || !this.current_recipe.recipe_uuid) {
        return false;
      }
      const favorites = this.$store.state.favorites || [];
      return favorites.includes(this.current_recipe.recipe_uuid);
    },
  },
  methods: {
    formatNumbers: function (value) {
      if (typeof value !== "number") {
        return value;
      }
      return Number(value).toLocaleString("de-DE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    },
    getStepNumber: function (sectionName, stepIndex) {
      let count = 1;
      for (let section of this.current_recipe.sections) {
        if (section.section === sectionName) {
          return count + stepIndex;
        }
        count += this.current_recipe.steps.filter(
          (x) => x.section === section.section,
        ).length;
      }
      return count;
    },
    toggleIngredients() {
      this.showIngredients = !this.showIngredients;
      // Persist sidebar state
      this.$store.dispatch("setRecipeShowIngredients", this.showIngredients);
    },
    exportRecipe() {
      const yaml = jsyaml.dump(this.current_recipe);
      const blob = new Blob([yaml], { type: "text/yaml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${this.current_recipe.recipe_name || "recipe"}.yaml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    prevRecipe() {
      if (this.selected > 0) {
        this.$router.push("/recipe/" + (this.selected - 1));
      }
    },
    nextRecipe() {
      if (this.selected < this.recipes.length - 1) {
        this.$router.push("/recipe/" + (this.selected + 1));
      }
    },
    copyRecipe() {
      if (!this.current_recipe) {
        this.toast("Rezept konnte nicht dupliziert werden", "danger");
        return;
      }

      try {
        // Deep copy current recipe
        const recipe = deepCopyYaml(this.current_recipe);
        // Generate new UUID
        recipe.recipe_uuid = UUID.generateUUID();
        // Append to store
        this.$store.dispatch("appendRecipe", recipe);
        // Navigate to the new recipe (will be at the end of the list)
        this.$nextTick(() => {
          this.$router.push("/recipe/" + (this.recipes.length - 1));
        });
      } catch (error) {
        console.error("Error copying recipe:", error);
        this.toast("Fehler beim Duplizieren des Rezepts", "danger");
      }
    },
    deleteRecipe() {
      if (!this.current_recipe) {
        this.toast("Rezept konnte nicht gelöscht werden", "danger");
        return;
      }

      if (
        confirm(`Rezept "${this.current_recipe.recipe_name}" wirklich löschen?`)
      ) {
        try {
          this.$store.dispatch("deleteRecipe", this.selected);
          // Navigate to gallery after deletion
          this.$router.push("/");
        } catch (error) {
          console.error("Error deleting recipe:", error);
          this.toast("Fehler beim Löschen des Rezepts", "danger");
        }
      }
    },
    toggleFavorite() {
      if (!this.current_recipe || !this.current_recipe.recipe_uuid) {
        return;
      }
      if (this.isFavorite) {
        this.$store.dispatch("removeFavorite", this.current_recipe.recipe_uuid);
      } else {
        this.$store.dispatch("addFavorite", this.current_recipe.recipe_uuid);
      }
    },
    goToEdit() {
      this.$router.push(`/edit/${this.selected}`);
    },
    toggleEditMode() {
      if (!this.current_recipe) {
        this.toast("Rezept konnte nicht bearbeitet werden", "danger");
        return;
      }

      // Toggle inline edit mode instead of full edit mode
      this.inlineEditMode = !this.inlineEditMode;
      if (this.inlineEditMode) {
        // Backup current recipe for cancel
        this.originalRecipe = deepCopyYaml(this.current_recipe);
        this.dirtyItems.clear();
      } else {
        // Exiting inline edit mode - clear backup if not saving
        if (this.dirtyItems.size === 0) {
          this.originalRecipe = null;
        }
      }
    },
    saveRecipe() {
      if (!this.current_recipe) {
        this.toast("Rezept konnte nicht gespeichert werden", "danger");
        return;
      }

      try {
        // Save changes to store
        this.$store.dispatch("updateRecipe", {
          index: this.selected,
          recipe: this.current_recipe,
        });
        this.$store.dispatch("saveToLocalStorage");
        this.editMode = false;
        this.originalRecipe = null;
        this.toast("Rezept gespeichert", "success");
      } catch (error) {
        console.error("Error saving recipe:", error);
        this.toast("Fehler beim Speichern des Rezepts", "danger");
      }
    },
    handleInlineSave() {
      // Deprecated - kept for backward compatibility
      // Now using handleIngredientChanged instead
      if (!this.current_recipe) {
        return;
      }

      try {
        this.$store.dispatch("updateRecipe", {
          index: this.selected,
          recipe: this.current_recipe,
        });
        this.$store.dispatch("saveToLocalStorage");
        this.toast("Änderung gespeichert", "success");
      } catch (error) {
        console.error("Error saving inline changes:", error);
        this.toast("Fehler beim Speichern", "danger");
      }
    },
    handleIngredientChanged(ingredientKey) {
      // Track which ingredient was changed (key already includes "ingredient:" prefix)
      this.dirtyItems.add(ingredientKey);
    },
    handleIngredientUnchanged(ingredientKey) {
      // Remove ingredient from dirty items (key already includes "ingredient:" prefix)
      this.dirtyItems.delete(ingredientKey);
    },
    handleStepChanged(stepIndex) {
      // Track which step was changed
      this.dirtyItems.add(`step:${stepIndex}`);
    },
    handleStepUnchanged(stepIndex) {
      // Remove step from dirty items (undo)
      this.dirtyItems.delete(`step:${stepIndex}`);
    },
    saveInlineChanges() {
      // Save all inline changes and exit inline edit mode
      if (!this.current_recipe) {
        this.toast("Rezept konnte nicht gespeichert werden", "danger");
        return;
      }

      try {
        // Save changes to store
        this.$store.dispatch("updateRecipe", {
          index: this.selected,
          recipe: this.current_recipe,
        });
        this.$store.dispatch("saveToLocalStorage");
        this.inlineEditMode = false;
        this.originalRecipe = null;
        this.dirtyItems.clear();
        this.showToast("Änderungen gespeichert", "success");
      } catch (error) {
        console.error("Error saving inline changes:", error);
        this.showToast("Fehler beim Speichern der Änderungen", "danger");
      }
    },
    cancelInlineEdit() {
      // Restore original recipe and exit inline edit mode
      if (this.originalRecipe) {
        this.current_recipe = deepCopyYaml(this.originalRecipe);
      }
      this.inlineEditMode = false;
      this.originalRecipe = null;
      this.dirtyItems.clear();
      this.showToast("Änderungen verworfen", "info");
    },
    cancelEdit() {
      // Restore original recipe
      if (this.originalRecipe) {
        this.current_recipe = deepCopyYaml(this.originalRecipe);
      }
      this.editMode = false;
      this.originalRecipe = null;
    },
    renameIngredient(ingredient, newName) {
      // Rename ingredient key
      const oldName = Object.keys(ingredient)[0];
      if (oldName !== newName && newName) {
        ingredient[newName] = ingredient[oldName];
        delete ingredient[oldName];
      }
    },
    selectStep: function (ev) {
      let doHighlight = !ev.target.classList.contains(
        "list-group-item-primary",
      );

      // Remove highlight from all steps
      document.querySelectorAll("#steps .list-group-item").forEach((el) => {
        el.classList.remove("list-group-item-primary");
      });
      ev.target.classList.toggle("list-group-item-primary", doHighlight);

      // Remove highlight from all ingredient sections
      document
        .querySelectorAll("#ingredients .ingredients-section")
        .forEach((el) => {
          el.classList.remove(
            "highlighted",
            "list-group-item-primary",
            "border-primary",
          );
        });

      const section = ev.target.dataset.section;
      const ingredientBox = document.querySelector("#box-ing-" + section);
      if (ingredientBox) {
        ingredientBox.classList.toggle("highlighted", doHighlight);
        ingredientBox.classList.toggle("list-group-item-primary", doHighlight);
        ingredientBox.classList.toggle("border-primary", doHighlight);
      }
    },
    showToast(content, variant = "info") {
      if (this.toast) {
        this.toast.create({
          props: {
            body: content,
            variant: variant,
            pos: "bottom-left",
          },
        });
      }
    },
    // Mobile Bottom Bar Controls
    openIngredientsBar() {
      this.ingredientsExpanded = true;

      // Smart scroll to active section (when "Alle" active)
      if (!this.showOnlyCurrentSection && this.activeSection) {
        nextTick(() => {
          const sectionEl = document.querySelector(
            `.ingredient-section[data-section="${this.activeSection}"]`,
          );
          sectionEl?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    },
    closeIngredientsBar() {
      this.ingredientsExpanded = false;
    },
    scrollToIngredientSection(sectionName) {
      const sectionEl = document.querySelector(
        `.ingredient-section[data-section="${sectionName}"]`,
      );
      sectionEl?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    getIngredients(sectionName) {
      return this.current_recipe.ingredients.filter(
        (ing) => ing.section === sectionName,
      );
    },
    // Intersection Observer Setup
    observeStepSections() {
      // Cleanup existing observer
      if (this.observer) {
        this.observer.disconnect();
      }

      const stepSections = document.querySelectorAll("[data-step-section]");

      if (stepSections.length === 0) {
        // Retry after a short delay (DOM might not be ready)
        setTimeout(() => this.observeStepSections(), 100);
        return;
      }

      this.observer = new IntersectionObserver(
        () => {
          // Clear previous timeout
          if (this.sectionUpdateTimeout) {
            clearTimeout(this.sectionUpdateTimeout);
          }

          // Debounce section updates to prevent flickering
          this.sectionUpdateTimeout = setTimeout(() => {
            // Query all sections to find the most visible one
            const allSections = document.querySelectorAll(
              "[data-step-section]",
            );
            let maxVisibility = 0;
            let mostVisibleSection = null;

            allSections.forEach((section) => {
              const rect = section.getBoundingClientRect();
              const viewportHeight = window.innerHeight;

              // Calculate how much of the section is visible
              const visibleTop = Math.max(0, rect.top);
              const visibleBottom = Math.min(viewportHeight, rect.bottom);
              const visibleHeight = Math.max(0, visibleBottom - visibleTop);

              // Prioritize sections in the upper half of viewport
              const centerOffset = Math.abs(
                rect.top + rect.height / 2 - viewportHeight / 3,
              );
              const visibility = visibleHeight - centerOffset * 0.5;

              if (visibility > maxVisibility && visibleHeight > 50) {
                maxVisibility = visibility;
                mostVisibleSection = section.getAttribute("data-step-section");
              }
            });

            if (
              mostVisibleSection &&
              mostVisibleSection !== this.activeSection
            ) {
              this.activeSection = mostVisibleSection;
            }
          }, 150); // 150ms debounce
        },
        {
          threshold: [0, 0.5, 1],
          rootMargin: "-100px 0px -200px 0px",
        },
      );

      stepSections.forEach((section) => this.observer.observe(section));

      // Add scroll listener for last section detection
      this.handleScroll();
      window.addEventListener("scroll", this.handleScroll);
    },
    handleScroll() {
      // Detect if scrolled to bottom (within 100px)
      const scrollPosition = window.innerHeight + window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;

      if (scrollPosition >= documentHeight - 100) {
        // Set last section as active
        const lastSection =
          this.current_recipe.sections[this.current_recipe.sections.length - 1];
        if (lastSection) {
          this.activeSection = lastSection.section;
        }
      }
    },
  },
};
</script>

<style scoped>
/* ============================================
   INLINE EDIT MODE ADJUSTMENTS
   ============================================ */
/* Add padding when action bar is visible */
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

/* ============================================
   DESKTOP/TABLET: SPLIT-VIEW LAYOUT
   ============================================ */
@media (min-width: 768px) {
  .recipe-container.split-view {
    width: 100%;
    min-height: 100vh;
  }

  .split-layout {
    display: grid;
    grid-template-columns: 35% 65%;
    gap: 2rem;
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
  }

  @media (max-width: 1024px) and (min-width: 768px) {
    .split-layout {
      grid-template-columns: 40% 60%;
      gap: 1.5rem;
      padding: 1.5rem;
    }
  }

  .ingredients-column {
    position: relative;
  }

  .sticky-wrapper {
    position: sticky;
    top: calc(56px + 1rem);
    max-height: calc(100vh - 56px - 2rem);
    overflow-y: auto;
  }

  .steps-column {
    min-height: 100vh;
  }

  /* Desktop Filter Controls */
  .filter-controls {
    display: flex;
    gap: 0.5rem;
  }

  .filter-controls .btn {
    font-size: 0.875rem;
  }

  /* Desktop Ingredients Section Highlighting */
  .ingredients-column .ingredients-section {
    padding: 1rem;
    margin-bottom: 1rem;
    border-radius: 8px;
    background: var(--bs-light);
    transition: all 0.3s ease;
    border-left: 4px solid transparent;
  }

  .ingredients-column .ingredients-section.active {
    background: rgba(var(--bs-primary-rgb), 0.1);
    border-left-color: var(--bs-primary);
    padding-left: calc(1rem - 4px);
  }

  .ingredients-column .ingredients-section h5 {
    transition: color 0.3s ease;
  }

  .ingredients-column .ingredients-section.active h5 {
    color: var(--bs-primary);
    font-weight: 600;
  }
}

/* ============================================
   MOBILE: BOTTOM BAR LAYOUT
   ============================================ */
@media (max-width: 767px) {
  .recipe-container.mobile-view {
    position: relative;
    padding-bottom: 80px;
  }
}

/* ============================================
   COMMON STYLES
   ============================================ */
#recipe_title_container {
  position: relative;
}

#recipe_img {
  max-height: 60vh;
  object-fit: cover;
  object-position: center;
  width: 100%;
  margin: auto;
}

#recipe_title {
  width: 100%;
  position: absolute;
  bottom: 0;
  background-color: rgba(230, 230, 230, 0.6);
}

.ingredients-section {
  margin-bottom: 1.5rem;
}

.ingredients-section h5 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: var(--bs-dark);
}

/* Step Section Highlighting (optional visual feedback) */
.step-section {
  margin-bottom: 2rem;
  scroll-margin-top: 100px;
}

.step-section h4 {
  margin-top: 0.5rem;
  margin-bottom: 0.75rem;
}

/* List Styles */
.list-group-alpha {
  list-style: lower-alpha inside;
}

.list-group-roman {
  list-style: lower-roman inside;
}

.list-group-alpha > li {
  display: list-item;
}

/* Step Sections */
.step-section {
  margin-bottom: 2rem;
}

.step-section h4 {
  margin-top: 0.5rem;
  margin-bottom: 0.75rem;
}

/* Quick Actions on Recipe Image */
.recipe-image-container {
  position: relative;
}

/* Desktop: Show all action buttons */
.quick-actions.desktop-actions {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  gap: 0.25rem;
  z-index: 10;
}

.quick-actions .action-btn {
  width: var(--action-btn-size);
  height: var(--action-btn-size);
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-md);
  border: none;
  transition: var(--transition-all-fast);
}

.quick-actions .action-btn i {
  font-size: 1.2rem;
}

.quick-actions .action-btn:hover {
  transform: scale(1.05);
  box-shadow: var(--shadow-lg);
}

.quick-actions .action-btn.btn-warning {
  background-color: #ffc107;
  color: #000;
}

.quick-actions .action-btn.btn-light {
  background-color: rgba(255, 255, 255, 0.9);
}

.quick-actions .action-btn.btn-light:hover {
  background-color: #fff;
}

/* Mobile/Tablet: Only favorite star (no button style, like in gallery) */
.favorite-star {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  z-index: var(--z-actions);
  cursor: pointer;
  font-size: 1.8rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  transition: var(--transition-transform);
}

.favorite-star:hover {
  transform: scale(1.15);
}

/* Metadata Toggle Icon (right side of image) */
.metadata-toggle-icon {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: var(--z-actions);
  cursor: pointer;
  width: var(--action-btn-size);
  height: var(--action-btn-size);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-circle);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  transition:
    var(--transition-transform),
    box-shadow var(--transition-fast);
  box-shadow: var(--shadow-sm);
}

.metadata-toggle-icon i {
  font-size: 1.3rem;
  color: #495057;
}

.metadata-toggle-icon:hover {
  transform: scale(1.1);
  box-shadow: var(--shadow-md);
}

@media (max-width: 767px) {
  .metadata-toggle-icon {
    width: var(--fab-size-small);
    height: var(--fab-size-small);
  }

  .metadata-toggle-icon i {
    font-size: 1.4rem;
  }
}
</style>
