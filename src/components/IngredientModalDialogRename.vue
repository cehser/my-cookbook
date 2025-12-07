<template>
  <div>
    <form>
      <div class="form-group">
        <label :for="'new-ingredient-name' + index" class="col-form-label"
          >Neue Bezeichnung für {{ Object.keys(ingredient)[0] }}</label
        >
        <input
          type="text"
          class="form-control"
          :id="'new-ingredient-name' + index"
          v-model="newName"
          @keydown.enter.prevent="renameIngredient"
          ref="inputField"
        />
      </div>
    </form>
  </div>
</template>

<script>
export default {
  name: "IngredientModalDialogRename",
  props: {
    ingredient: Object,
    index: Number,
    sections: Array,
  },
  data() {
    return {
      newName: "",
    };
  },
  mounted() {
    // Set focus when component mounts
    this.$nextTick(() => {
      if (this.$refs.inputField) {
        this.$refs.inputField.focus();
      }
    });
  },
  methods: {
    renameIngredient: function () {
      if (!this.newName.trim()) return;

      var oldName = Object.keys(this.ingredient)[0];

      // Create new ingredient object instead of mutating prop
      var ingredient = {};
      ingredient[this.newName] = this.ingredient[oldName];
      ingredient.section = this.ingredient.section;

      // Emit the new ingredient without mutating the prop
      this.$emit("update", ingredient);
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped></style>
