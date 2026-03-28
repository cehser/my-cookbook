<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import StepEdit from "@/components/edit/StepEdit.vue";
import SectionIngredientsEdit from "@/components/edit/SectionIngredientsEdit.vue";
import ArrayReorderBtnGroup from "@/components/common/ArrayReorderBtnGroup.vue";
import AppNavbar from "@/components/layout/AppNavbar.vue";
import { editUrl } from "@/js/slug";
import { useRecipeHelper } from "@/composables/useRecipeHelper";
import { useToast } from "@/composables/useToast";
import { useRecipeStore } from "@/store/recipeStore";
import jsyaml from "js-yaml";
import deepEqual from "deep-equal";

const props = defineProps<{ id: string }>();

const router = useRouter();
const store = useRecipeStore();
const { toast } = useToast();

const idRef = computed(() => props.id);
const {
  current_recipe,
  do_recalc,
  selected,
  recipes_list,
  picture_src,
  yields_unit,
  yields_value,
  section_names,
  deepCopyYaml,
  setYieldsUnit,
  setYieldsValue,
} = useRecipeHelper({ recipeId: idRef });

// Override do_recalc default
do_recalc.value = false;

// Data
const file = ref<File | null>(null);
const delete_image = ref(false);
const localSelected = ref(-1);
const newTag = ref("");
const inputFoto = ref<{ reset: () => void } | null>(null);

// Computed
const yaml = computed(() => jsyaml.dump(current_recipe.value));

const ingredient_units = computed(() => {
  const units = new Set(["g", "ml", "Stück"]);
  for (const recipe of store.recipes) {
    for (const ingredient of recipe.ingredients || []) {
      for (const amount of ingredient.amounts || []) {
        if (amount.unit) units.add(amount.unit);
      }
    }
  }
  return [...units].sort();
});

const settings = computed(() => store.settings);
const recipes = computed(() => store.recipes);
const recipe_pictures = computed(() => store.recipe_pictures);

// Watch
watch(file, (newFile) => {
  preview_image(newFile);
});

// Lifecycle
function onKeyDown(event: KeyboardEvent) {
  if (event.ctrlKey && event.code === "KeyS") {
    event.preventDefault();
    saveRecipe();
  }
}

onMounted(() => {
  localSelected.value = selected.value;
  document.addEventListener("keydown", onKeyDown);
});

onUnmounted(() => {
  document.removeEventListener("keydown", onKeyDown);
});

// Methods
function addTag() {
  if (!newTag.value.trim()) return;
  if (!current_recipe.value) return;
  if (!current_recipe.value.tags) {
    current_recipe.value.tags = [];
  }
  if (!current_recipe.value.tags.includes(newTag.value.trim())) {
    current_recipe.value.tags.push(newTag.value.trim());
  }
  newTag.value = "";
}

function removeTag(index: number) {
  current_recipe.value?.tags?.splice(index, 1);
}

function clearFile() {
  inputFoto.value?.reset();
}

function preview_image(f: File | null) {
  const preview = document.querySelector(
    "#image-preview",
  ) as HTMLImageElement | null;
  if (preview) {
    preview.src = f ? URL.createObjectURL(f) : "";
  }
}

function saveRecipe() {
  if (!current_recipe.value) return;
  if (
    !deepEqual(store.recipes[selected.value], current_recipe.value) ||
    file.value ||
    delete_image.value
  ) {
    current_recipe.value.lastUpdated = new Date();

    if (file.value) {
      store
        .setRecipePicture({
          uuid: current_recipe.value.recipe_uuid,
          picture: file.value,
        })
        .catch(() => toast("Bildfehler.", "danger"));
    }

    if (delete_image.value) {
      store
        .setRecipePicture({
          uuid: current_recipe.value.recipe_uuid,
          picture: null,
        })
        .then(() => (delete_image.value = false))
        .catch(() => toast("Bildfehler.", "danger"));
    }
    store
      .setRecipe({
        index: selected.value,
        recipe: current_recipe.value,
      })
      .then(() => toast("Gespeichert.", "success"))
      .catch(() => toast("Fehler.", "danger"));
  } else {
    toast("Unverändert.", "success");
  }
}

function updateCurrentRecipe() {
  const replace_recipe = store.recipes[selected.value];
  if (replace_recipe) {
    document.title = "Kochbuch: " + replace_recipe.recipe_name;
    current_recipe.value = deepCopyYaml(replace_recipe);
  }
}

function addIngredient() {
  current_recipe.value?.ingredients.push({
    name: "Neue Zutat",
    amounts: [{ amount: null, unit: "" }],
    section: "",
  });
}

function navSelected(uuid: string) {
  const r = store.recipes.find((r) => r.recipe_uuid === uuid);
  if (r) {
    router.push(editUrl(r.recipe_uuid, r.recipe_name));
  }
}
</script>

<template>
  <div id="edit">
    <AppNavbar
      @update:selected="navSelected"
      :recipes_list="recipes_list"
      :selected="id"
      :read_only="settings.read_only"
    >
      <li>
        <form class="form-inline">
          <BButton @click="saveRecipe"
            ><i class="bi bi-archive-fill"></i
          ></BButton>
        </form>
      </li>
    </AppNavbar>
    <BContainer v-if="current_recipe">
      <datalist id="ingredient-units-list">
        <option
          v-for="unit in ingredient_units"
          :key="unit"
          :value="unit"
        ></option>
      </datalist>
      <h2>Rezept</h2>

      <BContainer fluid>
        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-name">Titel:</label>
          </BCol>
          <BCol sm="10">
            <BFormInput
              id="input-name"
              size="sm"
              placeholder="Namen eingeben"
              v-model="current_recipe.recipe_name"
            ></BFormInput>
          </BCol>
        </BRow>
        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-subtitle">Untertitel:</label>
          </BCol>
          <BCol sm="10">
            <BFormInput
              id="input-subtitle"
              size="sm"
              placeholder="Untertitel eingeben"
              v-model="current_recipe.subtitle"
            ></BFormInput>
          </BCol>
        </BRow>

        <!-- Metadaten-Sektion -->
        <h3 class="mt-4 mb-3">Metadaten</h3>

        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-author">Autor:</label>
          </BCol>
          <BCol sm="10">
            <BFormInput
              id="input-author"
              size="sm"
              placeholder="Autor eingeben"
              v-model="current_recipe.author"
            ></BFormInput>
          </BCol>
        </BRow>

        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-source-url">Quelle (URL):</label>
          </BCol>
          <BCol sm="10">
            <BFormInput
              id="input-source-url"
              size="sm"
              placeholder="https://..."
              v-model="current_recipe.source_url"
            ></BFormInput>
          </BCol>
        </BRow>

        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-source-book">Quelle (Buch):</label>
          </BCol>
          <BCol sm="10">
            <BFormInput
              id="input-source-book"
              size="sm"
              placeholder="Buchtitel, Seite"
              v-model="current_recipe.source_book"
            ></BFormInput>
          </BCol>
        </BRow>

        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-servings">Portionen:</label>
          </BCol>
          <BCol sm="10">
            <BFormInput
              id="input-servings"
              size="sm"
              placeholder="z.B. 4 Personen"
              v-model="current_recipe.servings"
            ></BFormInput>
          </BCol>
        </BRow>

        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-prep-time">Vorbereitungszeit:</label>
          </BCol>
          <BCol sm="10">
            <BFormInput
              id="input-prep-time"
              size="sm"
              placeholder="z.B. 15 Minuten"
              v-model="current_recipe.prep_time"
            ></BFormInput>
          </BCol>
        </BRow>

        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-cook-time">Koch-/Bratzeit:</label>
          </BCol>
          <BCol sm="10">
            <BFormInput
              id="input-cook-time"
              size="sm"
              placeholder="z.B. 30 Minuten"
              v-model="current_recipe.cook_time"
            ></BFormInput>
          </BCol>
        </BRow>

        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-bake-time">Backzeit:</label>
          </BCol>
          <BCol sm="10">
            <BFormInput
              id="input-bake-time"
              size="sm"
              placeholder="z.B. 45 Minuten"
              v-model="current_recipe.bake_time"
            ></BFormInput>
          </BCol>
        </BRow>

        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-total-time">Gesamtzeit:</label>
          </BCol>
          <BCol sm="10">
            <BFormInput
              id="input-total-time"
              size="sm"
              placeholder="z.B. 1 Stunde 30 Minuten"
              v-model="current_recipe.total_time"
            ></BFormInput>
          </BCol>
        </BRow>

        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-difficulty">Schwierigkeit:</label>
          </BCol>
          <BCol sm="10">
            <BFormSelect
              id="input-difficulty"
              size="sm"
              v-model="current_recipe.difficulty"
            >
              <option :value="undefined">-- Bitte wählen --</option>
              <option value="easy">Einfach</option>
              <option value="medium">Mittel</option>
              <option value="hard">Schwer</option>
            </BFormSelect>
          </BCol>
        </BRow>

        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-notes">Notizen:</label>
          </BCol>
          <BCol sm="10">
            <BFormTextarea
              id="input-notes"
              size="sm"
              rows="3"
              placeholder="Zusätzliche Notizen zum Rezept..."
              v-model="current_recipe.notes"
            ></BFormTextarea>
          </BCol>
        </BRow>

        <h3 class="mt-4 mb-3">Zutaten & Portionen</h3>

        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-yields-value">Ergibt Menge:</label>
          </BCol>
          <BCol sm="10">
            <BFormInput
              id="input-yields-value"
              size="sm"
              type="number"
              min="0.001"
              step="0.001"
              placeholder="100.0"
              :model-value="yields_value"
              @update:model-value="setYieldsValue"
            ></BFormInput>
            <div class="custom-control custom-switch">
              <input
                type="checkbox"
                class="custom-control-input"
                id="recalc-switch"
                v-model="do_recalc"
              />
              <label class="custom-control-label" for="recalc-switch"
                >Umrechnen</label
              >
            </div>
          </BCol>
        </BRow>
        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-yields">Ergibt Einheiten:</label>
          </BCol>
          <BCol sm="10">
            <BFormInput
              id="input-yields"
              size="sm"
              placeholder="Enter a name"
              :model-value="yields_unit"
              @update:model-value="setYieldsUnit"
            ></BFormInput>
          </BCol>
        </BRow>
        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-recalc_exp">Umrechnungsexponent:</label>
          </BCol>
          <BCol sm="10">
            <BFormInput
              id="input-recalc_exp"
              type="number"
              min="1"
              step="1"
              size="sm"
              placeholder="1"
              v-model.number="current_recipe.recalc_exp"
            ></BFormInput>
          </BCol>
        </BRow>
        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-name">Web-Foto:</label>
          </BCol>
          <BCol sm="10">
            <BFormInput
              id="input-name"
              size="sm"
              placeholder="https://..."
              v-model="current_recipe.imageurl"
            ></BFormInput>
          </BCol>
        </BRow>
        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-tags">Tags:</label>
          </BCol>
          <BCol sm="10">
            <div class="d-flex flex-wrap gap-2 mb-2">
              <span
                v-for="(tag, index) in current_recipe.tags"
                :key="index"
                class="badge bg-primary"
              >
                {{ tag }}
                <i
                  class="bi bi-x-circle ms-1"
                  @click="removeTag(index)"
                  style="cursor: pointer"
                ></i>
              </span>
            </div>
            <div class="input-group input-group-sm">
              <BFormInput
                id="input-tags"
                size="sm"
                placeholder="Tag hinzufügen..."
                v-model="newTag"
                @keyup.enter="addTag"
              ></BFormInput>
              <BButton @click="addTag" size="sm"
                ><i class="bi bi-plus"></i
              ></BButton>
            </div>
          </BCol>
        </BRow>
        <BRow class="my-1" v-if="recipe_pictures[current_recipe.recipe_uuid]">
          <BCol sm="2">
            <label for="input-name">Gespeichertes Foto:</label>
          </BCol>
          <BCol sm="10">
            <img :src="picture_src" height="100" />
            <div class="custom-control custom-switch">
              <input
                type="checkbox"
                class="custom-control-input"
                id="delete_image-switch"
                v-model="delete_image"
              />
              <label class="custom-control-label" for="delete_image-switch"
                >Löschen</label
              >
            </div>
          </BCol>
        </BRow>
        <BRow class="my-1">
          <BCol sm="2">
            <label for="input-foto">Foto-Upload:</label>
          </BCol>
          <BCol sm="10">
            <BInputGroup size="sm">
              <template #prepend>
                <BButton size="sm" @click="clearFile"
                  ><i class="bi bi-x"></i
                ></BButton>
              </template>

              <BFormFile
                size="sm"
                id="input-foto"
                ref="inputFoto"
                accept="image/*"
                placeholder="Datei auswählen oder ablegen"
                drop-placeholder="Hier ablegen"
                browse-text="Durchsuchen"
                v-model="file"
              ></BFormFile>
            </BInputGroup>
          </BCol>
        </BRow>
        <BRow>
          <BCol sm="2"> Upload-Vorschau </BCol>
          <BCol sm="10">
            <img id="image-preview" height="100" />
          </BCol>
        </BRow>
      </BContainer>
      <BContainer fluid>
        <h2>Abschnitte</h2>
        <div>
          <BRow
            v-for="(section, index_s) in current_recipe.sections"
            :key="index_s"
          >
            <BCol cols="11"
              ><BFormInput
                size="sm"
                placeholder="Neuer Abschnitt"
                v-model="section.section"
              ></BFormInput
            ></BCol>
            <BCol cols="1">
              <BButton
                @click="current_recipe.sections.splice(index_s, 1)"
                size="sm"
                ><i class="bi bi-trash"></i
              ></BButton>
              <array-reorder-btn-group
                :array="current_recipe.sections"
                :index="index_s"
              ></array-reorder-btn-group>
            </BCol>
          </BRow>
        </div>
        <BRow>
          <BButton @click="current_recipe.sections.push({ section: '' })"
            ><i class="bi bi-plus"></i
          ></BButton>
        </BRow>
      </BContainer>
      <h2>Zutaten</h2>
      <div
        v-for="(section, index) in current_recipe.sections"
        :key="'sectiona-' + index"
      >
        <section-ingredients-edit
          :section="section.section"
          :sections="section_names"
          v-model="current_recipe.ingredients"
        ></section-ingredients-edit>
      </div>
      <BRow>
        <BButton @click="addIngredient"><i class="bi bi-plus"></i></BButton>
      </BRow>
      <h2>Zubereitung</h2>
      <div
        v-for="(section, index) in current_recipe.sections"
        :key="'sectionb-' + index"
      >
        <h3>{{ section.section }}</h3>
        <div v-for="(step, stepindex) in current_recipe.steps" :key="stepindex">
          <step-edit
            v-model="current_recipe.steps[stepindex]"
            :steps="current_recipe.steps"
            :sections="section_names"
            :index="stepindex"
            v-if="step.section == section.section"
            @delete="current_recipe.steps.splice(stepindex, 1)"
          ></step-edit>
        </div>
      </div>

      <BRow>
        <BButton @click="current_recipe.steps.push({ step: '', section: '' })"
          ><i class="bi bi-plus"></i
        ></BButton>
      </BRow>
      <h2>Code</h2>
      <BRow>
        <BFormTextarea readonly rows="10" :value="yaml"></BFormTextarea>
      </BRow>
    </BContainer>
  </div>
</template>
