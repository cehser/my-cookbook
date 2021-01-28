<template>
  <b-card 
    overlay
    :img-src="recipe.imageurl"
    img-alt="Recipe Image"
    text-variant="white"
    :title="recipe.recipe_name"
    :sub-title="recipe.subtitle"
    class="h-100">
    <b-card-text>
      Some quick example text to build on the card and make up the bulk of the card's content.
    </b-card-text>
  </b-card>
</template>


<script>
  export default {
    name: 'RecipeCard',
    props: {
      recipe: Object,
      index: Number
    }
  }
</script>