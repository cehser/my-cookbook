// UI State persistence for better navigation UX
const state = {
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
  galleryFilter: state => state.gallery.filter,
  gallerySelectedTags: state => state.gallery.selectedTags,
  galleryScrollPosition: state => state.gallery.scrollPosition,
  recipeShowIngredients: state => state.recipe.showIngredients
}

const mutations = {
  SET_GALLERY_FILTER(state, filter) {
    state.gallery.filter = filter
  },
  SET_GALLERY_SELECTED_TAGS(state, tags) {
    state.gallery.selectedTags = tags
  },
  SET_GALLERY_SCROLL_POSITION(state, position) {
    state.gallery.scrollPosition = position
  },
  SET_RECIPE_SHOW_INGREDIENTS(state, show) {
    state.recipe.showIngredients = show
  },
  RESTORE_UI_STATE(state, savedState) {
    if (savedState) {
      state.gallery = { ...state.gallery, ...savedState.gallery }
      state.recipe = { ...state.recipe, ...savedState.recipe }
    }
  }
}

const actions = {
  setGalleryFilter({ commit }, filter) {
    commit('SET_GALLERY_FILTER', filter)
    saveToLocalStorage()
  },
  setGallerySelectedTags({ commit }, tags) {
    commit('SET_GALLERY_SELECTED_TAGS', tags)
    saveToLocalStorage()
  },
  setGalleryScrollPosition({ commit }, position) {
    commit('SET_GALLERY_SCROLL_POSITION', position)
    saveToLocalStorage()
  },
  setRecipeShowIngredients({ commit }, show) {
    commit('SET_RECIPE_SHOW_INGREDIENTS', show)
    saveToLocalStorage()
  },
  restoreUIState({ commit }) {
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

function saveToLocalStorage() {
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
