<template>
  <div>
    <BRow align-v="center"> 
      <BCol sm="3" align-self="center">{{ ingredient_name }}</BCol>
      <BCol sm="1" align-self="center"><BFormInput :id="'ingredient-amount-input-'+index"  placeholder="1" min="0.001" step="0.001" type="number" v-model.number="ingredient_data.amounts[0].amount" size="sm"></BFormInput></BCol>
      <BCol sm="3" align-self="center"><BFormInput placeholder="Stück" list="ingredient-units-list" v-model="ingredient_data.amounts[0].unit" size="sm"></BFormInput></BCol>
      <BCol sm="2" align-self="center"><BFormSelect v-model="ingredient.section" :options="sections" size="sm"></BFormSelect></BCol>
      <BCol sm="3" align-self="center"> 

          
          <BButton @click="deleteIngredient" size="sm"><i class="bi bi-trash"></i></BButton> 
          <BButton v-b-toggle="'notes-ingredient-' + index" size="sm"><i class="bi bi-chat-square-text"></i></BButton>
          <BButton type="button" @click="showModal = true" size="sm"><i class="bi bi-pencil"></i></BButton>
          <array-reorder-btn-group :array="ingredients" :index="index"></array-reorder-btn-group>

      </BCol> 
    </BRow> 
    <BCollapse :id="'notes-ingredient-' + index"> 
      <ingredient-notes-form-row :ingredient="ingredient" v-on:update="updateIngredient($event);" :index="index"></ingredient-notes-form-row>
    </BCollapse>
    <BModal v-model="showModal" :id="'editIngredientName'+index" :title="'Zutat umbenennen'">
      <ingredient-modal-dialog-rename :sections="sections" :ingredient="ingredient" @update="updateIngredient($event); showModal = false" :index="index"></ingredient-modal-dialog-rename>
    </BModal>
  </div>
</template>

<script>
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
    data() {
      return {
        showModal: false
      }
    },
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
        this.showModal = true;
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