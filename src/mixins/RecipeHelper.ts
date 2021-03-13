/*eslint no-unused-labels: "warn"*/
import DeepCopy from '../js/deepCopy'
import { Component, Prop, Vue } from 'vue-property-decorator'
import {  namespace } from 'vuex-class'
import { Recipe } from '@/types/recipe'

const VuexRecipes = namespace('Recipes')

@Component
export default class RecipeHelper extends Vue {
  public current_recipe: any = null
  public do_recalc: boolean = true //enable amounts recalculation

  @VuexRecipes.State recipes?:Array<Recipe>
  @VuexRecipes.State recipe_pictures?:any

  @Prop({type: Number,default: 0}) selected!: number
      
  created() {
    //normalize recipe
    //this.recipes[this.selected].sections = this.recipes[this.selected].sections || [];
    this.loadRecipe(this.recipes[this.selected]);
  }

  get picture_src() {
    return this.recipePictureSrc(this.current_recipe)
  }

  get yields_unit(): string {
    if(!!this.current_recipe && !!(this.current_recipe.yields)) {
      return Object.keys(this.current_recipe.yields[0])[0];          
    } else {
      return 'Units'
    }
  }

  set yields_unit(newUnit: string) {
    if(!!this.current_recipe && !!(this.current_recipe.yields)) {
      let oldUnit = Object.keys(this.current_recipe.yields[0])[0];
      let value = this.yields_value;
      delete this.current_recipe.yields[0][oldUnit];
      this.current_recipe.yields[0][newUnit] = value;
    } 
  } 

  get recipes_list() : Array<string> {
    return this.recipes.map((val:any,idx:number) => ({value: idx, text: val.recipe_name}));
  }

  get yields_value() :number {
    if(!!this.current_recipe && !!(this.current_recipe.yields)) {
      return this.current_recipe.yields[0][this.yields_unit];
    } else {
      return 1;
    }
  }

  set yields_value(val:number) {
    if(!!this.current_recipe && !!(this.current_recipe.yields) && val > 0) {
      let oldVal = this.current_recipe.yields[0][this.yields_unit];


      this.current_recipe.yields[0][this.yields_unit] = val;
      
      if(this.do_recalc) {
        this.calcNewAmounts(oldVal); 
      }
    }
  }

  get section_names() :Array<string> {
    return this.current_recipe.sections.map( (x:any) =>  x.section );
  }
  public recipePictureSrc (recipe:any) {
    if(recipe.cloud_images && recipe.cloud_images[0] && this.recipe_pictures[recipe.recipe_uuid] && this.recipe_pictures[recipe.recipe_uuid][0]) {
      let filename = recipe.cloud_images[0]
      let picturesByName = this.recipe_pictures[recipe.recipe_uuid].reduce((map:any, file:any) => {
        map[file.name] = file
        return map
      }, {})

      return URL.createObjectURL(picturesByName[filename])
    }
    else if(recipe.imageurl && recipe.imageurl.localeCompare("") != 0) {
      return new URL(recipe.imageurl, location.toString())
    }
    else {
      return new URL("/placeholder-image.png", location.toString())
    }

  }

  public loadRecipe (recipe:object) {
    this.current_recipe = DeepCopy.deepCopyYaml(recipe);
  }

  public swapElements(array :Array<any>, index1:number, index2:number) {
    let el1 = array.splice(index1, 1, array[index2]);
    array.splice(index2, 1, el1[0]);
  }

  public calcNewAmounts(oldYield :number) {
    let newYield = this.yields_value;
    let exp=1;
    if(this.current_recipe.recalc_exp) {
      exp=this.current_recipe.recalc_exp;
    }
  
    this.current_recipe.ingredients.forEach( function(ingredient : any) {
      let name = Object.keys(ingredient)[0];

      if (typeof ingredient[name].amounts[0].amount == "number") {            
        ingredient[name].amounts[0].amount = ingredient[name].amounts[0].amount * Math.pow(newYield,exp)/Math.pow(oldYield,exp);
      }  
    });
  }
}