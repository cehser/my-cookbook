<template>
  <div class="modal-dialog" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="exampleModalLabel">Zutat umbenennen</h5>
        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
      <div class="modal-body">
        <form>
          <div class="form-group">
            <label :for="'new-ingredient-name'+index" class="col-form-label">Neue Bezeichnung für {{Object.keys(ingredient)[0]}}</label>
            <input type="text" class="form-control" :id="'new-ingredient-name'+index" @keydown.enter.prevent="renameIngredient">
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
        <button type="button" class="btn btn-primary" data-dismiss="modal" @click="renameIngredient">Save changes</button>
      </div>
    </div>
  </div> 
</template>

<script>
  import helper from '../mixins/helper'
  import $ from 'jquery'

  export default {
    name: 'IngredientModalDialogRename',
    mixins: [helper],
    model: {
      prop: 'ingredient',
    },
    props: {
      ingredient: Object,
      index: Number,
      sections: Array
    },
    mounted() {
      //set focus to input field when the modal dialog is being displayed
      $('#editIngredientName'+this.index).on('shown.bs.modal',  () => {
          $('#new-ingredient-name'+this.index).focus();
      });
    },
    methods: {
      renameIngredient: function() {
        var newName = $('#new-ingredient-name'+this.index).val();
        var oldName = Object.keys(this.ingredient)[0];

        var ingredient = {};
        ingredient[newName] = this.ingredient[oldName];
        ingredient.section  = this.ingredient.section;
        
        this.ingredient = ingredient;
        
        //Update component value
        this.$emit('update', this.ingredient);
        $('#editIngredientName'+this.index).modal('hide');
        $('#ingredient-amount-input-'+this.index).focus();
      }
    }
  }
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>

</style>
