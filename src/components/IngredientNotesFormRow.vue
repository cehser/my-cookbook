<template>
  <b-form-row> 
    <b-col offset="1" sm="1">Notizen</b-col>
    <b-col sm="10">
      <b-form-row v-for="(note, index) in ingredient_data.notes" :key="index">
        <b-col sm="8"><b-form-input v-model="ingredient_data.notes[index]"></b-form-input></b-col>
        <b-col sm="1"><b-button @click="ingredient_data.notes.splice(index, 1)"><b-icon icon="trash"></b-icon></b-button></b-col> 
      </b-form-row>
      <b-form-row>
        <b-button @click="addNote"><b-icon icon="plus"></b-icon></b-button>
      </b-form-row>
    </b-col>
  </b-form-row>
</template>

<script lang="ts">
  import { Component, Model, Prop, Vue, Emit} from 'vue-property-decorator'
  @Component
  export default class IngredientNotesFormRow extends Vue {
    @Model() ingredient:any
    
    @Prop({type: Number, default:0}) index!:number

    @Emit('update')
    public addNote () {
      this.ingredient_data.notes = this.ingredient_data.notes || [];
      this.ingredient_data.notes.push('Neue Notiz');
      return this.ingredient;
    }
  
    get ingredient_data() {
      return this.ingredient[Object.keys(this.ingredient)[0]];
    }
  }
</script>