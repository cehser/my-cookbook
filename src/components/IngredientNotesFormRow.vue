<template>
  <BRow> 
    <BCol offset="1" sm="1">Notizen</BCol>
    <BCol sm="10">
      <BRow v-for="(note, index) in ingredient_data.notes" :key="index">
        <BCol sm="8"><BFormInput v-model="ingredient_data.notes[index]"></BFormInput></BCol>
        <BCol sm="1"><BButton @click="ingredient_data.notes.splice(index, 1)"><i class="bi bi-trash"></i></BButton></BCol> 
      </BRow>
      <BRow>
        <BButton @click="addNote"><i class="bi bi-plus"></i></BButton>
      </BRow>
    </BCol>
  </BRow>
</template>

<script>
  export default {
    name: 'IngredientNotesFormRow',
    props: ['ingredient', 'index'],
    methods: {
      addNote: function() {
        this.ingredient_data.notes = this.ingredient_data.notes || [];
        this.ingredient_data.notes.push('Neue Notiz');
        this.$emit('update', this.ingredient);
      }
    },
    computed: {
      ingredient_data: function() {
        return this.ingredient[Object.keys(this.ingredient)[0]];
      }
    }
  }
</script>