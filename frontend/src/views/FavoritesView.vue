<script setup lang="ts">
import { ref, computed } from "vue";
import { useRecipeHelper } from "@/composables/useRecipeHelper";
import { useRecipeStore } from "@/store/recipeStore";
import RecipeCard from "@/components/recipe/ui/RecipeCard.vue";

const store = useRecipeStore();

const recipeId = ref("");
const { recipeThumbnailSrc } = useRecipeHelper({ recipeId });
const picture_src = recipeThumbnailSrc;

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
        <div
          class="row row-cols-2 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-5 g-2"
        >
          <div
            v-for="recipe in favoriteRecipes"
            :key="recipe.recipe_uuid"
            class="col"
          >
            <RecipeCard
              class="cardAspect"
              :recipe="recipe"
              :picture_src="picture_src(recipe)"
              :index="recipe.originalIndex"
              :read_only="settings.read_only"
              @delete="handleDeleteRecipe(recipe.recipe_uuid)"
            />
          </div>
        </div>
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

<style lang="scss">
@use "sass:math";
@use "sass:list";
@use "sass:string";

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
.section-label {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #6c757d;
}
</style>
