<template>
  <div id="recipe">
    <Navbar @input="selected=$event" :recipes_list="recipes_list" :selected="selected" :read_only="settings.read_only">
    </Navbar>
    <div class="wrapper">
      <div id="steps" class="card rounded-0" :class="{ 'full': stepsFullWidth }">
        <div id="collapesebutton" class="ml-auto">
          <div class="fs-3 mb-3">
            <button class="btn rounded-0 shadow-none" type="button" @click="toggleIngredients" aria-expanded="false" aria-controls="ingredients">
              <i id="arrow-ing" class="bi bi-arrow-right-square-fill" :class="{ 'rotate180': !showIngredients }" style="font-size: 1.5rem;"></i>
            </button>
          </div>
        </div>
        <div id="recipe_title_container">
          <img class="card-img-top rounded-0" id="recipe_img" :src="picture_src" alt="Card image cap">
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
          <div v-for="(section, sectionIndex) in current_recipe.sections" :key="'section-' + sectionIndex">
            <h4>{{ section.section }}</h4>
            <ul class="list-group list-group-numbered list-group-flush">
              <li class="list-group-item" v-for="(step, stepIndex) in (current_recipe.steps.filter(x => x.section == section.section))" :key="'step-' + stepIndex" :data-section="section.section" :data-step-number="getStepNumber(section.section, stepIndex)" @click="selectStep">
                {{step.step}} 
              </li>
            </ul>
          </div>
        </div>
        
      </div>
      <div id="ingredients" class="w-25 width card rounded-0" v-show="showIngredients" :class="{ 'show': showIngredients }">
        <div class="card-header">  
          <h3 class="card-title">Zutaten</h3>
          <div class="card-subtitle">für {{formatNumbers(yields_value)}} {{yields_unit}}</div>
        </div>
        <div class="card-body">
          <div v-for="(section, index) in current_recipe.sections" :id="'box-ing-' + section.section" class="ingredients-section" :key="index">
            <h4>{{ section.section }}</h4>
            <div class="row" v-for="(ingredient, index) in (current_recipe.ingredients.filter(x => x.section == section.section))" :key="index">
              <div class="col-4">
                {{formatNumbers(ingredient[Object.keys(ingredient)[0]].amounts[0].amount)}} {{ingredient[Object.keys(ingredient)[0]].amounts[0].unit}}
              </div>  
              <div class="col-8">
                {{Object.keys(ingredient)[0]}}
              </div>  
            </div>
          </div>
          
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
import { mapState } from 'vuex'

export default {
  name: 'Recipe',
  mixins: [RecipeHelper],
  components: {
    Navbar
  },
  data () {
    return {  
      do_recalc: true,  //replace default value
      showIngredients: true  // control ingredients panel visibility
    }
  },
  mounted () {
    //hide ingredients sidebar on default in portrait mode
    let x = window.matchMedia("(max-width: 812px)")
    if (x.matches) {
      this.showIngredients = false;
    }
  },
  computed: {
    ...mapState([
      'settings',
    ]),
    stepsFullWidth() {
      return !this.showIngredients;
    }
  },
  methods: {
    formatNumbers: function(value) {
      if (typeof value !== "number") {
            return value;
        }
      return Number(value).toLocaleString('de-DE', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
      });
    },
    getStepNumber: function(sectionName, stepIndex) {
      let count = 1;
      for (let section of this.current_recipe.sections) {
        if (section.section === sectionName) {
          return count + stepIndex;
        }
        count += this.current_recipe.steps.filter(x => x.section === section.section).length;
      }
      return count;
    },
    toggleIngredients() {
      this.showIngredients = !this.showIngredients;
    },
    selectStep: function(ev) {
      let doHighlight = !ev.target.classList.contains("list-group-item-primary");

      // Remove highlight from all steps
      document.querySelectorAll('#steps .list-group-item').forEach(el => {
        el.classList.remove("list-group-item-primary");
      });
      ev.target.classList.toggle("list-group-item-primary", doHighlight);

      // Remove highlight from all ingredient sections
      document.querySelectorAll('#ingredients .ingredients-section').forEach(el => {
        el.classList.remove("highlighted", "list-group-item-primary", "border-primary");
      });
      
      const section = ev.target.dataset.section;
      const ingredientBox = document.querySelector('#box-ing-' + section);
      if (ingredientBox) {
        ingredientBox.classList.toggle("highlighted", doHighlight);
        ingredientBox.classList.toggle("list-group-item-primary", doHighlight);
        ingredientBox.classList.toggle("border-primary", doHighlight);
      }
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
  .list-group-alpha { list-style: lower-alpha inside; }
  .list-group-roman { list-style: lower-roman inside; }
  .list-group-alpha >li { display: list-item }


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
