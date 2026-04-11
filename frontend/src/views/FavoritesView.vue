<script setup lang="ts">
import { computed } from "vue";
import { useRecipeStore } from "@/store/recipeStore";
import RecipeGrid from "@/components/recipe/ui/RecipeGrid.vue";

const store = useRecipeStore();

const settings = computed(() => store.settings);

const favoriteRecipes = computed(() => {
  return store.recipes
    .map((recipe, index) => ({ ...recipe, originalIndex: index }))
    .filter((r) => store.favorites.includes(r.recipe_uuid))
    .sort((a, b) => a.recipe_name.localeCompare(b.recipe_name));
});

function handleDeleteRecipe(uuid: string) {
  store.deleteRecipe(uuid);
}
</script>

<template>
  <div id="favorites-view">
    <BContainer fluid>
      <template v-if="favoriteRecipes.length">
        <h6 class="section-label mt-3 mb-2">
          <i class="bi bi-star-fill text-warning"></i>
          {{ favoriteRecipes.length }} Favorit{{
            favoriteRecipes.length !== 1 ? "en" : ""
          }}
        </h6>
        <RecipeGrid
          :recipes="favoriteRecipes"
          :read-only="settings.read_only"
          @delete="handleDeleteRecipe"
        />
      </template>

      <!-- Empty state -->
      <div v-else class="text-center text-muted mt-5">
        <i class="bi bi-star" style="font-size: 3rem; opacity: 0.3"></i>
        <p class="mt-2">Noch keine Favoriten</p>
        <p class="small">
          Tippe auf den Stern bei einem Rezept, um es als Favorit zu speichern.
        </p>
      </div>
    </BContainer>
  </div>
</template>

<style scoped>
.section-label {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #6c757d;
}
</style>
