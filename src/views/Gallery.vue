<template>
  <div id="recipe">
    <Navbar @input="selected=$event" :recipes_list="recipes_list" :selected="selected">
    </Navbar>
    <b-container fluid>
      <h2>Galerie</h2>
      <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4">  
        <div v-for="(recipe, index) in recipes" :key="index" class="col mb-4">
          <b-link :to="{ path: '/recipe/'+index }">
            <RecipeCard :recipe="recipe" :index="index"></RecipeCard>
          </b-link>
        </div>
      </div>
    </b-container>
  </div>
</template>

<script>
  // @ is an alias to /src
  import RecipeHelper from '@/mixins/RecipeHelper'
  import Navbar from '@/components/Navbar.vue'
  import RecipeCard from '@/components/RecipeCard.vue'

  export default {
    name: 'Recipe',
    mixins: [RecipeHelper],
    components: {
      Navbar,
      RecipeCard
    }
  }

</script>