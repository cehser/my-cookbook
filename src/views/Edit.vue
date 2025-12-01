<template>
  <div id="edit">
    <Navbar @update:selected="localSelected=$event" :recipes_list="recipes_list" :selected="localSelected" :read_only="settings.read_only">
      <li>
        <form class="form-inline">
          <BButton @click="saveRecipe"><i class="bi bi-archive-fill"></i></BButton>
        </form>
      </li>
    </Navbar>
    <BContainer v-if="current_recipe"> 
      <datalist id="ingredient-units-list">
        <option v-for="unit in ingredient_units" :key="unit" :value="unit"></option>
      </datalist>
      <h2>Rezept</h2>

      <BContainer fluid>
        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-name">Titel:</label>
          </BCol>
          <BCol sm="10">
            <BFormInput id="input-name" size="sm" placeholder="Namen eingeben" v-model="current_recipe.recipe_name"></BFormInput>
          </BCol>
        </BRow>
         <BRow class="my-1">
          <BCol sm="2">
            <label for="input-subtitle">Untertitel:</label>
          </BCol>
          <BCol sm="10">
            <BFormInput id="input-subtitle" size="sm" placeholder="Untertitel eingeben" v-model="current_recipe.subtitle"></BFormInput>
          </BCol>
        </BRow>
        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-yields-value">Ergibt Menge:</label>
          </BCol>
          <BCol sm="10">
            <BFormInput id="input-yields-value" size="sm" type="number" min="0.001" step="0.001" placeholder="100.0" v-model.number="yields_value"></BFormInput>
            <div class="custom-control custom-switch">
              <input type="checkbox" class="custom-control-input" id="recalc-switch" v-model="do_recalc">
              <label class="custom-control-label" for="recalc-switch">Umrechnen</label>
            </div>
          </BCol>
        </BRow>
        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-yields">Ergibt Einheiten:</label>
          </BCol>
          <BCol sm="10">
            <BFormInput id="input-yields" size="sm" placeholder="Enter a name" v-model="yields_unit"></BFormInput>
          </BCol>
        </BRow>
        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-recalc_exp">Umrechnungsexponent:</label>
          </BCol>
          <BCol sm="10">
            <BFormInput id="input-recalc_exp" type="number" min="1" step="1" size="sm" placeholder="1" v-model.number="current_recipe.recalc_exp"></BFormInput>
          </BCol>
        </BRow>
        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-name">Web-Foto:</label>
          </BCol>
          <BCol sm="10">
            <BFormInput id="input-name" size="sm" placeholder="https://..." v-model="current_recipe.imageurl"></BFormInput>
          </BCol>
        </BRow>
        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-tags">Tags:</label>
          </BCol>
          <BCol sm="10">
            <div class="d-flex flex-wrap gap-2 mb-2">
              <span v-for="(tag, index) in current_recipe.tags" :key="index" class="badge bg-primary">
                {{ tag }}
                <i class="bi bi-x-circle ms-1" @click="removeTag(index)" style="cursor: pointer;"></i>
              </span>
            </div>
            <div class="input-group input-group-sm">
              <BFormInput id="input-tags" size="sm" placeholder="Tag hinzufügen..." v-model="newTag" @keyup.enter="addTag"></BFormInput>
              <BButton @click="addTag" size="sm"><i class="bi bi-plus"></i></BButton>
            </div>
          </BCol>
        </BRow>
        <BRow class="my-1" v-if="recipe_pictures[current_recipe.recipe_uuid]">
          <BCol sm="2">
            <label for="input-name">Gespeichertes Foto:</label>
          </BCol>
          <BCol sm="10">
            <img :src="picture_src" height="100">
            <div class="custom-control custom-switch">
              <input type="checkbox" class="custom-control-input" id="delete_image-switch" v-model="delete_image">
              <label class="custom-control-label" for="delete_image-switch">Löschen</label>
            </div>
          </BCol>
        </BRow>
        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-foto">Foto-Upload:</label>
          </BCol>
          <BCol sm="10">
            <BInputGroup size="sm">
              <template #prepend>
                <BButton size="sm" @click="clearFile"><i class="bi bi-x"></i></BButton>
              </template>
            
              <BFormFile size="sm" id="input-foto" ref="input-foto" accept="image/*" placeholder="Datei auswählen oder ablegen" drop-placeholder="Hier ablegen" browse-text="Durchsuchen" v-model="file"></BFormFile>
            </BInputGroup>
          </BCol>
        </BRow>
        <BRow>
          <BCol sm="2">
            Upload-Vorschau
          </BCol>
          <BCol sm="10">
            <img id="image-preview" height="100">
          </BCol>
        </BRow> 
      </BContainer>
      <BContainer fluid>
        <h2>Abschnitte</h2>
        <div>
          <BRow v-for="(section, index_s) in current_recipe.sections" :key="index_s">
            <BCol cols="11"><BFormInput size="sm" placeholder="Neuer Abschnitt" v-model="section.section"></BFormInput></BCol>
            <BCol cols="1">
              <BButton @click="current_recipe.sections.splice(index_s, 1)" size="sm"><i class="bi bi-trash"></i></BButton>
              <array-reorder-btn-group :array="current_recipe.sections" :index="index_s"></array-reorder-btn-group>
            </BCol>
          </BRow>
        </div> 
        <BRow>
          <BButton @click="current_recipe.sections.push({section:''})"><i class="bi bi-plus"></i></BButton>
        </BRow> 
      </BContainer>
      <h2>Zutaten</h2>
      <div v-for="(section, index) in current_recipe.sections" :key="'sectiona-'+index">
        <section-ingredients-edit :section="section.section" :sections="section_names" v-model="current_recipe.ingredients"></section-ingredients-edit>
      </div>
      <BRow>
        <BButton @click="addIngredient"><i class="bi bi-plus"></i></BButton>
      </BRow>
      <h2>Zubereitung</h2>
      <div v-for="(section, index) in current_recipe.sections" :key="'sectionb-'+index">
        <h3>{{ section.section }}</h3>
        <div v-for="(step, stepindex) in current_recipe.steps" :key="stepindex" >
          <step-edit v-model="current_recipe.steps[stepindex]" :steps="current_recipe.steps" :sections="section_names" :index="stepindex" v-if="step.section == section.section" @delete="current_recipe.steps.splice(stepindex, 1)"></step-edit>
        </div>  
      </div>
      
      <BRow>
        <BButton @click="current_recipe.steps.push({step:'', section:''})"><i class="bi bi-plus"></i></BButton>
      </BRow>
      <h2>Code</h2>
      <BRow>
        <BFormTextarea readonly rows="10" :value="yaml"></BFormTextarea>
      </BRow>
    </BContainer>
  </div>

</template>

<script>
// @ is an alias to /src
import StepEdit from '@/components/StepEdit.vue'
import SectionIngredientsEdit from '@/components/SectionIngredientsEdit.vue'
import ArrayReorderBtnGroup from '@/components/ArrayReorderBtnGroup.vue'
import Navbar from '@/components/Navbar.vue'

import RecipeHelper from '@/mixins/RecipeHelper'
import Toast from '@/mixins/Toast'

import jsyaml from 'js-yaml'

import jp from 'jsonpath'
import deepEqual from 'deep-equal'

import { mapState } from 'vuex'

export default {
  name: 'Edit',
  mixins: [RecipeHelper,Toast],
  components: {
    StepEdit,
    SectionIngredientsEdit,
    ArrayReorderBtnGroup,
    Navbar
  },
  data() {
    return {
      file: null,
      do_recalc: false,  //replace default value
      delete_image: false,
      localSelected: this.selected,
      newTag: ''
    };
  },
  mounted() {  
    document.onkeydown = (event) => {
      //ctrl + s
      if(event.ctrlKey && event.code === "KeyS") { 
        event.preventDefault(); //do not show browser dialog
        this.saveRecipe();
      }
    }
  },
  computed: {
    yaml: function () {
        return jsyaml.dump(this.current_recipe)
    },
    ingredient_units:  function () {
      let units = new Set(['g', 'ml', 'Stück']);
      let dyn_units = jp.query(this, 'recipes[*].ingredients[*].*.amounts[*].unit');
      //console.log(dyn_units);
      
      if(dyn_units) {
        dyn_units.forEach(item => units.add(item))
      }
        return [...units].sort(); //convert to array
    },
    ...mapState([
        'settings'
      ])
  },
  watch: {
    file: function(newFile) {
      this.preview_image(newFile)
    }
  },
  methods: {
    addTag() {
      if (!this.newTag.trim()) return;
      if (!this.current_recipe.tags) {
        this.current_recipe.tags = [];
      }
      if (!this.current_recipe.tags.includes(this.newTag.trim())) {
        this.current_recipe.tags.push(this.newTag.trim());
      }
      this.newTag = '';
    },
    removeTag(index) {
      this.current_recipe.tags.splice(index, 1);
    },
    clearFile: function () {
      this.$refs['input-foto'].reset()
    },
    preview_image: function(file) {
      var preview = document.querySelector('#image-preview');
      if(file) {
         preview.src = URL.createObjectURL(file)
      }
      else {
        preview.src = ""
      }
    },
    saveRecipe: function () {
      //only update if current_recipe is really different
      console.log(this.file)
      if(!deepEqual(this.recipes[this.localSelected], this.current_recipe) || this.file || this.delete_image) {
        this.current_recipe.lastUpdated = new Date();
        console.log(this.current_recipe.lastUpdated)
    
        if(this.file) {
          this.current_recipe.cloud_images = [this.file.name]
          this.$store.dispatch('setRecipePicture', { uuid: this.current_recipe.recipe_uuid, picture: this.file })
            .catch(() => this.toast('Bildfehler.', 'danger'))
        }

        if(this.delete_image) {
          this.current_recipe.cloud_images = []
          this.$store.dispatch('setRecipePicture', { uuid: this.current_recipe.recipe_uuid, picture: null })
            .then(() => this.delete_image = false)
            .catch(() => this.toast('Bildfehler.', 'danger'))
        }
        console.log(this.current_recipe.cloud_images)
        this.$store.dispatch('setRecipe', { index: this.localSelected, recipe: this.current_recipe })
          .then(() => this.toast('Gespeichert.', 'success'))
          .catch(() => this.toast('Fehler.', 'danger'))
      }
      else {
        this.toast('Unverändert.', 'success');
      }
    },
    updateCurrentRecipe: function() {
      let replace_recipe = this.recipes[this.localSelected]
      if(replace_recipe) {
         document.title = "Kochbuch: " + replace_recipe.recipe_name;  
         this.current_recipe = this.deepCopyYaml(replace_recipe);
      }
    },
    addIngredient: function() {
      this.current_recipe.ingredients.push({'Neue Zutat':{amounts:[{amount: null,unit:''}]},section:""});
    }
  }
}
</script>
