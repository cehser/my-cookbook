<template>
  <div class="card recipe_card_container">
    <div class="recipe_card_container">
      <img class="" id="recipe_img" :src="picture_src" alt="Card image cap">
      <div class="card-body recipe_title">
        <h2 class="card-title d-flex flex-row flex-wrap justify-content-between">
          <TextHighlight class="card-title-text" :queries="highlight" :caseSensitive="false">{{ recipe.recipe_name }}</TextHighlight>
        </h2>
        <router-link v-if="!read_only" class="editLink" :to="'/edit/' + index"><i class="bi bi-pencil"></i></router-link>
        <p class="card-text">{{recipe.subtitle}}</p>
      </div>
    </div>
  </div>
</template>


<script>
  import TextHighlight from 'vue-text-highlight';

  export default {
    name: 'RecipeCard',
    components: {TextHighlight},
    props: {
      recipe: Object,
      picture_src: [Object, URL],
      index: Number,
      highlight: String,
      read_only: Boolean
    },
    computed: {
      
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

a .recipe_card_container {
    color: initial;
}
 
.recipe_title p {
  -webkit-line-clamp: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
}

.editLink {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  color: #888;
}

.card-title-text {
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  line-height: 1.3;
}

.card-title >>> mark {
  padding: 0 !important;
  background-color: rgba(255, 204, 0, 0.5);
}
</style>