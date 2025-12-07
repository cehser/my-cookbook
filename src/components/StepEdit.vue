<template>
  <BRow>
    <BCol align-self="center" sm="8"
      ><BFormInput
        :id="'editStep' + index"
        placeholder="Neuer Schritt"
        v-model="localStep.step"
        size="sm"
      ></BFormInput
    ></BCol>
    <BCol align-self="center" sm="2"
      ><BFormSelect
        v-model="localStep.section"
        :options="sections"
        size="sm"
      ></BFormSelect
    ></BCol>
    <BCol align-self="center" sm="1">
      <BButton @click="deleteStep" size="sm"
        ><i class="bi bi-trash"></i
      ></BButton>
      <array-reorder-btn-group
        :array="steps"
        :index="index"
      ></array-reorder-btn-group>
    </BCol>
  </BRow>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import ArrayReorderBtnGroup from "@/components/ArrayReorderBtnGroup.vue";

interface Step {
  step: string;
  section: string;
}

const props = defineProps<{
  steps: Step[];
  index: number;
  sections: string[];
}>();

const emit = defineEmits<{
  delete: [];
}>();

const localStep = defineModel<Step>({ required: true });

const deleteStep = () => emit("delete");

onMounted(() => {
  if (localStep.value.step === "") {
    const input = document.querySelector(
      `#editStep${props.index}`,
    ) as HTMLInputElement;
    input?.focus();
  }
});
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped></style>
