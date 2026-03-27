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

<script>
// @ is an alias to /src
import { useRecipeHelper } from "@/composables/useRecipeHelper";
import AppNavbar from "@/components/layout/AppNavbar.vue";
import RecipeDisplay from "@/components/recipe/display/RecipeDisplay.vue";
import RecipeFabMenu from "@/components/recipe/ui/RecipeFabMenu.vue";
import InlineEditActionBar from "@/components/recipe/ui/InlineEditActionBar.vue";
import jsyaml from "js-yaml";
import { mapState } from "vuex";
import { computed, ref, nextTick } from "vue";
import { useToast } from "bootstrap-vue-next";
import UUID from "@/js/uuid";
import ShareManager from "@/components/recipe/ui/ShareManager.vue";
import { deepCopyYaml } from "@/js/deepCopy";
import { recipeUrl, editUrl } from "@/js/slug";

export default {
  name: "Recipe",
  components: {
    AppNavbar,
    RecipeDisplay,
    RecipeFabMenu,
    InlineEditActionBar,
    ShareManager,
  },
  props: {
    id: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const idRef = computed(() => props.id);
    const recipeHelper = useRecipeHelper({ recipeId: idRef });

    // FAB Menu State (Mobile)
    const fabMenuOpen = ref(false);

    // Inline Edit Mode State
    const inlineEditMode = ref(false);
    const dirtyItems = ref(new Set());
    const toast = useToast();

    return {
      ...recipeHelper,
      fabMenuOpen,
      inlineEditMode,
      dirtyItems,
      toast,
    };
  },
  data() {
    return {
      editMode: false, // inline edit mode
      originalRecipe: null, // backup for cancel
      showShareManager: false, // toggle share manager
    };
  },
  mounted() {
    // Restore UI state
    this.$store.dispatch("restoreUIState");
  },
  watch: {
    id() {
      // Scroll to top when changing recipes via route
      window.scrollTo(0, 0);
    },
  },
  computed: {
    ...mapState(["settings", "recipes"]),
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
    navSelected(uuid) {
      const recipe = this.$store.state.recipes.find(r => r.recipe_uuid === uuid);
      this.$router.push(recipeUrl(uuid, recipe?.recipe_name));
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
        const prev = this.recipes[this.selected - 1];
        this.$router.push(recipeUrl(prev.recipe_uuid, prev.recipe_name));
      }
    },
    nextRecipe() {
      if (this.selected < this.recipes.length - 1) {
        const next = this.recipes[this.selected + 1];
        this.$router.push(recipeUrl(next.recipe_uuid, next.recipe_name));
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
        // Navigate to the new recipe
        this.$nextTick(() => {
          this.$router.push(recipeUrl(recipe.recipe_uuid, recipe.recipe_name));
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
          this.$store.dispatch("deleteRecipe", this.current_recipe.recipe_uuid);
          // Navigate to gallery after deletion
          this.$router.push("/");
        } catch (error) {
          console.error("Error deleting recipe:", error);
          this.toast("Fehler beim Löschen des Rezepts", "danger");
        }
      }
    },
    async shareRecipe() {
      if (!this.current_recipe) return;
      this.showShareManager = true;
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
      this.$router.push(editUrl(this.current_recipe.recipe_uuid, this.current_recipe.recipe_name));
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
    async saveRecipe() {
      if (!this.current_recipe) {
        this.toast("Rezept konnte nicht gespeichert werden", "danger");
        return;
      }

      try {
        await this.$store.dispatch("setRecipe", {
          index: this.selected,
          recipe: this.current_recipe,
        });
        this.editMode = false;
        this.originalRecipe = null;
        this.toast("Rezept gespeichert", "success");
      } catch (error) {
        console.error("Error saving recipe:", error);
        this.toast("Fehler beim Speichern des Rezepts", "danger");
      }
    },
    async handleInlineSave() {
      // Deprecated - kept for backward compatibility
      // Now using handleIngredientChanged instead
      if (!this.current_recipe) {
        return;
      }

      try {
        await this.$store.dispatch("setRecipe", {
          index: this.selected,
          recipe: this.current_recipe,
        });
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
    async saveInlineChanges() {
      // Save all inline changes and exit inline edit mode
      if (!this.current_recipe) {
        this.toast("Rezept konnte nicht gespeichert werden", "danger");
        return;
      }

      try {
        // Save changes to store and API
        await this.$store.dispatch("setRecipe", {
          index: this.selected,
          recipe: this.current_recipe,
        });
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
  },
};
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
