<template>
  <div>
    <h3>{{ section }}</h3>
    <div v-for="(ingredient, index) in ingredients" :key="'ingredient-edit-'+section + '-' +index">
      <ingredient-edit v-if="section === ingredient.section" :ingredients="ingredients" :ingredient="ingredient" :index="index" :sections="sections" @update="ingredients.splice(index,1,$event)" @delete="ingredients.splice(index, 1)"></ingredient-edit>
    </div>
  </div>
</template>

<script>
  import helper from '../mixins/helper'
  import IngredientEdit from '@/components/IngredientEdit.vue'

  export default {
    name: 'SectionIngredientsEdit',
    mixins: [helper],
    components: {
      IngredientEdit
    },
    model: {
      prop: 'ingredients',
    },
    props: ['ingredients', 'section', 'sections']
  }
</script>