<template>
  <div class="card recipe_card_container">
    <div class="recipe_card_container">
      <img class="" id="recipe_img" :src="recipe.imageurl" alt="Card image cap">
      <div class="card-body recipe_title">
        <h2 class="card-title d-flex flex-row flex-wrap justify-content-between">
          <div>
            {{recipe.recipe_name}}
          </div>
        </h2>
        <p class="card-text">{{recipe.subtitle}}</p>
      </div>
    </div>
  </div>
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

<style scoped>
.recipe_card_container img {
  position: absolute;
  border-radius: calc(0.25rem - 1px);
  
  object-fit: cover; /* Do not scale the image */
  object-position: center; /* Center the image within the element */
  width: 100%;
  height: 100%;
  margin:auto;
}

.recipe_title {
  width:100%;
  position: absolute;
  bottom: 0;
  background-color: rgba(230, 230, 230,0.6);
  /*color: black;*/
}

a * {
    color: initial;
}
</style>