<template>
  <div id="recipe">
    <Navbar @input="selected=$event" :recipes_list="recipes_list" :selected="selected">
      <button v-if="updateExists" @click="refreshApp">
        New version available! Click to update
      </button>
    </Navbar>
    <b-container fluid>
      <h2>Galerie</h2>
      <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4">  
        <div v-for="(recipe, index) in recipes" :key="index" class="col mb-4">
          <b-link :to="{ path: '/recipe/'+index }">
            <RecipeCard class='cardAspect' :recipe="recipe" :index="index"></RecipeCard>
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
    },
    data() {
      return {
        refreshing: false,
        registration: null,
        updateExists: false,
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
    methods: {
      showRefreshUI (e) {
        this.registration = e.detail;
        this.updateExists = true;
      },
      refreshApp () {
        this.updateExists = false;  if (!this.registration || !this.registration.waiting) { return; }
        this.registration.waiting.postMessage('skipWaiting');
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