<template>
  <div id="recipe">
    <Navbar @input="selected=$event" :recipes_list="recipes_list" :selected="selected" :read_only="settings.read_only">
      <BButton v-if="updateExists" @click="refreshApp">
        New version available! Click to update
      </BButton>
    </Navbar>
    <BContainer fluid>
      <h2 class="mt-2 mb-0">Galerie</h2>
      <div class="d-flex flex-wrap gap-2 mt-2">
        <BInputGroup prepend="Filter" style="max-width: 400px;">
          <BFormInput v-model="filter" type="text"></BFormInput>
          <template #append>
            <BButton @click="filter=''">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x" viewBox="0 0 16 16">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
              </svg>
            </BButton>
          </template>
        </BInputGroup>
        <div v-if="allTags.length" class="d-flex flex-wrap gap-1 align-items-center">
          <span class="text-muted small">Tags:</span>
          <span 
            v-for="tag in allTags" 
            :key="tag" 
            @click="toggleTag(tag)"
            class="badge"
            :class="selectedTags.includes(tag) ? 'bg-primary' : 'bg-secondary'"
            style="cursor: pointer;">
            {{ tag }}
          </span>
          <BButton v-if="selectedTags.length" @click="selectedTags = []" size="sm" variant="outline-secondary">
            Alle Tags
          </BButton>
        </div>
      </div> 
      <div class="row row-cols-1 row-cols-sm-2 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 mt-2">  
        <div v-for="(recipe, index) in filteredRecipes" :key="index" class="col mb-4">
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
        filter: '',
        selectedTags: []
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
    mounted() {
      // Restore UI state
      this.$store.dispatch('restoreUIState');
      this.filter = this.$store.getters.galleryFilter;
      this.selectedTags = [...this.$store.getters.gallerySelectedTags];
      
      // Restore scroll position
      this.$nextTick(() => {
        const scrollPos = this.$store.getters.galleryScrollPosition;
        if (scrollPos > 0) {
          window.scrollTo(0, scrollPos);
        }
      });
    },
    beforeUnmount() {
      // Save scroll position before leaving
      this.$store.dispatch('setGalleryScrollPosition', window.scrollY);
    },
    watch: {
      filter(newFilter) {
        this.$store.dispatch('setGalleryFilter', newFilter);
      },
      selectedTags: {
        deep: true,
        handler(newTags) {
          this.$store.dispatch('setGallerySelectedTags', newTags);
        }
      }
    },
    computed: {
      ...mapState([
        'settings'
      ]),
      allTags() {
        const tags = new Set();
        this.recipes.forEach(recipe => {
          if (recipe.tags) {
            recipe.tags.forEach(tag => tags.add(tag));
          }
        });
        return Array.from(tags).sort();
      },
      filteredRecipes() {
        return this.recipes.filter(recipe => {
          // Text filter
          const matchesText = recipe.recipe_name.toLowerCase().includes(this.filter.toLowerCase());
          
          // Tag filter
          const matchesTags = this.selectedTags.length === 0 || 
            (recipe.tags && this.selectedTags.some(tag => recipe.tags.includes(tag)));
          
          return matchesText && matchesTags;
        });
      }
    },
    methods: {
      toggleTag(tag) {
        const index = this.selectedTags.indexOf(tag);
        if (index > -1) {
          this.selectedTags.splice(index, 1);
        } else {
          this.selectedTags.push(tag);
        }
      },
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
  @use 'sass:math';
  @use 'sass:list';
  @use 'sass:string';
  
  @mixin fluid-aspect($ratio: 1 1, $selector: "> :first-child") {
    $selector: string.unquote($selector);

    padding-bottom: math.percentage(math.div(list.nth($ratio, 2), list.nth($ratio, 1)));
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