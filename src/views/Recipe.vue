<template>
  <div id="recipe">
    <Navbar @input="selected=$event" :recipes_list="recipes_list" :selected="selected">
    </Navbar>
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
import RecipeHelper from '@/mixins/RecipeHelper'
import Navbar from '@/components/Navbar.vue'

import $ from 'jquery'

export default {
  name: 'Recipe',
  mixins: [RecipeHelper],
  components: {
    Navbar
  },
  data () {
    return {  
      do_recalc: true,  //replace default value
    }
  },
  created() {
    if(this.$route.params.id) {
      this.selected = this.$route.params.id;
    }
  },
  
  mounted () {
    //add some extra layout magic on collapsing the ingredients sidebar
    $('#ingredients').on('hide.bs.collapse', function () {
      $("#arrow-ing").addClass("rotate180");
      $("#steps").addClass("full");
    });
    $('#ingredients').on('show.bs.collapse', function () {
      $("#arrow-ing").removeClass("rotate180");
      $("#steps").removeClass("full");
    });

    //hide ingredients sidebar on default in portrait mode
    let x = window.matchMedia("(max-width: 812px)")
    if (x.matches) {
      $('#ingredients').collapse();
    }
  },
  computed : {

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
  methods: {
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
