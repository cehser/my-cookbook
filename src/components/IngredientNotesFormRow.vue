<template>
  <BRow>
    <BCol offset="1" sm="1">Notizen</BCol>
    <BCol sm="10">
      <BRow v-for="(note, index) in ingredient_data.notes" :key="index">
        <BCol sm="8"
          ><BFormInput
            :model-value="note"
            @update:model-value="updateNote(index, $event)"
          ></BFormInput
        ></BCol>
        <BCol sm="1"
          ><BButton @click="deleteNote(index)"
            ><i class="bi bi-trash"></i></BButton
        ></BCol>
      </BRow>
      <BRow>
        <BButton @click="addNote"><i class="bi bi-plus"></i></BButton>
      </BRow>
    </BCol>
  </BRow>
</template>

<script>
export default {
  name: "IngredientNotesFormRow",
  props: ["ingredient", "index"],
  methods: {
    addNote: function () {
      // Create a deep copy to avoid mutating props
      const updatedIngredient = JSON.parse(JSON.stringify(this.ingredient));
      const ingredientData =
        updatedIngredient[Object.keys(updatedIngredient)[0]];
      ingredientData.notes = ingredientData.notes || [];
      ingredientData.notes.push("Neue Notiz");
      this.$emit("update", updatedIngredient);
    },
    deleteNote: function (index) {
      // Create a deep copy to avoid mutating props
      const updatedIngredient = JSON.parse(JSON.stringify(this.ingredient));
      const ingredientData =
        updatedIngredient[Object.keys(updatedIngredient)[0]];
      ingredientData.notes.splice(index, 1);
      this.$emit("update", updatedIngredient);
    },
    updateNote: function (index, newValue) {
      // Create a deep copy to avoid mutating props
      const updatedIngredient = JSON.parse(JSON.stringify(this.ingredient));
      const ingredientData =
        updatedIngredient[Object.keys(updatedIngredient)[0]];
      ingredientData.notes[index] = newValue;
      this.$emit("update", updatedIngredient);
    },
  },
  computed: {
    ingredient_data: function () {
      return this.ingredient[Object.keys(this.ingredient)[0]];
    },
  },
};
</script>
