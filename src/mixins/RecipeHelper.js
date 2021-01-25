/*eslint no-unused-labels: "warn"*/

const jsyaml = require('js-yaml');
export default {
  data () {
    return {
      recipes: [{}],
      selected: 0,
      current_recipe: null,
      do_recalc: true, //enable amounts recalculation
      new_recipe_de:  `
        ingredients: []
        steps: []
        sections: []
        recipe_name: Neues Rezept
        imageurl: ./placeholder-image.png
        yields:
          - Portionen: 4
        recalc_exp: 1
      `,
      sample_recipe: `
        ingredients:
          - apple:
              usda_num: 09003
              amounts:
                  - amount: 1
                    unit: each
              processing:
                  - whole
                  - raw
              substitutions:
                  - pears:
                      usda_num: 09252
                      amounts:
                          - amount: 1
                            unit: each
              notes:
                  - Use whole apples
                  - Apples may be substituted, but produce a different flavor and mouthfeel
          - pear:
              usda_num: 09003
              amounts:
                  - amount: 1
                    unit: each
              processing:
                  - whole
                  - raw
              substitutions:
                  - pears:
                      usda_num: 09252
                      amounts:
                          - amount: 1
                            unit: each
              notes:
                  - Use whole pears
                  - Pears may be substituted, but produce a different flavor and mouthfeel
        steps:
          - step:
                Gather the apples.
            haccp:
                control_point: The apples must be clean
            notes:
                - Some people like green
                - Some people like red
          - step:
                Hand out the apples.
            haccp:
                critical_control_point: Wash hands with soap and warm water before distributing.
      `
    }
  },
  created() {
    if (localStorage.getItem('recipes')) {
      try {
        this.loadYamlFull(localStorage.getItem('recipes'));
      } catch(e) {
        console.log(e)
        localStorage.removeItem('recipes');
        this.loadSample();
      }
    }
    else  {
      this.loadSample();
    }
    if (localStorage.getItem('selected')) {
      this.selected  = Math.min(localStorage.getItem('selected'), this.recipes.length - 1);
    } 

    this.recipes[this.selected].sections = this.recipes[this.selected].sections || [];

    this.current_recipe = this.deepCopyYaml(this.recipes[this.selected]);
  },
  watch: {
    selected: function (val) {
       localStorage.setItem('selected', val);
       if(this.recipes[val]) {
         document.title = "Kochbuch: " + this.recipes[val].recipe_name;  
         this.current_recipe = this.deepCopyYaml(this.recipes[val]);
       }
    }
  },
  computed: {
       recipes_list: function() {
      return this.recipes.map((val,idx) => ({value: idx, text: val.recipe_name}));
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
    generateUUID() { // Public Domain/MIT
      let d = new Date().getTime();
      if (typeof performance !== 'undefined' && typeof performance.now === 'function'){
        d += performance.now(); //use high-precision timer if available
      }
      let newGuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        let r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
      
      return newGuid;
    },
    initRecipe(recipe) {
      //set default values
      recipe.sections     = recipe.sections ||  [{section:""}];
      recipe.sections     = (recipe.sections.length > 0) ? recipe.sections : [{section:""}];
      recipe.steps        = recipe.steps || [];
      recipe.ingredients  = recipe.ingredients || [];
      recipe.recipe_uuid  = recipe.recipe_uuid || this.generateUUID();
      recipe.lastUpdated  = recipe.lastUpdated || new Date();

      recipe.ingredients.forEach(ingredient => {
        ingredient.section = ingredient.section || "";
      });

      recipe.steps.forEach(step => {
        step.section = step.section || "";
      });

      return recipe;
    },
    // find local recipe by uuid, replace it by remote if newer
    // add remote recipe if not found locally
    mergeCoobooks(local, remote) {
      remote.forEach( remoteRecipe => {
        let localIndex  = local.findIndex(x => x.recipe_uuid === remoteRecipe.recipe_uuid);
        let localRecipe = local[localIndex];
        //replace also if remote == local to replace unsaved local changes

        console.log(localRecipe.lastUpdated);
        console.log(remoteRecipe.lastUpdated);
        console.log('Local not newer: ' + !(localRecipe.lastUpdated > remoteRecipe.lastUpdated));
        if(localIndex != -1 && !(localRecipe.lastUpdated > remoteRecipe.lastUpdated)) {
          local.splice(localIndex, 1, remoteRecipe);
          console.log('Local replaced');
        }
        else if(localIndex === -1) {
          local.push(remoteRecipe);
        }
        
      });
      return local;
    },
    deepCopyYaml(src) {
      return jsyaml.load(jsyaml.dump(src));
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
    loadSample: function (){
      this.loadYamlRecipe(this.sample_recipe);
    },
    appendRecipe: function(recipe) {
      this.selected = this.recipes.push(recipe) - 1;
    },
    loadYamlRecipe: function (content) {
      let recipe = this.initRecipe(jsyaml.load(content));
      this.appendRecipe(recipe);
    },
    loadYamlCookbook: function(content) {
      let recipes = jsyaml.load(content);
      recipes.forEach( recipe => {this.initRecipe(recipe)});
      return recipes;
    },
    loadYamlFull: function (content) {
      this.recipes = this.loadYamlCookbook(content);
    }
  }
};