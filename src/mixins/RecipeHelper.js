/*eslint no-unused-labels: "warn"*/
import { mapState } from 'vuex'
import DeepCopy from '../js/deepCopy'

export default {
  props: {
    selected: {
      type: Number,
      default: 0
    }
  },
  data () {
    return {
      current_recipe: null,
      do_recalc: true, //enable amounts recalculation
    }
  },
  created() {
    //normalize recipe
    //this.recipes[this.selected].sections = this.recipes[this.selected].sections || [];
    this.loadRecipe(this.recipes[this.selected]);
  },
  watch: {
    recipes :{
      deep: true,
      //update qr code
      handler() {
        // updating current recipe leads to problems like unwantedly changing the amounts calculation
        // this.loadRecipe(this.recipes[this.selected]);
      }
    }
  },
  computed: {
    ...mapState([
      'recipes',
      'recipe_pictures'
    ]),
    recipes_list: function() {
      return this.recipes.map((val,idx) => ({value: idx, text: val.recipe_name}));
    },
    picture_src: function() {
      return this.recipePictureSrc(this.current_recipe)
    },
    yields_unit: { 
      get() {
      if(!!this.current_recipe && !!(this.current_recipe.yields)) {
        return Object.keys(this.current_recipe.yields[0])[0];          
        } else {
          return 'Units'
        }
      }, set(newUnit) {
        if(!!this.current_recipe && !!(this.current_recipe.yields)) {
          let oldUnit = Object.keys(this.current_recipe.yields[0])[0];
          let value = this.yields_value;
          delete this.current_recipe.yields[0][oldUnit];
          this.current_recipe.yields[0][newUnit] = value;
        } 
      } 
    }, 
    yields_value: {
      get() {
        if(!!this.current_recipe && !!(this.current_recipe.yields)) {
          return this.current_recipe.yields[0][this.yields_unit];
        } else {
          return 1;
        }
      },
      set(val) {
        if(!!this.current_recipe && !!(this.current_recipe.yields) && val > 0) {
          let oldVal = this.current_recipe.yields[0][this.yields_unit];


          this.current_recipe.yields[0][this.yields_unit] = val;
          
          if(this.do_recalc) {
            this.calcNewAmounts(oldVal); 
          }
        }
      }
    },
    section_names: function() {
      return this.current_recipe.sections.map( x =>  x.section );
    }
  },
  methods: {   
    recipePictureSrc (recipe) {
      if(recipe.cloud_images && recipe.cloud_images[0] && this.recipe_pictures[recipe.recipe_uuid] && this.recipe_pictures[recipe.recipe_uuid][0]) {
        let filename = recipe.cloud_images[0]
        let picturesByName = this.recipe_pictures[recipe.recipe_uuid].reduce((map, file) => {
          map[file.name] = file
          return map
        }, {})

        return URL.createObjectURL(picturesByName[filename])
      }
      else if(recipe.imageurl && recipe.imageurl.localeCompare("") != 0) {
        return new URL(recipe.imageurl, location.toString()).href
      }
      else {
        return new URL("/placeholder-image.png", location.toString()).href
      }

    },
    loadRecipe (recipe) {
      this.current_recipe = DeepCopy.deepCopyYaml(recipe);
    },
    swapElements(array, index1, index2) {
      let el1 = array.splice(index1, 1, array[index2]);
      array.splice(index2, 1, el1[0]);
    },
    calcNewAmounts: function(oldYield) {
      let newYield = this.yields_value;
      let exp=1;
      if(this.current_recipe.recalc_exp) {
        exp=this.current_recipe.recalc_exp;
      }
    
      this.current_recipe.ingredients.forEach( function(ingredient) {
        let name = Object.keys(ingredient)[0];

        if (typeof ingredient[name].amounts[0].amount == "number") {            
          ingredient[name].amounts[0].amount = ingredient[name].amounts[0].amount * Math.pow(newYield,exp)/Math.pow(oldYield,exp);
        }  
      });
    },
  }
};