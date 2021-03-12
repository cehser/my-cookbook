<template>
  <b-form-row>
    <b-col align-self="center" sm="8"><b-form-input :id="'editStep'+index" placeholder="Neuer Schritt" v-model="step.step" size="sm"></b-form-input></b-col>
    <b-col align-self="center" sm="2"><b-form-select v-model="step.section" :options="sections" size="sm"></b-form-select></b-col>
    <b-col align-self="center" sm="1">
      <b-button @click="deleteStep" size="sm"><b-icon icon="trash"></b-icon></b-button>
      <array-reorder-btn-group :array="steps" :index="index"></array-reorder-btn-group>
    </b-col>
  </b-form-row>
</template>

<script lang="ts">
  import { Component, Model, Prop, Vue} from 'vue-property-decorator'
  import $ from 'jquery'
  import ArrayReorderBtnGroup from '@/components/ArrayReorderBtnGroup.vue'

  @Component ( {
    components: {
      ArrayReorderBtnGroup
    },
  })
  export default class StepEdit extends Vue {
    @Prop() steps:any
    @Prop() index!:number
    @Prop() sections!: Array<any>
    @Model() step:any

    mounted() {
      if (this.step.step === '') {
        $('#editStep'+this.index).focus();
      }
    }
   public deleteStep() {
    this.$emit('delete');
  }  
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>

</style>
