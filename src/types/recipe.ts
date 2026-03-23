export interface Amount {
  amount: string | number
  unit: string
}

export interface Ingredient {
  [name: string]: {
    amounts: Amount[]
  } | string
  section: string
}

export interface Step {
  step: string
  haccp?: Record<string, string>
  notes?: string[]
  section: string
}

export interface Section {
  section: string
}

export interface Yield {
  [key: string]: number | string
}

export interface Recipe {
  recipe_uuid: string
  recipe_name: string
  author?: string
  source_url?: string | null
  source_book?: string | null
  prep_time?: string
  cook_time?: string
  total_time?: string
  bake_time?: string
  servings?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  notes?: string
  yields?: Yield[]
  subtitle?: string
  ingredients: Ingredient[]
  steps: Step[]
  imageurl?: string | null
  recalc_exp?: number
  sections: Section[]
  lastUpdated: string
  first_image_id?: string
  tags?: string[]
}

export interface RecipePictures {
  [recipe_uuid: string]: File[]  // ✅ Use File[] instead of (Blob | File)[]
}

export interface RecipeImages {
  [recipe_uuid: string]: File[]
}
