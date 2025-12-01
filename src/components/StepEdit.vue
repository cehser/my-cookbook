<template>
  <BRow>
    <BCol align-self="center" sm="8"><BFormInput :id="'editStep'+index" placeholder="Neuer Schritt" v-model="localStep.step" size="sm"></BFormInput></BCol>
    <BCol align-self="center" sm="2"><BFormSelect v-model="localStep.section" :options="sections" size="sm"></BFormSelect></BCol>
    <BCol align-self="center" sm="1">
      <BButton @click="deleteStep" size="sm"><i class="bi bi-trash"></i></BButton>
      <array-reorder-btn-group :array="steps" :index="index"></array-reorder-btn-group>
    </BCol>
  </BRow>
</template>

<script>
  import ArrayReorderBtnGroup from '@/components/ArrayReorderBtnGroup.vue'

  export default {
    name: 'StepEdit',
    components: {
      ArrayReorderBtnGroup
    },
    props: {
      modelValue: {
        type: Object,
        required: true
      },
      steps: Array,
      index: Number,
      sections: Array
    },
    computed: {
      localStep: {
        get() {
          return this.modelValue;
        },
        set(value) {
          this.$emit('update:modelValue', value);
        }
      }
    },
    mounted() {
      if (this.modelValue.step === '') {
        const input = document.querySelector('#editStep'+this.index);
        if (input) input.focus();
      }
    },
    methods: {
      deleteStep() {
        this.$emit('delete');
      }
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>

</style>
