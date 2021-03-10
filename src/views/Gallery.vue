<template>
  <div id="recipe">
    <Navbar @input="selected=$event" :recipes_list="recipes_list" :selected="selected" :read_only="settings.read_only">
      <b-button v-if="updateExists" @click="refreshApp">
        New version available! Click to update
      </b-button>
    </Navbar>
    <b-container fluid>
      <h2 class="mt-2 mb-0">Galerie</h2>
      <b-form inline> 
        <b-input-group prepend="Filter" class="mt-2 mr-sm-2 mb-sm-0">
          <b-form-input v-model="filter" type="text"></b-form-input>
          <b-input-group-append>
            <b-button @click="filter=''"><b-icon-x></b-icon-x></b-button>
          </b-input-group-append>
        </b-input-group>
        <b-button class="mt-2 mr-sm-2 mb-sm-0" :pressed.sync="favoritesFilter">
          <b-icon-star v-if="!favoritesFilter"></b-icon-star>
          <b-icon-star-fill v-if="favoritesFilter"></b-icon-star-fill>
        </b-button>
      </b-form> 
      <div class="row row-cols-1 row-cols-sm-2 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 mt-2">  
        <div v-for="(recipe, index) in recipes" :key="index" class="col mb-4" v-show="galleryFilter(recipe)">          
          <RecipeCard class='cardAspect' @favtoggle="toggleFav(recipe)"  :is_favorite="favorites['Favoriten'].includes(recipe.recipe_uuid) " :recipe="recipe" :picture_src="recipePictureSrc(recipe)" :index="index" :highlight="filter" :read_only="settings.read_only"></RecipeCard>
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
  import { mapState } from 'vuex'
  import { xor } from 'lodash'


  export default {
    name: 'Recipe',
    mixins: [RecipeHelper],
    components: {
      Navbar,
      RecipeCard
    },
    data() {
      return {
        refreshing: false,
        registration: null,
        updateExists: false,
        filter: '',
        favoritesFilter: false
      };
    },
    created () {
      document.addEventListener(
        'swUpdated', this.showRefreshUI, { once: true }
      );  
      if (navigator.serviceWorker) {  
        navigator.serviceWorker.addEventListener(
          'controllerchange', () => {
            if (this.refreshing) return;
            this.refreshing = true;
            window.location.reload();
          }
        );
      }
    },
    computed: {
      // mix the getters into computed with object spread operator
      ...mapState([
        'settings',
        'favorites'
      ])
    },
    methods: {
      showRefreshUI (e) {
        this.registration = e.detail;
        this.updateExists = true;
      },
      refreshApp () {
        this.updateExists = false;  if (!this.registration || !this.registration.waiting) { return; }
        this.registration.waiting.postMessage('skipWaiting');
      },
      galleryFilter(recipe) {
        let textFilter = recipe.recipe_name.toLowerCase().includes(this.filter.toLowerCase())
        let favoritesFilter = !this.favoritesFilter || this.favorites['Favoriten'].includes(recipe.recipe_uuid) 
        return textFilter && favoritesFilter
      },
      toggleFav(recipe) {
        console.log( xor(this.favorites['Favoriten'], [recipe.recipe_uuid]))
        this.$store.dispatch('setFavorites', {list:'Favoriten', favorites:xor(this.favorites['Favoriten'], [recipe.recipe_uuid])})
      }
    }
  }

</script>

<style lang="scss">
  @mixin fluid-aspect($ratio: 1 1, $selector: "> :first-child") {
    $selector: unquote($selector);

    padding-bottom: percentage(nth($ratio, 2) / nth($ratio, 1));
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
    outline:none !important;
    box-shadow: none !important;
  }

  button {
    outline:none !important;
    box-shadow: none !important;
  }
</style>