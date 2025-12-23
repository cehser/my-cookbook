<template>
  <div id="recipe">
    <Navbar
      @input="selected = $event"
      :recipes_list="recipes_list"
      :selected="selected"
      :read_only="settings.read_only"
    >
      <li>
        <form class="form-inline d-flex gap-1">
          <BButton
            @click="prevRecipe"
            :disabled="selected === 0"
            title="Vorheriges Rezept"
            size="sm"
          >
            <i class="bi bi-chevron-left"></i>
          </BButton>
          <BButton
            @click="nextRecipe"
            :disabled="selected >= recipes.length - 1"
            title="Nächstes Rezept"
            size="sm"
          >
            <i class="bi bi-chevron-right"></i>
          </BButton>
          <BButton
            v-if="!settings.read_only && !editMode"
            @click="toggleEditMode"
            title="Inline bearbeiten"
            variant="primary"
            size="sm"
          >
            <i class="bi bi-pencil"></i>
          </BButton>
          <BButton
            v-if="!settings.read_only && editMode"
            @click="saveRecipe"
            title="Speichern"
            variant="success"
            size="sm"
          >
            <i class="bi bi-check-lg"></i>
          </BButton>
          <BButton
            v-if="!settings.read_only && editMode"
            @click="cancelEdit"
            title="Abbrechen"
            variant="secondary"
            size="sm"
          >
            <i class="bi bi-x-lg"></i>
          </BButton>
          <BButton
            v-if="settings.expert_mode"
            @click="exportRecipe"
            title="Als YAML exportieren"
            size="sm"
          >
            <i class="bi bi-download"></i>
          </BButton>
          <BButton
            v-if="!settings.read_only"
            @click="copyRecipe"
            title="Kopieren"
            size="sm"
          >
            <i class="bi bi-files"></i>
          </BButton>
          <BButton
            v-if="!settings.read_only"
            @click="deleteRecipe"
            title="Löschen"
            variant="danger"
            size="sm"
          >
            <i class="bi bi-trash"></i>
          </BButton>
        </form>
      </li>
    </Navbar>
    <div class="wrapper">
      <div id="steps" class="card rounded-0" :class="{ full: stepsFullWidth }">
        <div id="collapesebutton" class="ml-auto">
          <div class="fs-3 mb-3">
            <button
              class="btn rounded-0 shadow-none"
              type="button"
              @click="toggleIngredients"
              aria-expanded="false"
              aria-controls="ingredients"
            >
              <i
                id="arrow-ing"
                class="bi bi-arrow-right-square-fill"
                :class="{ rotate180: !showIngredients }"
                style="font-size: 1.5rem"
              ></i>
            </button>
          </div>
        </div>
        <div id="recipe_title_container">
          <img
            class="card-img-top rounded-0"
            id="recipe_img"
            :src="picture_src"
            alt="Card image cap"
          />
          <div class="card-body" id="recipe_title">
            <h2
              class="card-title d-flex flex-row flex-wrap justify-content-between"
            >
              <div v-if="!editMode">
                {{ current_recipe.recipe_name }}
              </div>
              <BFormInput
                v-else
                v-model="current_recipe.recipe_name"
                size="lg"
                class="fw-bold"
              />
            </h2>
            <p v-if="!editMode" class="card-text">
              {{ current_recipe.subtitle }}
            </p>
            <BFormInput
              v-else
              v-model="current_recipe.subtitle"
              placeholder="Untertitel"
            />
            
            <!-- Metadaten-Toggle-Icon (dezent) -->
            <div
              v-if="hasMetadata"
              class="metadata-toggle"
              @click="showMetadata = !showMetadata"
              :title="showMetadata ? 'Metadaten ausblenden' : 'Metadaten anzeigen'"
            >
              <i class="bi bi-info-circle"></i>
            </div>
            
            <!-- Metadaten-Sektion als Overlay -->
            <div
              v-if="showMetadata && hasMetadata"
              class="recipe-metadata-overlay"
              @click.self="showMetadata = false"
            >
              <div class="recipe-metadata">
                <div class="metadata-header">
                  <h6 class="mb-0">
                    <i class="bi bi-info-circle me-2"></i>Rezeptinformationen
                  </h6>
                  <button
                    class="btn-close btn-close-white"
                    @click="showMetadata = false"
                    aria-label="Schließen"
                  ></button>
                </div>
                
                <div v-if="current_recipe.author" class="metadata-row">
                  <i class="bi bi-person-fill text-muted me-2"></i>
                  <strong>Autor:</strong> {{ current_recipe.author }}
                </div>
                
                <div
                  v-if="current_recipe.source_url || current_recipe.source_book"
                  class="metadata-row"
                >
                  <i class="bi bi-link-45deg text-muted me-2"></i>
                  <strong>Quelle:</strong>
                  <a
                    v-if="current_recipe.source_url"
                    :href="current_recipe.source_url"
                    target="_blank"
                    class="ms-1"
                  >
                    {{ current_recipe.source_url }}
                  </a>
                  <span v-if="current_recipe.source_book" class="ms-1">
                    {{ current_recipe.source_book }}
                  </span>
                </div>
                
                <div v-if="current_recipe.servings" class="metadata-row">
                  <i class="bi bi-people-fill text-muted me-2"></i>
                  <strong>Portionen:</strong> {{ current_recipe.servings }}
                </div>
                
                <div
                  v-if="
                    current_recipe.prep_time ||
                    current_recipe.cook_time ||
                    current_recipe.total_time ||
                    current_recipe.bake_time
                  "
                  class="metadata-row"
                >
                  <i class="bi bi-clock-fill text-muted me-2"></i>
                  <strong>Zeit:</strong>
                  <span v-if="current_recipe.prep_time" class="ms-1">
                    Vorbereitung: {{ current_recipe.prep_time }}
                  </span>
                  <span v-if="current_recipe.cook_time" class="ms-1">
                    | Koch-Zeit: {{ current_recipe.cook_time }}
                  </span>
                  <span v-if="current_recipe.bake_time" class="ms-1">
                    | Back-Zeit: {{ current_recipe.bake_time }}
                  </span>
                  <span v-if="current_recipe.total_time" class="ms-1">
                    | Gesamt: {{ current_recipe.total_time }}
                  </span>
                </div>
                
                <div v-if="current_recipe.difficulty" class="metadata-row">
                  <i class="bi bi-bar-chart-fill text-muted me-2"></i>
                  <strong>Schwierigkeit:</strong>
                  <span
                    class="badge ms-1"
                    :class="{
                      'bg-success': current_recipe.difficulty === 'easy',
                      'bg-warning': current_recipe.difficulty === 'medium',
                      'bg-danger': current_recipe.difficulty === 'hard',
                    }"
                  >
                    {{
                      current_recipe.difficulty === "easy"
                        ? "Einfach"
                        : current_recipe.difficulty === "medium"
                          ? "Mittel"
                          : "Schwer"
                    }}
                  </span>
                </div>
                
                <div v-if="current_recipe.notes" class="metadata-row">
                  <i class="bi bi-journal-text text-muted me-2"></i>
                  <strong>Notizen:</strong>
                  <p class="mb-0 ms-4">{{ current_recipe.notes }}</p>
                </div>
              </div>
            </div>
            
            <div
              v-if="current_recipe.tags && current_recipe.tags.length"
              class="mt-2"
            >
              <span
                v-for="(tag, idx) in current_recipe.tags"
                :key="idx"
                class="badge bg-light text-dark me-1"
                >{{ tag }}</span
              >
            </div>
          </div>
        </div>
        <div class="card-body">
          <h3>Zubereitung</h3>
          <div
            v-for="(section, sectionIndex) in current_recipe.sections"
            :key="'section-' + sectionIndex"
          >
            <h4 v-if="!editMode">{{ section.section }}</h4>
            <BFormInput
              v-else
              v-model="section.section"
              class="mb-2 fw-bold"
              placeholder="Abschnittsname"
            />
            <ul class="list-group list-group-numbered list-group-flush">
              <li
                class="list-group-item"
                v-for="(step, stepIndex) in current_recipe.steps.filter(
                  (x) => x.section == section.section,
                )"
                :key="'step-' + stepIndex"
                :data-section="section.section"
                :data-step-number="getStepNumber(section.section, stepIndex)"
                @click="!editMode && selectStep($event)"
              >
                <span v-if="!editMode">{{ step.step }}</span>
                <BFormTextarea v-else v-model="step.step" rows="3" />
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div
        id="ingredients"
        class="w-25 width card rounded-0"
        v-show="showIngredients"
        :class="{ show: showIngredients }"
      >
        <div class="card-header">
          <h3 class="card-title">Zutaten</h3>
          <div v-if="!editMode" class="card-subtitle">
            für {{ formatNumbers(yields_value) }} {{ yields_unit }}
          </div>
          <div v-else class="d-flex gap-2 align-items-center mt-2">
            <span>für</span>
            <BFormInput
              :model-value="yields_value"
              @update:model-value="setYieldsValue"
              type="number"
              size="sm"
              style="width: 80px"
            />
            <BFormInput
              :model-value="yields_unit"
              @update:model-value="setYieldsUnit"
              size="sm"
              style="width: 100px"
            />
          </div>
        </div>
        <div class="card-body">
          <div
            v-for="(section, index) in current_recipe.sections"
            :id="'box-ing-' + section.section"
            class="ingredients-section"
            :key="index"
          >
            <h4>{{ section.section }}</h4>
            <div
              class="row mb-2"
              v-for="(ingredient, index) in current_recipe.ingredients.filter(
                (x) => x.section == section.section,
              )"
              :key="index"
            >
              <div v-if="!editMode" class="col-4">
                {{
                  formatNumbers(
                    ingredient[Object.keys(ingredient)[0]].amounts[0].amount,
                  )
                }}
                {{ ingredient[Object.keys(ingredient)[0]].amounts[0].unit }}
              </div>
              <div v-else class="col-4 d-flex gap-1">
                <BFormInput
                  v-model.number="
                    ingredient[Object.keys(ingredient)[0]].amounts[0].amount
                  "
                  type="number"
                  size="sm"
                  step="0.1"
                />
                <BFormInput
                  v-model="
                    ingredient[Object.keys(ingredient)[0]].amounts[0].unit
                  "
                  size="sm"
                />
              </div>
              <div v-if="!editMode" class="col-8">
                {{ Object.keys(ingredient)[0] }}
              </div>
              <div v-else class="col-8">
                <BFormInput
                  v-model="ingredient[Object.keys(ingredient)[0]].name"
                  :value="Object.keys(ingredient)[0]"
                  size="sm"
                  @input="renameIngredient(ingredient, $event)"
                />
              </div>
            </div>
          </div>

          <div v-if="!editMode">
            <h5 class="card-title">Umrechnen</h5>
            <div class="input-group">
              <input
                type="number"
                min="0"
                :value="yields_value"
                @input="setYieldsValue(Number($event.target.value))"
                step=".1"
                class="form-control"
                aria-label="Sizing example input"
                aria-describedby="inputGroup-sizing"
              />
              <div class="input-group-append">
                <span class="input-group-text" id="inputGroup-sizing">{{
                  yields_unit
                }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="card-body"></div>
      </div>
    </div>

    <!-- Floating Action Button (FAB) für Edit-Modus -->
    <BButton
      v-if="!settings.read_only && !editMode"
      @click="$router.push('/edit/' + selected)"
      class="fab-edit-button"
      variant="primary"
      title="Vollständig bearbeiten"
    >
      <i class="bi bi-pencil-square"></i>
    </BButton>
  </div>
</template>

<script>
// @ is an alias to /src
import { useRecipeHelper } from "@/composables/useRecipeHelper";
import Navbar from "@/components/Navbar.vue";
import jsyaml from "js-yaml";
import { mapState } from "vuex";
import { computed } from "vue";
import UUID from "../js/uuid";
import { deepCopyYaml } from "../js/deepCopy";

export default {
  name: "Recipe",
  components: {
    Navbar,
  },
  props: {
    selected: {
      type: Number,
      default: 0,
    },
  },
  setup(props) {
    const selectedRef = computed(() => props.selected);
    const recipeHelper = useRecipeHelper({ selected: selectedRef });

    return {
      ...recipeHelper,
    };
  },
  data() {
    return {
      showIngredients: true, // control ingredients panel visibility
      editMode: false, // inline edit mode
      originalRecipe: null, // backup for cancel
      showMetadata: false, // toggle metadata visibility
      isLandscape: false, // detect landscape orientation
    };
  },
  mounted() {
    // Restore UI state
    this.$store.dispatch("restoreUIState");
    const savedShowIngredients = this.$store.getters.recipeShowIngredients;

    //hide ingredients sidebar on default in portrait mode (unless user has preference)
    let x = window.matchMedia("(max-width: 812px)");
    if (x.matches && savedShowIngredients === true) {
      // Only hide on mobile if no saved preference
      this.showIngredients = false;
    } else {
      this.showIngredients = savedShowIngredients;
    }
    
    // Detect landscape orientation
    this.updateOrientation();
    window.addEventListener("resize", this.updateOrientation);
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.updateOrientation);
  },
  watch: {
    selected(newSelected) {
      // Reload recipe when selected prop changes (prev/next navigation)
      if (this.recipes[newSelected]) {
        this.loadRecipe(this.recipes[newSelected]);
        // Scroll to top when changing recipes
        window.scrollTo(0, 0);
      }
    },
  },
  computed: {
    ...mapState(["settings", "recipes"]),
    stepsFullWidth() {
      return !this.showIngredients;
    },
    hasMetadata() {
      if (!this.current_recipe) return false;
      return !!(
        this.current_recipe.author ||
        this.current_recipe.source_url ||
        this.current_recipe.source_book ||
        this.current_recipe.servings ||
        this.current_recipe.prep_time ||
        this.current_recipe.cook_time ||
        this.current_recipe.bake_time ||
        this.current_recipe.total_time ||
        this.current_recipe.difficulty ||
        this.current_recipe.notes
      );
    },
  },
  methods: {
    updateOrientation() {
      this.isLandscape = window.matchMedia(
        "(min-width: 768px) and (orientation: landscape)",
      ).matches;
    },
    formatNumbers: function (value) {
      if (typeof value !== "number") {
        return value;
      }
      return Number(value).toLocaleString("de-DE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    },
    getStepNumber: function (sectionName, stepIndex) {
      let count = 1;
      for (let section of this.current_recipe.sections) {
        if (section.section === sectionName) {
          return count + stepIndex;
        }
        count += this.current_recipe.steps.filter(
          (x) => x.section === section.section,
        ).length;
      }
      return count;
    },
    toggleIngredients() {
      this.showIngredients = !this.showIngredients;
      // Persist sidebar state
      this.$store.dispatch("setRecipeShowIngredients", this.showIngredients);
    },
    exportRecipe() {
      const yaml = jsyaml.dump(this.current_recipe);
      const blob = new Blob([yaml], { type: "text/yaml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${this.current_recipe.recipe_name || "recipe"}.yaml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    prevRecipe() {
      if (this.selected > 0) {
        this.$router.push("/recipe/" + (this.selected - 1));
      }
    },
    nextRecipe() {
      if (this.selected < this.recipes.length - 1) {
        this.$router.push("/recipe/" + (this.selected + 1));
      }
    },
    copyRecipe() {
      // Deep copy current recipe
      const recipe = deepCopyYaml(this.current_recipe);
      // Generate new UUID
      recipe.recipe_uuid = UUID.generateUUID();
      // Append to store
      this.$store.dispatch("appendRecipe", recipe);
      // Navigate to the new recipe (will be at the end of the list)
      this.$nextTick(() => {
        this.$router.push("/recipe/" + (this.recipes.length - 1));
      });
    },
    deleteRecipe() {
      if (
        confirm(`Rezept "${this.current_recipe.recipe_name}" wirklich löschen?`)
      ) {
        this.$store.dispatch("deleteRecipe", this.selected);
        // Navigate to gallery after deletion
        this.$router.push("/");
      }
    },
    toggleEditMode() {
      this.editMode = !this.editMode;
      if (this.editMode) {
        // Backup current recipe for cancel
        this.originalRecipe = deepCopyYaml(this.current_recipe);
      }
    },
    saveRecipe() {
      // Save changes to store
      this.$store.dispatch("updateRecipe", {
        index: this.selected,
        recipe: this.current_recipe,
      });
      this.$store.dispatch("saveToLocalStorage");
      this.editMode = false;
      this.originalRecipe = null;
    },
    cancelEdit() {
      // Restore original recipe
      if (this.originalRecipe) {
        this.current_recipe = deepCopyYaml(this.originalRecipe);
      }
      this.editMode = false;
      this.originalRecipe = null;
    },
    renameIngredient(ingredient, newName) {
      // Rename ingredient key
      const oldName = Object.keys(ingredient)[0];
      if (oldName !== newName && newName) {
        ingredient[newName] = ingredient[oldName];
        delete ingredient[oldName];
      }
    },
    selectStep: function (ev) {
      let doHighlight = !ev.target.classList.contains(
        "list-group-item-primary",
      );

      // Remove highlight from all steps
      document.querySelectorAll("#steps .list-group-item").forEach((el) => {
        el.classList.remove("list-group-item-primary");
      });
      ev.target.classList.toggle("list-group-item-primary", doHighlight);

      // Remove highlight from all ingredient sections
      document
        .querySelectorAll("#ingredients .ingredients-section")
        .forEach((el) => {
          el.classList.remove(
            "highlighted",
            "list-group-item-primary",
            "border-primary",
          );
        });

      const section = ev.target.dataset.section;
      const ingredientBox = document.querySelector("#box-ing-" + section);
      if (ingredientBox) {
        ingredientBox.classList.toggle("highlighted", doHighlight);
        ingredientBox.classList.toggle("list-group-item-primary", doHighlight);
        ingredientBox.classList.toggle("border-primary", doHighlight);
      }
    },
    toast: function (content, variant) {
      this.$bvToast.toast(content, {
        toaster: "b-toaster-bottom-left",
        // solid: true,
        appendToast: true,
        noCloseButton: true,
        variant: variant,
      });
    },
  },
};
</script>

<style scoped>
.list-group-alpha {
  list-style: lower-alpha inside;
}
.list-group-roman {
  list-style: lower-roman inside;
}
.list-group-alpha > li {
  display: list-item;
}

.collapsing.width {
  -webkit-transition-property: width, visibility;
  transition-property: width, visibility;
  width: 0;
  height: auto;
  transition-property: height, visibility;
  -webkit-transition-duration: 0.35s;
  transition-duration: 0.35s;
  -webkit-transition-timing-function: ease;
  transition-timing-function: ease;
}

svg.rotate180 {
  transform: rotate(180deg);
}

.wrapper {
  display: flex;
  width: 100%;
}

#ingredients {
  min-width: 20em;
  max-width: 20em;
  position: fixed;
  top: 56px;
  right: 0;
  height: calc(100vh - 56px);
  z-index: 999;
  /*transition: all 0.3s;*/
  transition: all 0s;
  overflow-y: auto;
}

#collapesebutton {
  position: sticky;
  right: 0;
  top: 56px;
  width: 3em;
  height: 0;
  z-index: 255;
}

#steps {
  width: calc(100% - 20em);
}

#steps.full {
  width: 100%;
}

#recipe_title_container {
  position: relative;
}

#recipe_img {
  max-height: 60vh;
  object-fit: cover; /* Do not scale the image */
  object-position: center; /* Center the image within the element */
  width: 100%;

  margin: auto;
  /*max-height: 250px;
    max-width:75vh;
    margin-bottom: 1rem;*/
}

#recipe_title {
  width: 100%;
  position: absolute;
  bottom: 0;
  background-color: rgba(230, 230, 230, 0.6);
}

.recipe-metadata {
  background-color: rgba(255, 255, 255, 0.95);
  padding: 1rem;
  border-radius: 0.375rem;
  font-size: 0.9rem;
  border: 1px solid #e0e0e0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.recipe-metadata.metadata-sidebar {
  position: fixed;
  right: 1rem;
  top: 80px;
  max-width: 320px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  z-index: 1000;
}

.metadata-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #dee2e6;
}

.metadata-header h6 {
  margin: 0;
  font-weight: 600;
}

.metadata-close {
  padding: 0.25rem 0.5rem;
  color: #6c757d;
  text-decoration: none;
}

.metadata-close:hover {
  color: #000;
}

.metadata-row {
  margin-bottom: 0.5rem;
  display: flex;
  align-items: flex-start;
}

.metadata-row:last-child {
  margin-bottom: 0;
}

.metadata-row i {
  flex-shrink: 0;
}

.metadata-row strong {
  margin-right: 0.25rem;
}

/* Mobile: Metadata unten statt sidebar */
@media (max-width: 767px) {
  .recipe-metadata.metadata-sidebar {
    position: static;
    max-width: 100%;
    max-height: none;
  }
}

.fab-edit-button {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  transition: all 0.3s ease;
}

.fab-edit-button:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
}

.my-toast {
  position: fixed;
  bottom: 2em;
  left: 2em;
}

h3,
h4,
h5,
.h3,
.h4,
.h5 {
  /*margin-top: .5rem;*/
  margin-bottom: 0.1rem;
}

.ingredients-section {
  margin: -0.25rem;
  padding: 0.25rem;
  margin-bottom: 0.5em;
}

/* Mobile optimizations */
@media (max-width: 812px) {
  #ingredients {
    min-width: 100%;
    max-width: 100%;
    position: fixed;
    top: 56px;
    left: 0;
    right: 0;
    height: calc(100vh - 56px);
    transform: translateX(100%);
    transition: transform 0.3s ease;
  }

  #ingredients.show {
    transform: translateX(0);
  }

  #steps {
    width: 100%;
  }

  #collapesebutton {
    position: fixed;
    right: 1rem;
    top: 65px;
    z-index: 1000;
    width: auto;
  }

  #collapesebutton button {
    background: rgba(0, 0, 0, 0.7);
    border-radius: 50%;
    padding: 0.5rem;
  }

  /* Larger touch targets for mobile */
  .list-group-item {
    padding: 1rem;
    font-size: 1.05rem;
    line-height: 1.5;
  }

  /* Action buttons wrapping */
  .form-inline.d-flex {
    flex-wrap: wrap;
  }
}

/* Metadata Toggle Icon - dezent */
.metadata-toggle {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10;
  font-size: 1.25rem;
  color: #6c757d;
  backdrop-filter: blur(4px);
}

.metadata-toggle:hover {
  background: rgba(255, 255, 255, 0.95);
  color: #0d6efd;
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* Metadata Overlay - Clean Modal-Like Display */
.recipe-metadata-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
  padding: 1rem;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.recipe-metadata {
  background: #212529;
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 600px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  animation: slideUp 0.3s ease;
  color: #f8f9fa;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.recipe-metadata .metadata-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.recipe-metadata .metadata-header h6 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #f8f9fa;
  display: flex;
  align-items: center;
}

.recipe-metadata .metadata-row {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  display: flex;
  align-items: start;
  line-height: 1.6;
}

.recipe-metadata .metadata-row i {
  font-size: 1.1rem;
  min-width: 24px;
}

.recipe-metadata .metadata-row strong {
  min-width: 140px;
  color: rgba(255, 255, 255, 0.8);
}

.recipe-metadata .metadata-row a {
  color: #6ea8fe;
  text-decoration: none;
  word-break: break-all;
}

.recipe-metadata .metadata-row a:hover {
  text-decoration: underline;
}

.recipe-metadata .metadata-row .badge {
  font-size: 0.875rem;
  padding: 0.35em 0.65em;
}
</style>
