import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { useRecipeStore } from '@/store/recipeStore'
import { deepCopyYaml } from '@/js/deepCopy'
import { isAuthenticated } from '@/auth/oidc'
import { imageApi } from '@/api/images'
import type { Recipe, RecipePictures } from '@/types/recipe'

interface RecipeHelperOptions {
  recipeId: Ref<string>
}

interface RecipeHelperReturn {
  current_recipe: Ref<Recipe | null>
  do_recalc: Ref<boolean>
  selected: ComputedRef<number>
  recipes_list: ComputedRef<Array<{ value: string; text: string }>>
  picture_src: ComputedRef<string>
  yields_unit: ComputedRef<string>
  yields_value: ComputedRef<number>
  section_names: ComputedRef<string[]>
  recipeThumbnailSrc: (recipe: Recipe) => string
  recipePictureSrc: (recipe: Recipe) => string
  loadRecipe: (recipe: Recipe) => void
  swapElements: <T>(array: T[], index1: number, index2: number) => void
  calcNewAmounts: (oldYield: number) => void
  setYieldsUnit: (newUnit: string) => void
  setYieldsValue: (val: number) => void
}

/**
 * Composable for recipe helper functionality
 * Provides recipe loading, picture handling, and yield calculation
 */
export function useRecipeHelper(options: RecipeHelperOptions): RecipeHelperReturn {
  const store = useRecipeStore()
  const current_recipe = ref<Recipe | null>(null)
  const do_recalc = ref(true) // enable amounts recalculation

  // Computed properties from Pinia store
  const recipes = computed(() => store.recipes)
  const recipe_pictures = computed(() => store.recipe_pictures)

  // Cache of API image IDs per recipe UUID (loaded on demand)
  const apiImageCache = ref<Record<string, string | null>>({})

  async function loadApiImages(recipeUuid: string): Promise<void> {
    if (recipeUuid in apiImageCache.value) return
    if (!await isAuthenticated()) return
    try {
      const images = await imageApi.list(recipeUuid)
      apiImageCache.value[recipeUuid] = images.length > 0 ? images[0].id : null
    } catch {
      apiImageCache.value[recipeUuid] = null
    }
  }

  // Computed: index of current recipe in store (for backwards compat)
  const selected = computed(() => {
    const id = options.recipeId.value
    if (!id) return -1
    return recipes.value.findIndex(r => r.recipe_uuid === id)
  })

  // Initialize recipe on mount
  const initIdx = selected.value
  if (initIdx >= 0 && recipes.value[initIdx]) {
    loadRecipe(recipes.value[initIdx])
  }

  // Watch for recipeId changes (e.g. navigation)
  watch(
    () => options.recipeId.value,
    () => {
      const idx = selected.value
      if (idx >= 0 && recipes.value[idx]) {
        loadRecipe(recipes.value[idx])
      }
    }
  )

  // Watch for recipes becoming available (e.g. async API load on direct URL)
  watch(recipes, () => {
    if (!current_recipe.value && options.recipeId.value) {
      const idx = selected.value
      if (idx >= 0 && recipes.value[idx]) {
        loadRecipe(recipes.value[idx])
      }
    }
  })

  // Computed: List of recipes for dropdown (value = UUID)
  const recipes_list = computed(() => {
    return recipes.value.map((val) => ({
      value: val.recipe_uuid,
      text: val.recipe_name
    }))
  })

  // Computed: Picture source for current recipe (full resolution)
  const picture_src = computed(() => {
    if (!current_recipe.value) return ''
    return recipePictureSrc(current_recipe.value)
  })

  // Computed: Yields unit (getter only, setter via setYieldsUnit)
  const yields_unit = computed(() => {
    if (current_recipe.value?.yields && current_recipe.value.yields.length > 0) {
      return current_recipe.value.yields[0].unit
    }
    return 'Units'
  })

  // Computed: Yields value (getter only, setter via setYieldsValue)
  const yields_value = computed(() => {
    if (current_recipe.value?.yields && current_recipe.value.yields.length > 0) {
      return current_recipe.value.yields[0].value
    }
    return 1
  })

  // Computed: Section names
  const section_names = computed(() => {
    if (!current_recipe.value) return []
    return current_recipe.value.sections.map(x => x.section)
  })

  /**
   * Get the thumbnail URL for a recipe (for galleries/lists).
   */
  function recipeThumbnailSrc(recipe: Recipe): string {
    return recipeImageSrc(recipe, 'thumbnail')
  }

  /**
   * Get the full-resolution image URL for a recipe (for detail view).
   */
  function recipePictureSrc(recipe: Recipe): string {
    return recipeImageSrc(recipe, 'full')
  }

  function recipeImageSrc(recipe: Recipe, size: 'thumbnail' | 'full'): string {
    const urlFn = size === 'thumbnail' ? imageApi.thumbnailUrl : imageApi.imageUrl

    // 1. Check first_image_id from API list (fastest path)
    if (recipe.first_image_id) {
      return urlFn(recipe.first_image_id)
    }

    // 2. Check API image cache (lazy-loaded)
    const cachedImageId = apiImageCache.value[recipe.recipe_uuid]
    if (cachedImageId) {
      return urlFn(cachedImageId)
    }

    // 3. External URL
    if (recipe.imageurl && recipe.imageurl.localeCompare('') !== 0) {
      return new URL(recipe.imageurl, location.toString()).href
    }

    return new URL('/placeholder-image.png', location.toString()).href
  }

  /**
   * Load a recipe (creates a deep copy).
   * If the recipe was loaded from the API list (no ingredients),
   * fetch the full detail from the backend, with IDB fallback for offline.
   */
  async function loadRecipe(recipe: Recipe): Promise<void> {
    // Set immediately with safe defaults so the template never sees null
    const safeCopy = deepCopyYaml(recipe)
    safeCopy.ingredients = safeCopy.ingredients || []
    safeCopy.steps = safeCopy.steps || []
    safeCopy.sections = safeCopy.sections || [{ section: '' }]
    current_recipe.value = safeCopy

    // API list items have empty ingredients — need to fetch detail
    if (
      (!recipe.ingredients || recipe.ingredients.length === 0) &&
      recipe.recipe_uuid
    ) {
      // API first if online and authenticated
      if (navigator.onLine && await isAuthenticated()) {
        try {
          const detail = await store.loadRecipeDetailFromApi(recipe.recipe_uuid)
          current_recipe.value = deepCopyYaml(detail)
          return
        } catch {
          // API unreachable — fall through to IDB
        }
      }
      // Fallback: IDB cache
      try {
        const { get } = await import('idb-keyval')
        const cached = await get(`recipe:${recipe.recipe_uuid}`)
        if (cached) {
          current_recipe.value = deepCopyYaml(cached as Recipe)
        }
      } catch {
        // IDB also unavailable
      }
    }
  }

  /**
   * Swap two elements in an array
   */
  function swapElements<T>(array: T[], index1: number, index2: number): void {
    const el1 = array.splice(index1, 1, array[index2])
    array.splice(index2, 1, el1[0])
  }

  /**
   * Calculate new ingredient amounts based on yield change
   */
  function calcNewAmounts(oldYield: number): void {
    if (!current_recipe.value) return

    const newYield = yields_value.value
    let exp = 1
    if (current_recipe.value.recalc_exp) {
      exp = current_recipe.value.recalc_exp
    }

    current_recipe.value.ingredients.forEach(ingredient => {
      if (
        ingredient.amounts &&
        ingredient.amounts[0] &&
        typeof ingredient.amounts[0].amount === 'number'
      ) {
        ingredient.amounts[0].amount =
          (ingredient.amounts[0].amount * Math.pow(newYield, exp)) / Math.pow(oldYield, exp)
      }
    })
  }

  /**
   * Set the yields unit
   */
  function setYieldsUnit(newUnit: string): void {
    if (current_recipe.value?.yields && current_recipe.value.yields.length > 0) {
      current_recipe.value.yields[0].unit = newUnit
    }
  }

  /**
   * Set the yields value
   */
  function setYieldsValue(val: number): void {
    if (current_recipe.value?.yields && current_recipe.value.yields.length > 0 && val > 0) {
      const oldVal = current_recipe.value.yields[0].value

      current_recipe.value.yields[0].value = val

      if (do_recalc.value) {
        calcNewAmounts(oldVal)
      }
    }
  }

  return {
    current_recipe,
    do_recalc,
    selected,
    recipes_list,
    picture_src,
    yields_unit,
    yields_value,
    section_names,
    recipeThumbnailSrc,
    recipePictureSrc,
    loadRecipe,
    swapElements,
    calcNewAmounts,
    setYieldsUnit,
    setYieldsValue
  }
}
