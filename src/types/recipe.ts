export interface Recipe {
  recipe_uuid:string,
  recipe_name:string,
  subtitle:string,
  author?:string,
  bake_time?:string,
  
  cloud_images:Array<string>,
  imageurl:string,
  lastUpdated:Date,
  recalc_exp:number,
  
  source_book?:string,
  source_url?:string,

  ingredients:Object,
  steps: Array<RecipeStep>,
  yields: Array<Object>,
  sections:Array<{section:string}>,
}

export interface RecipeStep {
  step:string,
  section:string
}