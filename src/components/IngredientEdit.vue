<template>
  <div>
    <b-form-row align-v="center"> 
      <b-col sm="3" align-self="center">{{ ingredient_name }}</b-col>
      <b-col sm="1" align-self="center"><b-form-input :id="'ingredient-amount-input-'+index"  placeholder="1" min="0.001" step="0.001" type="number" v-model.number="ingredient_data.amounts[0].amount" size="sm"></b-form-input></b-col>
      <b-col sm="3" align-self="center"><b-form-input placeholder="Stück" list="ingredient-units-list" v-model="ingredient_data.amounts[0].unit" size="sm"></b-form-input></b-col>
      <b-col sm="2" align-self="center"><b-form-select v-model="ingredient.section" :options="sections" size="sm"></b-form-select></b-col>
      <b-col sm="3" align-self="center"> 

          
          <b-button @click="deleteIngredient" size="sm"><b-icon icon="trash"></b-icon></b-button> 
          <b-button v-b-toggle="'notes-ingredient-' + index" size="sm"><b-icon icon="chat-square-text" ></b-icon></b-button>
          <b-button type="button" data-toggle="modal" :data-target="'#editIngredientName'+index" size="sm"><b-icon icon="pencil"></b-icon></b-button>
          <array-reorder-btn-group :array="ingredients" :index="index"></array-reorder-btn-group>

      </b-col> 
    </b-form-row> 
    <b-collapse :id="'notes-ingredient-' + index"> 
      <ingredient-notes-form-row :ingredient="ingredient" v-on:update="updateIngredient($event);" :index="index"></ingredient-notes-form-row>
    </b-collapse>
    <div class="modal fade" :id="'editIngredientName'+index" tabindex="-1" role="dialog" aria-labelledby="exampleModalLabel" aria-hidden="true">
      <ingredient-modal-dialog-rename :sections="sections" :ingredient="ingredient" @update="updateIngredient($event)" :index="index"></ingredient-modal-dialog-rename>
    </div>
  </div>
</template>

<script>
  import $ from 'jquery'
  import IngredientModalDialogRename from '@/components/IngredientModalDialogRename'
  import ArrayReorderBtnGroup from '@/components/ArrayReorderBtnGroup'
  import IngredientNotesFormRow from '@/components/IngredientNotesFormRow'


  export default {
    name: 'IngredientEdit',
    components: {
      IngredientModalDialogRename,
      IngredientNotesFormRow,
      ArrayReorderBtnGroup
    },
    model: {
      prop: 'ingredient',
    },
    props: ['ingredient', 'ingredients', 'index', 'sections'],
    methods: {
      deleteIngredient() {
        this.$emit('delete');
      },
      updateIngredient(ingredient) {
        //use deep copy as wokaround to notice update of ingredient name
        this.ingredient = JSON.parse(JSON.stringify(ingredient)); 
        this.$emit('update', this.ingredient);
      }
    },
    mounted() {
      if (this.ingredient_name === 'Neue Zutat') {
        $('#editIngredientName'+this.index).modal('show');
      }
    },
    computed: {
      ingredient_data: function() {
        return this.ingredient[Object.keys(this.ingredient)[0]];
      },
      ingredient_name: function() {
        return Object.keys(this.ingredient)[0];
      }
    }
  }
</script>