import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { useStore } from 'vuex'
import { deepCopyYaml } from '@/js/deepCopy'
import type { Recipe, RecipePictures } from '@/types/recipe'

interface RecipeHelperOptions {
  selected: Ref<number>
}

interface RecipeHelperReturn {
  current_recipe: Ref<Recipe | null>
  do_recalc: Ref<boolean>
  recipes_list: ComputedRef<Array<{ value: number; text: string }>>
  picture_src: ComputedRef<string>
  yields_unit: ComputedRef<string>
  yields_value: ComputedRef<number>
  section_names: ComputedRef<string[]>
  recipePictureSrc: (recipe: Recipe) => string
  loadRecipe: (recipe: Recipe) => void
  swapElements: (array: any[], index1: number, index2: number) => void
  calcNewAmounts: (oldYield: number) => void
  setYieldsUnit: (newUnit: string) => void
  setYieldsValue: (val: number) => void
}

/**
 * Composable for recipe helper functionality
 * Provides recipe loading, picture handling, and yield calculation
 */
export function useRecipeHelper(options: RecipeHelperOptions): RecipeHelperReturn {
  const store = useStore()
  const current_recipe = ref<Recipe | null>(null)
  const do_recalc = ref(true) // enable amounts recalculation

  // Computed properties from Vuex store
  const recipes = computed(() => store.state.recipes as Recipe[])
  const recipe_pictures = computed(() => store.state.recipe_pictures as RecipePictures)

  // Initialize recipe on mount
  if (recipes.value && recipes.value[options.selected.value]) {
    loadRecipe(recipes.value[options.selected.value])
  }

  // Watch for recipe changes
  watch(
    recipes,
    () => {
      // Updating current recipe leads to problems like unwantedly changing the amounts calculation
      // loadRecipe(recipes.value[options.selected.value])
    },
    { deep: true }
  )

  // Computed: List of recipes for dropdown
  const recipes_list = computed(() => {
    return recipes.value.map((val, idx) => ({
      value: idx,
      text: val.recipe_name
    }))
  })

  // Computed: Picture source for current recipe
  const picture_src = computed(() => {
    if (!current_recipe.value) return ''
    return recipePictureSrc(current_recipe.value)
  })

  // Computed: Yields unit (getter only, setter via setYieldsUnit)
  const yields_unit = computed(() => {
    if (current_recipe.value?.yields && current_recipe.value.yields.length > 0) {
      return Object.keys(current_recipe.value.yields[0])[0]
    }
    return 'Units'
  })

  // Computed: Yields value (getter only, setter via setYieldsValue)
  const yields_value = computed(() => {
    if (current_recipe.value?.yields && current_recipe.value.yields.length > 0) {
      return current_recipe.value.yields[0][yields_unit.value] as number
    }
    return 1
  })

  // Computed: Section names
  const section_names = computed(() => {
    if (!current_recipe.value) return []
    return current_recipe.value.sections.map(x => x.section)
  })

  /**
   * Get the picture source URL for a recipe
   */
  function recipePictureSrc(recipe: Recipe): string {
    if (
      recipe.cloud_images &&
      recipe.cloud_images[0] &&
      recipe_pictures.value[recipe.recipe_uuid] &&
      recipe_pictures.value[recipe.recipe_uuid][0]
    ) {
      const filename = recipe.cloud_images[0]
      const picturesByName = recipe_pictures.value[recipe.recipe_uuid].reduce((map, file) => {
        map[file.name] = file
        return map
      }, {} as Record<string, File>)

      const file = picturesByName[filename]
      // Check if file is a Blob/File object
      if (file instanceof Blob) {
        return URL.createObjectURL(file)
      }
    }

    if (recipe.imageurl && recipe.imageurl.localeCompare('') !== 0) {
      return new URL(recipe.imageurl, location.toString()).href
    }

    return new URL('/placeholder-image.png', location.toString()).href
  }

  /**
   * Load a recipe (creates a deep copy)
   */
  function loadRecipe(recipe: Recipe): void {
    current_recipe.value = deepCopyYaml(recipe)
  }

  /**
   * Swap two elements in an array
   */
  function swapElements(array: any[], index1: number, index2: number): void {
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
      const name = Object.keys(ingredient)[0]
      const ingredientData = ingredient[name]

      if (
        typeof ingredientData !== 'string' &&
        ingredientData.amounts &&
        ingredientData.amounts[0] &&
        typeof ingredientData.amounts[0].amount === 'number'
      ) {
        ingredientData.amounts[0].amount =
          (ingredientData.amounts[0].amount * Math.pow(newYield, exp)) / Math.pow(oldYield, exp)
      }
    })
  }

  /**
   * Set the yields unit
   */
  function setYieldsUnit(newUnit: string): void {
    if (current_recipe.value?.yields && current_recipe.value.yields.length > 0) {
      const oldUnit = Object.keys(current_recipe.value.yields[0])[0]
      const value = yields_value.value
      delete current_recipe.value.yields[0][oldUnit]
      current_recipe.value.yields[0][newUnit] = value
    }
  }

  /**
   * Set the yields value
   */
  function setYieldsValue(val: number): void {
    if (current_recipe.value?.yields && current_recipe.value.yields.length > 0 && val > 0) {
      const oldVal = current_recipe.value.yields[0][yields_unit.value] as number

      current_recipe.value.yields[0][yields_unit.value] = val

      if (do_recalc.value) {
        calcNewAmounts(oldVal)
      }
    }
  }

  return {
    current_recipe,
    do_recalc,
    recipes_list,
    picture_src,
    yields_unit,
    yields_value,
    section_names,
    recipePictureSrc,
    loadRecipe,
    swapElements,
    calcNewAmounts,
    setYieldsUnit,
    setYieldsValue
  }
}
