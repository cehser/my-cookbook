<template>
  <div id="recipe">
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark sticky-top">
      <a class="navbar-brand" href="#">Kochbuch</a>
      <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#mainmenu" aria-controls="mainmenu" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div id="mainmenu" class="collapse navbar-collapse">
        <ul class="navbar-nav">
          <li class="nav-item">
              <router-link class="nav-link" to="/">Home</router-link>
          </li>
          <li class="nav-item active">
              <router-link class="nav-link" to="/edit">Bearbeiten</router-link>
          </li>
        </ul>
        <form class="form-inline">
          <b-form-select class="form-control mr-sm-2" v-model.number="selected" :options="recipes_list"></b-form-select>
        </form>    
      </div>
    </nav>
    <div class="wrapper">
      <div id="steps" class="card rounded-0">
        <div id="collapesebutton" class="ml-auto">
          <div class="fs-3 mb-3">
            <button class="btn rounded-0 shadow-none" type="button" data-toggle="collapse" data-target="#ingredients" aria-expanded="false" aria-controls="ingredients">
              <b-icon id="arrow-ing" icon="arrow-right-square-fill"  variant="dark" font-scale="1.5"></b-icon>
            </button>
          </div>
        </div>
        <div id="recipe_title_container">
          <img class="card-img-top rounded-0" id="recipe_img" :src="current_recipe.imageurl" alt="Card image cap">
          <div class="card-body" id="recipe_title">
            <h2 class="card-title d-flex flex-row flex-wrap justify-content-between">
              <div>
                {{current_recipe.recipe_name}}
              </div>
            </h2>
            <p class="card-text">{{current_recipe.subtitle}}</p>
          </div>
        </div>
        <div class="card-body">
          <h3>Zubereitung</h3>
          <div v-for="(section, index) in current_recipe.sections" :key="index">
            <h4>{{ section.section }}</h4>
            <ol class="list-group list-group-numbered list-group-flush">
              <li class="list-group-item" v-for="(step, index) in (current_recipe.steps.filter(x => x.section == section.section))" :key="index" :data-section="section.section" @click="selectStep">
                {{step.step}} 
              </li>
            </ol>
          </div>
        </div>
        
      </div>
      <div id="ingredients" class="w-25 collapse show width card rounded-0">
        <div class="card-header">  
          <h3 class="card-title">Zutaten</h3>
          <div class="card-subtitle">für {{yields_value | formatNumbers}} {{yields_unit}}</div>
        </div>
        <div class="card-body">
          <div v-for="(section, index) in current_recipe.sections" :id="'box-ing-' + section.section" class="ingredients-section" :key="index">
            <h4>{{ section.section }}</h4>
            <div class="row" v-for="(ingredient, index) in (current_recipe.ingredients.filter(x => x.section == section.section))" :key="index">
              <div class="col-4">
                {{ingredient[Object.keys(ingredient)[0]].amounts[0].amount | formatNumbers}} {{ingredient[Object.keys(ingredient)[0]].amounts[0].unit}}
              </div>  
              <div class="col-8">
                {{Object.keys(ingredient)[0]}}
              </div>  
            </div>
          </div>
          <p>
            <h5 class="card-title">Umrechnen</h5>
            <div class="input-group">
              <input type="number" min="0" v-model.number="yields_value" step=".1" class="form-control" aria-label="Sizing example input" aria-describedby="inputGroup-sizing">
              <div class="input-group-append">
                <span class="input-group-text" id="inputGroup-sizing">{{yields_unit}}</span>
                
              </div>
            </div>
          
        </div>
        <div class="card-body">
          
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// @ is an alias to /src
import helper from '@/mixins/helper'
import $ from 'jquery'
import jsyaml from 'js-yaml'  
//import { createClient } from "webdav/web"

export default {
  name: 'Recipe',
  mixins: [helper],
  components: {
    
  },
  data () {
    return {
      recipes: [{}],
      file:null,     //used for file upload
      selected: 0,
      current_recipe: null,
      do_recalc: true, //enable amounts recalculation
      
      webdav: {
        webdav_creds: {
          username: "user",
          password: "pass"
        },
        webdav_url: "https://webdav.server",
        filepath: "/cookbook.yaml"
      }
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

    if (localStorage.getItem('webdav')) {
      this.webdav  = JSON.parse(localStorage.getItem('webdav'));
    } 

    this.recipes[this.selected].sections = this.recipes[this.selected].sections || [];

    this.current_recipe = this.deepCopyYaml(this.recipes[this.selected]);
  },
  mounted () {
    $('#ingredients').on('hide.bs.collapse', function () {
      $("#arrow-ing").addClass("rotate180");
      $("#steps").addClass("full");
    });
    $('#ingredients').on('show.bs.collapse', function () {
      $("#arrow-ing").removeClass("rotate180");
      $("#steps").removeClass("full");
    });
  },
  computed : {
    recipes_list: function() {
      //return this.recipes.map((val,idx) => {value: idx, text: val.recipe_name});
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
  filters: {
    formatNumbers: function(value) {
      if (typeof value !== "number") {
            return value;
        }
      return Number(value).toLocaleString('de-DE', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
      });
    }
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
  methods: {
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
    selectStep: function(ev) {
      let doHighlight=!$(ev.target).hasClass("list-group-item-primary");

      $('#steps .list-group-item').removeClass("list-group-item-primary");
      $(ev.target).toggleClass("list-group-item-primary", doHighlight);

      $('#ingredients .ingredients-section').removeClass("highlighted list-group-item-primary border-primary");
      $('#box-ing-'+ ev.target.dataset.section).toggleClass("highlighted list-group-item-primary border-primary", doHighlight);
    },
    toast: function(content,variant)  {
      this.$bvToast.toast(content, {
        toaster: 'b-toaster-bottom-left',
        // solid: true,
        appendToast: true,
        noCloseButton: true,
        variant: variant
      });
    },
    loadSample: function (){
      this.loadYamlRecipe(this.sample_recipe);
    },
    loadYamlRecipe: function (content) {
      let recipe = this.initRecipe(jsyaml.load(content));
      this.appendRecipe(recipe);
    },
    loadYamlFull: function (content) {
      this.recipes = this.loadYamlCookbook(content);
    },
    loadYamlCookbook: function(content) {
      let recipes = jsyaml.load(content);
      recipes.forEach( recipe => {this.initRecipe(recipe)});
      return recipes;
    },
    appendRecipe: function(recipe) {
      this.selected = this.recipes.push(recipe) - 1;
    },
  }
}
</script>

<style scoped>
  .list-group-numbered { list-style: decimal inside; }
  .list-group-alpha { list-style: lower-alpha inside; }
  .list-group-roman { list-style: lower-roman inside; }
  .list-group-alpha >li, .list-group-numbered >li { display: list-item }


  .collapsing.width {
    -webkit-transition-property: width, visibility;
    transition-property: width, visibility;
    width: 0;
    height: auto;
    transition-property: height, visibility;
    -webkit-transition-duration: 0.35s;
    transition-duration: 0.35s;
    -webkit-transition-timing-function: ease;
    transition-timing-function: ease;
  }


  .card img {
  }

  svg.rotate180 {
    transform: rotate(180deg);
  }

  .wrapper {
    display: flex;
    width: 100%;
  }

  #ingredients {
    min-width: 20em;
    max-width: 20em;
    position: fixed;
    top: 56px;
    right: 0;
    height: calc(100vh - 56px);
    z-index: 999;
    /*transition: all 0.3s;*/
    transition: all 0s;
    overflow-y: auto;
  }

  #collapesebutton {
    position: sticky;
    right: 0;
    top: 56px;
    width: 3em;
    height: 0;
    z-index: 255;
  }

  #steps {
    width: calc(100% - 20em);
  }

  #steps.full {
    width: 100%;
  }

  #recipe_title_container {
    position: relative;
  }

  #recipe_img {  
    max-height: 60vh;
    object-fit: cover; /* Do not scale the image */
    object-position: center; /* Center the image within the element */
    width: 100%;
    
    margin:auto;
    /*max-height: 250px;
    max-width:75vh;
    margin-bottom: 1rem;*/
  }

  #recipe_title {
    width:100%;
    position: absolute;
    bottom: 0;
    background-color: rgba(230, 230, 230,0.6)
  }

  .my-toast {
    position: fixed;
    bottom: 2em;
    left: 2em;
  }


  h3,h4,h5, .h3, .h4, .h5 {
    /*margin-top: .5rem;*/
    margin-bottom: .1rem;
  }

  .ingredients-section  {
    margin: -0.25rem;  
    padding: 0.25rem;
    margin-bottom: 0.5em;
  }
</style>
