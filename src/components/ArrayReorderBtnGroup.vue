<template>
  <div class="btn-group-vertical">
    <b-button class="btn-xs" @click="swapElements(array, index, index-1)" :disabled="index == 0"><b-icon icon="chevron-up"></b-icon></b-button>
    <b-button class="btn-xs" @click="swapElements(array, index, index+1)" :disabled="index == array.length -1"><b-icon icon="chevron-down"></b-icon></b-button>
  </div>
</template>

<script lang="ts">
  import { Component, Mixins, Prop} from 'vue-property-decorator'
  import RecipeHelper from '@/mixins/RecipeHelper'

  @Component
  export default class ArrayReorderBtnGroup extends Mixins(RecipeHelper) {
    @Prop() readonly index:number=0
    @Prop() array:Array<object> =[]
}
</script>

<style scoped>
  .btn-group-xs > .btn, .btn-xs {
    padding: .125rem .2rem;
    font-size: .7rem;
    line-height: .5;
    border-radius: .2rem;
  }
    
</style>