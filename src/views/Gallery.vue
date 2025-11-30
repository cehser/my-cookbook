<template>
  <div id="recipe">
    <Navbar @input="selected=$event" :recipes_list="recipes_list" :selected="selected" :read_only="settings.read_only">
      <BButton v-if="updateExists" @click="refreshApp">
        New version available! Click to update
      </BButton>
    </Navbar>
    <BContainer fluid>
      <h2 class="mt-2 mb-0">Galerie</h2>
      <div class="d-inline-flex mt-2">
        <BInputGroup prepend="Filter">
          <BFormInput v-model="filter" type="text"></BFormInput>
          <template #append>
            <BButton @click="filter=''">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x" viewBox="0 0 16 16">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
              </svg>
            </BButton>
          </template>
        </BInputGroup>
      </div> 
      <div class="row row-cols-1 row-cols-sm-2 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 mt-2">  
        <div v-for="(recipe, index) in recipes" :key="index" class="col mb-4" v-show="recipe.recipe_name.toLowerCase().includes(filter.toLowerCase())">
          <BLink :to="{ path: '/recipe/'+index }">
            <RecipeCard class='cardAspect' :recipe="recipe" :picture_src="recipePictureSrc(recipe)" :index="index" :highlight="filter" :read_only="settings.read_only"></RecipeCard>
          </BLink>
        </div>
      </div>
    </BContainer>
  </div>
</template>

<script>
  // @ is an alias to /src
  import RecipeHelper from '@/mixins/RecipeHelper'
  import Navbar from '@/components/Navbar.vue'
  import RecipeCard from '@/components/RecipeCard.vue'
  import { mapState } from 'vuex'

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
        filter: ''
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
        'settings'
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
</style>