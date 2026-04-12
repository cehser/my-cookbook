<script setup lang="ts">
import { ref } from "vue";
import { useRecipeHelper } from "@/composables/useRecipeHelper";
import RecipeCard from "@/components/recipe/ui/RecipeCard.vue";
import type { Recipe } from "@/types/recipe";

interface RecipeWithIndex extends Recipe {
  originalIndex: number;
}

defineProps<{
  recipes: RecipeWithIndex[];
  readOnly?: boolean;
  highlight?: string;
}>();

const emit = defineEmits<{
  delete: [uuid: string];
}>();

const recipeId = ref("");
const { recipeThumbnailSrc } = useRecipeHelper({ recipeId });
const picture_src = recipeThumbnailSrc;
</script>

<template>
  <div class="row row-cols-2 row-cols-sm-2 row-cols-md-3 g-2">
    <div v-for="recipe in recipes" :key="recipe.recipe_uuid" class="col">
      <RecipeCard
        class="cardAspect"
        :recipe="recipe"
        :picture_src="picture_src(recipe)"
        :index="recipe.originalIndex"
        :highlight="highlight"
        :read_only="readOnly"
        @delete="emit('delete', recipe.recipe_uuid)"
      />
    </div>
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
