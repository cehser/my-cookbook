<template>
  <div>
    <BRow align-v="center"> 
      <BCol sm="3" align-self="center">{{ ingredient_name }}</BCol>
      <BCol sm="1" align-self="center"><BFormInput :id="'ingredient-amount-input-'+index"  placeholder="1" min="0.001" step="0.001" type="number" :model-value="ingredient_data.amounts[0].amount" @update:model-value="updateAmount" size="sm"></BFormInput></BCol>
      <BCol sm="3" align-self="center"><BFormInput placeholder="Stück" list="ingredient-units-list" :model-value="ingredient_data.amounts[0].unit" @update:model-value="updateUnit" size="sm"></BFormInput></BCol>
      <BCol sm="2" align-self="center"><BFormSelect :model-value="ingredient.section" @update:model-value="updateSection" :options="sections" size="sm"></BFormSelect></BCol>
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
  import IngredientModalDialogRename from '@/components/IngredientModalDialogRename.vue'
  import ArrayReorderBtnGroup from '@/components/ArrayReorderBtnGroup.vue'
  import IngredientNotesFormRow from '@/components/IngredientNotesFormRow.vue'


  export default {
    name: 'IngredientEdit',
    components: {
      IngredientModalDialogRename,
      IngredientNotesFormRow,
      ArrayReorderBtnGroup
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
        //use deep copy to avoid mutating props
        const updatedIngredient = JSON.parse(JSON.stringify(ingredient));
        this.$emit('update', updatedIngredient);
      },
      updateSection(newSection) {
        // Create a deep copy and update the section
        const updatedIngredient = JSON.parse(JSON.stringify(this.ingredient));
        updatedIngredient.section = newSection;
        this.$emit('update', updatedIngredient);
      },
      updateAmount(newAmount) {
        // Create a deep copy and update the amount
        const updatedIngredient = JSON.parse(JSON.stringify(this.ingredient));
        const ingredientData = updatedIngredient[Object.keys(updatedIngredient)[0]];
        ingredientData.amounts[0].amount = Number(newAmount);
        this.$emit('update', updatedIngredient);
      },
      updateUnit(newUnit) {
        // Create a deep copy and update the unit
        const updatedIngredient = JSON.parse(JSON.stringify(this.ingredient));
        const ingredientData = updatedIngredient[Object.keys(updatedIngredient)[0]];
        ingredientData.amounts[0].unit = newUnit;
        this.$emit('update', updatedIngredient);
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