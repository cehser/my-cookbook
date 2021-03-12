<template>
  <div>
    <h3>{{ section }}</h3>
    <div v-for="(ingredient, index) in ingredients" :key="'ingredient-edit-'+section + '-' +index">
      <ingredient-edit v-if="section === ingredient.section" :ingredients="ingredients" :ingredient="ingredient" :index="index" :sections="sections" @update="ingredients.splice(index,1,$event)" @delete="ingredients.splice(index, 1)"></ingredient-edit>
    </div>
  </div>
</template>

<script lang="ts">
  import IngredientEdit from '@/components/IngredientEdit.vue'
  import { Component, Model, Prop, Vue} from 'vue-property-decorator'

  @Component({
    components: {
      IngredientEdit
    }
  })
  export default class SectionIngredientsEdit extends Vue {

    @Model() ingredients!:Array<any>
    @Prop() section:any 
    @Prop() sections!:Array<any>
  }
</script>