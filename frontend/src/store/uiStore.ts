import { defineStore } from 'pinia'

interface GalleryState {
  filter: string
  selectedTags: string[]
  scrollPosition: number
  sortBy: string
}

interface RecipeViewState {
  showIngredients: boolean
}

export const useUIStore = defineStore('ui', {
  state: () => ({
    gallery: {
      filter: '',
      selectedTags: [] as string[],
      scrollPosition: 0,
      sortBy: 'name-asc',
    } as GalleryState,
    recipe: {
      showIngredients: true,
    } as RecipeViewState,
  }),

  getters: {
    galleryFilter: (state) => state.gallery.filter,
    gallerySelectedTags: (state) => state.gallery.selectedTags,
    galleryScrollPosition: (state) => state.gallery.scrollPosition,
    gallerySortBy: (state) => state.gallery.sortBy,
    recipeShowIngredients: (state) => state.recipe.showIngredients,
  },

  actions: {
    setGalleryFilter(filter: string) {
      this.gallery.filter = filter
      this._saveToLocalStorage()
    },
    setGallerySelectedTags(tags: string[]) {
      this.gallery.selectedTags = tags
      this._saveToLocalStorage()
    },
    setGalleryScrollPosition(position: number) {
      this.gallery.scrollPosition = position
      this._saveToLocalStorage()
    },
    setGallerySortBy(sortBy: string) {
      this.gallery.sortBy = sortBy
      this._saveToLocalStorage()
    },
    setRecipeShowIngredients(show: boolean) {
      this.recipe.showIngredients = show
      this._saveToLocalStorage()
    },
    restoreUIState() {
      const savedState = localStorage.getItem('my-cookbook-ui-state')
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState)
          if (parsed.gallery) {
            this.gallery = { ...this.gallery, ...parsed.gallery }
          }
          if (parsed.recipe) {
            this.recipe = { ...this.recipe, ...parsed.recipe }
          }
        } catch (e) {
          console.error('Failed to restore UI state:', e)
        }
      }
    },
    _saveToLocalStorage() {
      try {
        localStorage.setItem('my-cookbook-ui-state', JSON.stringify({
          gallery: this.gallery,
          recipe: this.recipe,
        }))
      } catch (e) {
        console.error('Failed to save UI state:', e)
      }
    },
  },
})
