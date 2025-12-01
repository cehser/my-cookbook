<template>
  <div class="btn-group-vertical">
    <BButton class="btn-xs" @click="swapElements(array, index, index-1)" :disabled="index == 0"><i class="bi bi-chevron-up"></i></BButton>
    <BButton class="btn-xs" @click="swapElements(array, index, index+1)" :disabled="index == array.length -1"><i class="bi bi-chevron-down"></i></BButton>
  </div>
</template>

<script>
  import RecipeHelper from '@/mixins/RecipeHelper'
  export default {
    name: 'ArrayReorderBtnGroup',
    mixins: [RecipeHelper],
    props: ['array', 'index']
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