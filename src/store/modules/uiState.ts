// UI State persistence for better navigation UX
interface GalleryState {
  filter: string
  selectedTags: string[]
  scrollPosition: number
}

interface RecipeViewState {
  showIngredients: boolean
}

interface UIState {
  gallery: GalleryState
  recipe: RecipeViewState
}

const state: UIState = {
  gallery: {
    filter: '',
    selectedTags: [],
    scrollPosition: 0
  },
  recipe: {
    showIngredients: true
  }
}

const getters = {
  galleryFilter: (state: UIState) => state.gallery.filter,
  gallerySelectedTags: (state: UIState) => state.gallery.selectedTags,
  galleryScrollPosition: (state: UIState) => state.gallery.scrollPosition,
  recipeShowIngredients: (state: UIState) => state.recipe.showIngredients
}

const mutations = {
  SET_GALLERY_FILTER(state: UIState, filter: string) {
    state.gallery.filter = filter
  },
  SET_GALLERY_SELECTED_TAGS(state: UIState, tags: string[]) {
    state.gallery.selectedTags = tags
  },
  SET_GALLERY_SCROLL_POSITION(state: UIState, position: number) {
    state.gallery.scrollPosition = position
  },
  SET_RECIPE_SHOW_INGREDIENTS(state: UIState, show: boolean) {
    state.recipe.showIngredients = show
  },
  RESTORE_UI_STATE(state: UIState, savedState: Partial<UIState>) {
    if (savedState) {
      state.gallery = { ...state.gallery, ...savedState.gallery }
      state.recipe = { ...state.recipe, ...savedState.recipe }
    }
  }
}

const actions = {
  setGalleryFilter({ commit, state }: any, filter: string) {
    commit('SET_GALLERY_FILTER', filter)
    saveToLocalStorage(state)
  },
  setGallerySelectedTags({ commit, state }: any, tags: string[]) {
    commit('SET_GALLERY_SELECTED_TAGS', tags)
    saveToLocalStorage(state)
  },
  setGalleryScrollPosition({ commit, state }: any, position: number) {
    commit('SET_GALLERY_SCROLL_POSITION', position)
    saveToLocalStorage(state)
  },
  setRecipeShowIngredients({ commit, state }: any, show: boolean) {
    commit('SET_RECIPE_SHOW_INGREDIENTS', show)
    saveToLocalStorage(state)
  },
  restoreUIState({ commit }: any) {
    const savedState = localStorage.getItem('my-cookbook-ui-state')
    if (savedState) {
      try {
        commit('RESTORE_UI_STATE', JSON.parse(savedState))
      } catch (e) {
        console.error('Failed to restore UI state:', e)
      }
    }
  }
}

function saveToLocalStorage(state: UIState): void {
  try {
    localStorage.setItem('my-cookbook-ui-state', JSON.stringify(state))
  } catch (e) {
    console.error('Failed to save UI state:', e)
  }
}

export default {
  state,
  getters,
  mutations,
  actions
}
