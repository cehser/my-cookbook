<template>
  <div id="recipe">
    <Navbar
      @input="selected = $event"
      :recipes_list="recipes_list"
      :selected="selected"
      :read_only="settings.read_only"
    />
    
    <!-- Desktop/Tablet: Split-View Layout -->
    <div v-if="isDesktopOrTablet" class="recipe-container split-view">
      <div class="split-layout">
        <!-- Left Column: Sticky Ingredients -->
        <aside class="ingredients-column">
          <div class="sticky-wrapper">
            <div class="card rounded-0">
              <div class="card-header">
                <h3 class="card-title mb-0">Zutaten</h3>
                <div v-if="!editMode" class="card-subtitle mt-2">
                  für {{ formatNumbers(yields_value) }} {{ yields_unit }}
                </div>
                
                <!-- Filter Toggle (Desktop) -->
                <div v-if="!editMode && current_recipe.sections.length > 1" class="filter-controls mt-2">
                  <BButton
                    size="sm"
                    :variant="showAllIngredients ? 'primary' : 'outline-secondary'"
                    @click="showAllIngredients = true"
                  >
                    Alle Zutaten
                  </BButton>
                  <BButton
                    v-if="activeSection"
                    size="sm"
                    :variant="!showAllIngredients ? 'primary' : 'outline-secondary'"
                    @click="showAllIngredients = false"
                  >
                    Nur aktuell
                  </BButton>
                </div>
              </div>
              <div class="card-body">
                <div
                  v-for="(section, index) in visibleDesktopSections"
                  :key="'desktop-ing-' + index"
                  class="ingredients-section"
                  :class="{ active: section.section === activeSection }"
                  :data-section="section.section"
                >
                  <h5>{{ section.section }}</h5>
                  <div
                    class="row mb-2"
                    v-for="(ingredient, idx) in getIngredients(section.section)"
                    :key="'ing-' + idx"
                  >
                    <div class="col-4">
                      {{
                        formatNumbers(
                          ingredient[Object.keys(ingredient)[0]].amounts[0]
                            .amount,
                        )
                      }}
                      {{ ingredient[Object.keys(ingredient)[0]].amounts[0].unit }}
                    </div>
                    <div class="col-8">
                      {{ Object.keys(ingredient)[0] }}
                    </div>
                  </div>
                </div>

                <div v-if="!editMode" class="mt-3">
                  <h5 class="card-title">Umrechnen</h5>
                  <div class="input-group">
                    <input
                      type="number"
                      min="0"
                      :value="yields_value"
                      @input="setYieldsValue(Number($event.target.value))"
                      step=".1"
                      class="form-control"
                    />
                    <div class="input-group-append">
                      <span class="input-group-text">{{ yields_unit }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <!-- Right Column: Recipe Content -->
        <main class="steps-column">
          <div class="card rounded-0">
            <div id="recipe_title_container" class="recipe-image-container">
              <img
                class="card-img-top rounded-0"
                id="recipe_img"
                :src="picture_src"
                alt="Rezeptbild"
              />
              <!-- Favoriten-Stern (immer sichtbar, links oben) -->
              <div
                v-if="!settings.read_only"
                class="favorite-star"
                @click.prevent.stop="toggleFavorite"
              >
                <i
                  class="bi"
                  :class="
                    isFavorite ? 'bi-star-fill text-warning' : 'bi-star text-white'
                  "
                  :title="
                    isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'
                  "
                ></i>
              </div>
              <div class="card-body" id="recipe_title">
                <h2 class="card-title">
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
                <p v-if="!editMode && current_recipe.subtitle" class="card-text">
                  {{ current_recipe.subtitle }}
                </p>
                <BFormInput
                  v-else-if="editMode"
                  v-model="current_recipe.subtitle"
                  placeholder="Untertitel"
                />

                <!-- Metadaten-Toggle-Icon (dezent) -->
                <div
                  v-if="hasMetadata"
                  class="metadata-toggle"
                  @click="showMetadata = !showMetadata"
                  :title="
                    showMetadata ? 'Metadaten ausblenden' : 'Metadaten anzeigen'
                  "
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
                        <i class="bi bi-info-circle me-2"></i
                        >Rezeptinformationen
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
                      v-if="
                        current_recipe.source_url || current_recipe.source_book
                      "
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
                :data-step-section="section.section"
                class="step-section"
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
        </main>
      </div>
    </div>

    <!-- Mobile: Bottom Bar Layout -->
    <div v-else class="recipe-container mobile-view">
      <div class="recipe-content">
        <div class="card rounded-0">
          <div id="recipe_title_container" class="recipe-image-container">
            <img
              class="card-img-top rounded-0"
              id="recipe_img"
              :src="picture_src"
              alt="Rezeptbild"
            />
            
            <!-- Favoriten-Stern (immer sichtbar, links oben) -->
            <div
              v-if="!settings.read_only"
              class="favorite-star"
              @click.prevent.stop="toggleFavorite"
            >
              <i
                class="bi"
                :class="
                  isFavorite ? 'bi-star-fill text-warning' : 'bi-star text-white'
                "
                :title="
                  isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'
                "
              ></i>
            </div>
            <div class="card-body" id="recipe_title">
              <h2 class="card-title">
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
              <p v-if="!editMode && current_recipe.subtitle" class="card-text">
                {{ current_recipe.subtitle }}
              </p>
              <BFormInput
                v-else-if="editMode"
                v-model="current_recipe.subtitle"
                placeholder="Untertitel"
              />

              <!-- Metadaten-Toggle-Icon -->
              <div
                v-if="hasMetadata"
                class="metadata-toggle"
                @click="showMetadata = !showMetadata"
                :title="
                  showMetadata ? 'Metadaten ausblenden' : 'Metadaten anzeigen'
                "
              >
                <i class="bi bi-info-circle"></i>
              </div>

              <!-- Metadaten Mobile (Same as Desktop for now) -->
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
              :key="'mobile-section-' + sectionIndex"
              :data-step-section="section.section"
              class="step-section"
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
                  :key="'mobile-step-' + stepIndex"
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
      </div>

      <!-- Mobile Bottom Bar -->
      <div
        class="ingredients-bottom-bar"
        :class="{ expanded: ingredientsExpanded }"
      >
        <!-- Collapsed State -->
        <div
          v-if="!ingredientsExpanded"
          class="bottom-bar-collapsed"
          @click="openIngredientsBar"
        >
          <i class="bi bi-list-ul"></i>
          <span class="bar-title">Zutaten</span>
          <span v-if="activeSection" class="active-section-chip">
            • {{ activeSection }}
          </span>
          <i class="bi bi-chevron-up"></i>
        </div>

        <!-- Expanded State -->
        <div v-else class="bottom-bar-expanded">
          <div class="bar-header">
            <h6><i class="bi bi-list-ul me-2"></i>Zutaten</h6>
            <button class="btn-close-custom" @click="closeIngredientsBar">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>

          <!-- Filter Toggle -->
          <div class="filter-toggle">
            <BButton
              size="sm"
              :variant="showOnlyCurrentSection ? 'primary' : 'outline-secondary'"
              @click="showOnlyCurrentSection = true"
            >
              Nur aktuell
            </BButton>
            <BButton
              size="sm"
              :variant="!showOnlyCurrentSection ? 'primary' : 'outline-secondary'"
              @click="showOnlyCurrentSection = false"
            >
              Alle
            </BButton>
          </div>

          <!-- Ingredients Content -->
          <div class="ingredients-content">
            <div
              v-for="(section, index) in visibleIngredientSections"
              :key="'mobile-ing-section-' + index"
              class="ingredient-section"
              :class="{ active: section.section === activeSection }"
              :data-section="section.section"
            >
              <h6>{{ section.section }}</h6>
              <div
                v-for="(ingredient, idx) in getIngredients(section.section)"
                :key="'mobile-ing-' + idx"
                class="ingredient-item"
              >
                <input type="checkbox" class="me-2" />
                {{
                  formatNumbers(
                    ingredient[Object.keys(ingredient)[0]].amounts[0].amount,
                  )
                }}
                {{ ingredient[Object.keys(ingredient)[0]].amounts[0].unit }}
                {{ Object.keys(ingredient)[0] }}
              </div>
            </div>
          </div>

          <!-- Section Quick-Jump Chips -->
          <div
            v-if="
              !showOnlyCurrentSection && current_recipe.sections.length > 1
            "
            class="section-chips"
          >
            <BButton
              v-for="section in current_recipe.sections"
              :key="'chip-' + section.section"
              size="sm"
              :variant="
                section.section === activeSection
                  ? 'primary'
                  : 'outline-secondary'
              "
              @click="scrollToIngredientSection(section.section)"
            >
              {{ section.section }}
            </BButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating Action Button (FAB) mit Menü -->
    <div v-if="!editMode" class="fab-container" :class="{ 'read-only': settings.read_only }">
      <transition name="fab-items">
        <div v-if="fabMenuOpen" class="fab-menu">
          <!-- Actions (nur wenn nicht read-only) -->
          <template v-if="!settings.read_only">
            <BButton
              @click="toggleEditMode(); fabMenuOpen = false"
              class="fab-menu-item"
              variant="light"
              size="sm"
              title="Inline bearbeiten"
            >
              <i class="bi bi-pencil"></i>
              <span>Inline-Edit</span>
            </BButton>
            <BButton
              @click="goToEdit(); fabMenuOpen = false"
              class="fab-menu-item"
              variant="light"
              size="sm"
              title="Vollständig bearbeiten"
            >
              <i class="bi bi-pencil-square"></i>
              <span>Bearbeiten</span>
            </BButton>
            <BButton
              @click="copyRecipe(); fabMenuOpen = false"
              class="fab-menu-item"
              variant="light"
              size="sm"
              title="Duplizieren"
            >
              <i class="bi bi-files"></i>
              <span>Duplizieren</span>
            </BButton>
            <BButton
              @click="deleteRecipe(); fabMenuOpen = false"
              class="fab-menu-item"
              variant="danger"
              size="sm"
              title="Löschen"
            >
              <i class="bi bi-trash"></i>
              <span>Löschen</span>
            </BButton>
          </template>
          
          <!-- Export (nur im Expert-Modus) -->
          <BButton
            v-if="settings.expert_mode"
            @click="exportRecipe(); fabMenuOpen = false"
            class="fab-menu-item"
            variant="light"
            size="sm"
            title="Als YAML exportieren"
          >
            <i class="bi bi-download"></i>
            <span>YAML Export</span>
          </BButton>
        </div>
      </transition>
      <BButton
        @click="fabMenuOpen = !fabMenuOpen"
        class="fab-edit-button fab-main"
        variant="primary"
        :class="{ 'fab-open': fabMenuOpen }"
        title="Menü"
      >
        <i class="bi" :class="fabMenuOpen ? 'bi-x-lg' : 'bi-three-dots-vertical'"></i>
      </BButton>
    </div>
  </div>
</template>

<script>
// @ is an alias to /src
import { useRecipeHelper } from "@/composables/useRecipeHelper";
import { useViewport } from "@/composables/useViewport";
import Navbar from "@/components/Navbar.vue";
import jsyaml from "js-yaml";
import { mapState } from "vuex";
import { computed, ref, nextTick } from "vue";
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
    const viewport = useViewport();
    
    // Mobile Bottom Bar State
    const ingredientsExpanded = ref(false);
    const showOnlyCurrentSection = ref(true); // Mobile: Default only current section
    const activeSection = ref(null);
    
    // Desktop Filter State
    const showAllIngredients = ref(true); // Desktop: Default show all
    
    // FAB Menu State (Mobile)
    const fabMenuOpen = ref(false);

    return {
      ...recipeHelper,
      ...viewport,
      ingredientsExpanded,
      showOnlyCurrentSection,
      showAllIngredients,
      activeSection,
      fabMenuOpen,
    };
  },
  data() {
    return {
      showIngredients: true, // control ingredients panel visibility
      editMode: false, // inline edit mode
      originalRecipe: null, // backup for cancel
      showMetadata: false, // toggle metadata visibility
      observer: null, // Intersection Observer instance
      sectionUpdateTimeout: null, // Debounce timeout for section updates
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
    
    // Setup Intersection Observer
    this.$nextTick(() => {
      this.observeStepSections();
    });
  },
  beforeUnmount() {
    window.removeEventListener("scroll", this.handleScroll);
    // Cleanup Intersection Observer
    if (this.observer) {
      this.observer.disconnect();
    }
    // Cleanup debounce timeout
    if (this.sectionUpdateTimeout) {
      clearTimeout(this.sectionUpdateTimeout);
    }
  },
  watch: {
    selected(newSelected) {
      // Reload recipe when selected prop changes (prev/next navigation)
      if (this.recipes[newSelected]) {
        this.loadRecipe(this.recipes[newSelected]);
        // Scroll to top when changing recipes
        window.scrollTo(0, 0);
        // Re-observe step sections
        this.$nextTick(() => {
          this.observeStepSections();
        });
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
    // Mobile: Filtered sections for bottom bar
    visibleIngredientSections() {
      if (this.showOnlyCurrentSection && this.activeSection) {
        return this.current_recipe.sections.filter(
          (section) => section.section === this.activeSection,
        );
      }
      return this.current_recipe.sections;
    },
    // Desktop: Filtered sections for split-view
    visibleDesktopSections() {
      if (!this.showAllIngredients && this.activeSection) {
        return this.current_recipe.sections.filter(
          (section) => section.section === this.activeSection,
        );
      }
      return this.current_recipe.sections;
    },
    // Check if current recipe is in favorites
    isFavorite() {
      if (!this.current_recipe || !this.current_recipe.recipe_uuid) {
        return false;
      }
      const favorites = this.$store.state.favorites || [];
      return favorites.includes(this.current_recipe.recipe_uuid);
    },
  },
  methods: {
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
    toggleFavorite() {
      if (!this.current_recipe || !this.current_recipe.recipe_uuid) {
        return;
      }
      if (this.isFavorite) {
        this.$store.dispatch("removeFavorite", this.current_recipe.recipe_uuid);
      } else {
        this.$store.dispatch("addFavorite", this.current_recipe.recipe_uuid);
      }
    },
    goToEdit() {
      this.$router.push(`/edit/${this.selected}`);
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
    // Mobile Bottom Bar Controls
    openIngredientsBar() {
      this.ingredientsExpanded = true;

      // Smart scroll to active section (when "Alle" active)
      if (!this.showOnlyCurrentSection && this.activeSection) {
        nextTick(() => {
          const sectionEl = document.querySelector(
            `.ingredient-section[data-section="${this.activeSection}"]`,
          );
          sectionEl?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    },
    closeIngredientsBar() {
      this.ingredientsExpanded = false;
    },
    scrollToIngredientSection(sectionName) {
      const sectionEl = document.querySelector(
        `.ingredient-section[data-section="${sectionName}"]`,
      );
      sectionEl?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    getIngredients(sectionName) {
      return this.current_recipe.ingredients.filter(
        (ing) => ing.section === sectionName,
      );
    },
    // Intersection Observer Setup
    observeStepSections() {
      // Cleanup existing observer
      if (this.observer) {
        this.observer.disconnect();
      }

      const stepSections = document.querySelectorAll("[data-step-section]");

      if (stepSections.length === 0) {
        // Retry after a short delay (DOM might not be ready)
        setTimeout(() => this.observeStepSections(), 100);
        return;
      }

      this.observer = new IntersectionObserver(
        () => {
          // Clear previous timeout
          if (this.sectionUpdateTimeout) {
            clearTimeout(this.sectionUpdateTimeout);
          }

          // Debounce section updates to prevent flickering
          this.sectionUpdateTimeout = setTimeout(() => {
            // Query all sections to find the most visible one
            const allSections = document.querySelectorAll("[data-step-section]");
            let maxVisibility = 0;
            let mostVisibleSection = null;

            allSections.forEach((section) => {
              const rect = section.getBoundingClientRect();
              const viewportHeight = window.innerHeight;
              
              // Calculate how much of the section is visible
              const visibleTop = Math.max(0, rect.top);
              const visibleBottom = Math.min(viewportHeight, rect.bottom);
              const visibleHeight = Math.max(0, visibleBottom - visibleTop);
              
              // Prioritize sections in the upper half of viewport
              const centerOffset = Math.abs((rect.top + rect.height / 2) - viewportHeight / 3);
              const visibility = visibleHeight - centerOffset * 0.5;

              if (visibility > maxVisibility && visibleHeight > 50) {
                maxVisibility = visibility;
                mostVisibleSection = section.getAttribute("data-step-section");
              }
            });

            if (mostVisibleSection && mostVisibleSection !== this.activeSection) {
              this.activeSection = mostVisibleSection;
            }
          }, 150); // 150ms debounce
        },
        {
          threshold: [0, 0.5, 1],
          rootMargin: "-100px 0px -200px 0px",
        },
      );

      stepSections.forEach((section) => this.observer.observe(section));

      // Add scroll listener for last section detection
      this.handleScroll();
      window.addEventListener("scroll", this.handleScroll);
    },
    handleScroll() {
      // Detect if scrolled to bottom (within 100px)
      const scrollPosition = window.innerHeight + window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;

      if (scrollPosition >= documentHeight - 100) {
        // Set last section as active
        const lastSection = this.current_recipe.sections[
          this.current_recipe.sections.length - 1
        ];
        if (lastSection) {
          this.activeSection = lastSection.section;
        }
      }
    },
  },
};
</script>

<style scoped>
/* ============================================
   DESKTOP/TABLET: SPLIT-VIEW LAYOUT
   ============================================ */
@media (min-width: 768px) {
  .recipe-container.split-view {
    width: 100%;
    min-height: 100vh;
  }

  .split-layout {
    display: grid;
    grid-template-columns: 35% 65%;
    gap: 2rem;
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
  }

  @media (max-width: 1024px) and (min-width: 768px) {
    .split-layout {
      grid-template-columns: 40% 60%;
      gap: 1.5rem;
      padding: 1.5rem;
    }
  }

  .ingredients-column {
    position: relative;
  }

  .sticky-wrapper {
    position: sticky;
    top: calc(56px + 1rem);
    max-height: calc(100vh - 56px - 2rem);
    overflow-y: auto;
  }

  .steps-column {
    min-height: 100vh;
  }

  /* Desktop Filter Controls */
  .filter-controls {
    display: flex;
    gap: 0.5rem;
  }

  .filter-controls .btn {
    font-size: 0.875rem;
  }

  /* Desktop Ingredients Section Highlighting */
  .ingredients-column .ingredients-section {
    padding: 1rem;
    margin-bottom: 1rem;
    border-radius: 8px;
    background: var(--bs-light);
    transition: all 0.3s ease;
    border-left: 4px solid transparent;
  }

  .ingredients-column .ingredients-section.active {
    background: rgba(var(--bs-primary-rgb), 0.1);
    border-left-color: var(--bs-primary);
    padding-left: calc(1rem - 4px);
  }

  .ingredients-column .ingredients-section h5 {
    transition: color 0.3s ease;
  }

  .ingredients-column .ingredients-section.active h5 {
    color: var(--bs-primary);
    font-weight: 600;
  }
}

/* ============================================
   MOBILE: BOTTOM BAR LAYOUT
   ============================================ */
@media (max-width: 767px) {
  .recipe-container.mobile-view {
    position: relative;
    padding-bottom: 80px;
  }

  .ingredients-bottom-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
    background: white;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.15);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Collapsed State */
  .bottom-bar-collapsed {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
    color: var(--bs-primary);
  }

  .bottom-bar-collapsed .bar-title {
    flex: 1;
  }

  .bottom-bar-collapsed .active-section-chip {
    font-size: 0.85rem;
    color: var(--bs-secondary);
    font-weight: 400;
  }

  /* Expanded State */
  .ingredients-bottom-bar.expanded {
    max-height: 60vh;
    height: auto;
  }

  .bottom-bar-expanded {
    display: flex;
    flex-direction: column;
    max-height: 60vh;
    padding: 1rem;
  }

  .bar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--bs-border-color);
  }

  .bar-header h6 {
    margin: 0;
    font-weight: 600;
  }

  .btn-close-custom {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.25rem;
    color: var(--bs-secondary);
  }

  /* Filter Toggle */
  .filter-toggle {
    display: flex;
    gap: 0.5rem;
    margin: 1rem 0;
  }

  .filter-toggle .btn {
    flex: 1;
  }

  /* Ingredients Content */
  .ingredients-content {
    overflow-y: auto;
    max-height: calc(60vh - 180px);
    margin: 0.5rem 0;
  }

  .ingredient-section {
    padding: 1rem;
    margin-bottom: 1rem;
    border-radius: 8px;
    background: var(--bs-light);
    transition: all 0.3s ease;
  }

  .ingredient-section.active {
    background: rgba(var(--bs-primary-rgb), 0.1);
    border-left: 4px solid var(--bs-primary);
    padding-left: calc(1rem - 4px);
  }

  .ingredient-section h6 {
    margin-bottom: 0.75rem;
    font-size: 1rem;
    font-weight: 600;
  }

  .ingredient-section.active h6 {
    color: var(--bs-primary);
  }

  .ingredient-item {
    margin-bottom: 0.5rem;
    line-height: 1.5;
  }

  /* Section Chips */
  .section-chips {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 0;
    overflow-x: auto;
    border-top: 1px solid var(--bs-border-color);
  }

  .section-chips .btn {
    white-space: nowrap;
  }
}

/* ============================================
   COMMON STYLES
   ============================================ */
#recipe_title_container {
  position: relative;
}

#recipe_img {
  max-height: 60vh;
  object-fit: cover;
  object-position: center;
  width: 100%;
  margin: auto;
}

#recipe_title {
  width: 100%;
  position: absolute;
  bottom: 0;
  background-color: rgba(230, 230, 230, 0.6);
}

.ingredients-section {
  margin-bottom: 1.5rem;
}

.ingredients-section h5 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: var(--bs-dark);
}

/* Step Section Highlighting (optional visual feedback) */
.step-section {
  margin-bottom: 2rem;
  scroll-margin-top: 100px;
}

.step-section h4 {
  margin-top: 0.5rem;
  margin-bottom: 0.75rem;
}

/* Metadata Toggle Icon */
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

/* Metadata Overlay */
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

/* FAB Edit Button */
.fab-edit-button {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
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

/* List Styles */
.list-group-alpha {
  list-style: lower-alpha inside;
}

.list-group-roman {
  list-style: lower-roman inside;
}

.list-group-alpha > li {
  display: list-item;
}

/* Step Sections */
.step-section {
  margin-bottom: 2rem;
}

.step-section h4 {
  margin-top: 0.5rem;
  margin-bottom: 0.75rem;
}

/* Quick Actions on Recipe Image */
.recipe-image-container {
  position: relative;
}

/* Desktop: Show all action buttons */
.quick-actions.desktop-actions {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  gap: 0.25rem;
  z-index: 10;
}

.quick-actions .action-btn {
  width: 40px;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  border: none;
  transition: all 0.2s ease;
}

.quick-actions .action-btn i {
  font-size: 1.2rem;
}

.quick-actions .action-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.quick-actions .action-btn.btn-warning {
  background-color: #ffc107;
  color: #000;
}

.quick-actions .action-btn.btn-light {
  background-color: rgba(255, 255, 255, 0.9);
}

.quick-actions .action-btn.btn-light:hover {
  background-color: #fff;
}

/* Mobile/Tablet: Only favorite star (no button style, like in gallery) */
.favorite-star {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  z-index: 10;
  cursor: pointer;
  font-size: 1.8rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  transition: transform 0.2s ease;
}

.favorite-star:hover {
  transform: scale(1.15);
}

/* FAB Container and Menu */
.fab-container {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 1000;
  display: flex;
  flex-direction: column; /* Menü ÜBER Button */
  align-items: flex-end;
}

.fab-menu {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem; /* Abstand zum FAB-Button */
  align-items: flex-end;
}

.fab-menu-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  border-radius: 24px;
  white-space: nowrap;
  min-width: 140px;
  justify-content: flex-start;
}

.fab-menu-item i {
  font-size: 1.1rem;
}

.fab-menu-item span {
  font-weight: 500;
}

.fab-main {
  transition: transform 0.3s ease;
}

.fab-main.fab-open {
  transform: rotate(90deg);
}

.fab-items-enter-active,
.fab-items-leave-active {
  transition: all 0.3s ease;
}

.fab-items-enter-from,
.fab-items-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.fab-items-enter-to,
.fab-items-leave-from {
  opacity: 1;
  transform: translateY(0);
}

/* Responsive adjustments */
@media (max-width: 767px) {
  /* Mobile: FAB deutlich höher positionieren wegen Bottom-Bar */
  .fab-container {
    bottom: 7rem; /* Über der Bottom-Bar */
  }

  .list-group-item {
    padding: 1rem;
    font-size: 1.05rem;
    line-height: 1.5;
  }
}

@media (min-width: 768px) {
  /* Desktop/Tablet: Normale FAB Position */
  .fab-container {
    bottom: 2rem;
    right: 2rem;
  }
}
</style>
