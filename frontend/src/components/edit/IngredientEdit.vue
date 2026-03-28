<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import IngredientModalDialogRename from "@/components/edit/IngredientModalDialogRename.vue";
import ArrayReorderBtnGroup from "@/components/common/ArrayReorderBtnGroup.vue";
import IngredientNotesFormRow from "@/components/edit/IngredientNotesFormRow.vue";
import type { Ingredient } from "@/types/recipe";

const props = defineProps<{
  ingredient: Ingredient;
  ingredients: Ingredient[];
  index: number;
  sections: string[];
}>();

const emit = defineEmits<{
  delete: [];
  update: [value: Ingredient];
}>();

const showModal = ref(false);

const ingredient_data = computed(() => props.ingredient);

const ingredient_name = computed(() => props.ingredient.name);

const deleteIngredient = () => emit("delete");

const updateIngredient = (ingredient: Ingredient) => {
  const updatedIngredient = JSON.parse(JSON.stringify(ingredient));
  emit("update", updatedIngredient);
};

const updateSection = (newSection: string) => {
  const updatedIngredient = JSON.parse(JSON.stringify(props.ingredient));
  updatedIngredient.section = newSection;
  emit("update", updatedIngredient);
};

const updateAmount = (newAmount: number) => {
  const updatedIngredient = JSON.parse(JSON.stringify(props.ingredient));
  updatedIngredient.amounts[0].amount = Number(newAmount);
  emit("update", updatedIngredient);
};

const updateUnit = (newUnit: string) => {
  const updatedIngredient = JSON.parse(JSON.stringify(props.ingredient));
  updatedIngredient.amounts[0].unit = newUnit;
  emit("update", updatedIngredient);
};

onMounted(() => {
  if (ingredient_name.value === "Neue Zutat") {
    showModal.value = true;
  }
});
</script>

<template>
  <div>
    <BRow align-v="center">
      <BCol sm="3" align-self="center">{{ ingredient_name }}</BCol>
      <BCol sm="1" align-self="center"
        ><BFormInput
          :id="'ingredient-amount-input-' + index"
          placeholder="1"
          min="0.001"
          step="0.001"
          type="number"
          :model-value="ingredient_data.amounts[0].amount"
          @update:model-value="updateAmount"
          size="sm"
        ></BFormInput
      ></BCol>
      <BCol sm="3" align-self="center"
        ><BFormInput
          placeholder="Stück"
          list="ingredient-units-list"
          :model-value="ingredient_data.amounts[0].unit"
          @update:model-value="updateUnit"
          size="sm"
        ></BFormInput
      ></BCol>
      <BCol sm="2" align-self="center"
        ><BFormSelect
          :model-value="ingredient.section"
          @update:model-value="updateSection"
          :options="sections"
          size="sm"
        ></BFormSelect
      ></BCol>
      <BCol sm="3" align-self="center">
        <BButton @click="deleteIngredient" size="sm"
          ><i class="bi bi-trash"></i
        ></BButton>
        <BButton v-b-toggle="'notes-ingredient-' + index" size="sm"
          ><i class="bi bi-chat-square-text"></i
        ></BButton>
        <BButton type="button" @click="showModal = true" size="sm"
          ><i class="bi bi-pencil"></i
        ></BButton>
        <array-reorder-btn-group
          :array="ingredients"
          :index="index"
        ></array-reorder-btn-group>
      </BCol>
    </BRow>
    <BCollapse :id="'notes-ingredient-' + index">
      <ingredient-notes-form-row
        :ingredient="ingredient"
        v-on:update="updateIngredient($event)"
        :index="index"
      ></ingredient-notes-form-row>
    </BCollapse>
    <BModal
      v-model="showModal"
      :id="'editIngredientName' + index"
      :title="'Zutat umbenennen'"
    >
      <ingredient-modal-dialog-rename
        :sections="sections"
        :ingredient="ingredient"
        @update="
          updateIngredient($event);
          showModal = false;
        "
        :index="index"
      ></ingredient-modal-dialog-rename>
    </BModal>
  </div>
</template>
