<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { useRecipeStore } from "@/store/recipeStore";
import RecipeGrid from "@/components/recipe/ui/RecipeGrid.vue";

const store = useRecipeStore();

const searchInput = ref<HTMLInputElement | null>(null);
const filter = ref("");
const selectedTags = ref<string[]>([]);
const selectedAuthor = ref<string | null>(null);
const selectedDifficulty = ref<string | null>(null);

// Computed
const settings = computed(() => store.settings);

const allTags = computed(() => {
  const tags = new Set<string>();
  store.recipes.forEach((recipe) => {
    if (recipe.tags) {
      recipe.tags.forEach((tag: string) => tags.add(tag));
    }
  });
  return Array.from(tags).sort();
});

const allAuthors = computed(() => {
  const authors = new Set<string>();
  store.recipes.forEach((recipe) => {
    if (recipe.author) {
      authors.add(recipe.author);
    }
  });
  return Array.from(authors).sort();
});

const hasActiveFilters = computed(() => {
  return (
    filter.value ||
    selectedTags.value.length > 0 ||
    selectedAuthor.value ||
    selectedDifficulty.value
  );
});

const filteredRecipes = computed(() => {
  const recipesWithIndex = store.recipes.map((recipe, index) => ({
    ...recipe,
    originalIndex: index,
  }));

  const q = filter.value.toLowerCase();

  return recipesWithIndex.filter((recipe) => {
    const matchesText =
      !q ||
      recipe.recipe_name.toLowerCase().includes(q) ||
      recipe.ingredients?.some((ing) => ing.name.toLowerCase().includes(q)) ||
      recipe.steps?.some((s) => s.step.toLowerCase().includes(q));

    const matchesTags =
      selectedTags.value.length === 0 ||
      (recipe.tags &&
        selectedTags.value.some((tag) => recipe.tags!.includes(tag)));

    const matchesAuthor =
      !selectedAuthor.value || recipe.author === selectedAuthor.value;

    const matchesDifficulty =
      !selectedDifficulty.value ||
      recipe.difficulty === selectedDifficulty.value;

    return matchesText && matchesTags && matchesAuthor && matchesDifficulty;
  });
});

// Methods
function toggleTag(tag: string) {
  const index = selectedTags.value.indexOf(tag);
  if (index > -1) {
    selectedTags.value.splice(index, 1);
  } else {
    selectedTags.value.push(tag);
  }
}

function clearAllFilters() {
  filter.value = "";
  selectedTags.value = [];
  selectedAuthor.value = null;
  selectedDifficulty.value = null;
}

function handleDeleteRecipe(uuid: string) {
  store.deleteRecipe(uuid);
}

// Auto-focus search on mount
onMounted(() => {
  nextTick(() => {
    searchInput.value?.focus();
  });
});
</script>

<template>
  <div id="search-view">
    <BContainer fluid>
      <!-- Search input -->
      <div class="search-bar mt-3 mb-2">
        <div class="position-relative">
          <i class="bi bi-search search-icon"></i>
          <input
            ref="searchInput"
            v-model="filter"
            type="text"
            class="form-control form-control-lg search-input"
            placeholder="Rezepte, Zutaten, Schritte..."
          />
          <button
            v-if="filter"
            class="btn-clear"
            @click="filter = ''"
            title="Suche leeren"
          >
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="d-flex flex-wrap gap-2 align-items-center mb-2">
        <!-- Author -->
        <BFormSelect
          v-model="selectedAuthor"
          size="sm"
          style="width: auto; max-width: 150px"
        >
          <option :value="null">Alle Autoren</option>
          <option v-for="author in allAuthors" :key="author" :value="author">
            {{ author }}
          </option>
        </BFormSelect>

        <!-- Difficulty -->
        <BFormSelect
          v-model="selectedDifficulty"
          size="sm"
          style="width: auto; max-width: 140px"
        >
          <option :value="null">Schwierigkeit</option>
          <option value="easy">Einfach</option>
          <option value="medium">Mittel</option>
          <option value="hard">Schwer</option>
        </BFormSelect>

        <!-- Clear -->
        <BButton
          v-if="hasActiveFilters"
          @click="clearAllFilters"
          size="sm"
          variant="outline-secondary"
          title="Alle Filter zurücksetzen"
        >
          <i class="bi bi-x-circle"></i>
        </BButton>
      </div>

      <!-- Tags -->
      <div v-if="allTags.length" class="mb-3">
        <div class="d-flex flex-wrap gap-1">
          <span
            v-for="tag in allTags"
            :key="tag"
            @click="toggleTag(tag)"
            class="badge tag-chip"
            :class="
              selectedTags.includes(tag)
                ? 'bg-primary text-white'
                : 'bg-light text-dark border'
            "
          >
            {{ tag }}
          </span>
        </div>
      </div>

      <!-- Results -->
      <template v-if="hasActiveFilters">
        <p class="text-muted small mb-2">
          {{ filteredRecipes.length }} Ergebnis{{
            filteredRecipes.length !== 1 ? "se" : ""
          }}
        </p>
        <RecipeGrid
          :recipes="filteredRecipes"
          :read-only="settings.read_only"
          :highlight="filter"
          @delete="handleDeleteRecipe"
        />
      </template>

      <!-- Empty state -->
      <div v-else class="text-center text-muted mt-5">
        <i class="bi bi-search" style="font-size: 3rem; opacity: 0.3"></i>
        <p class="mt-2">
          Suche nach Rezepten, Zutaten oder Zubereitungsschritten
        </p>
      </div>
    </BContainer>
  </div>
</template>

<style scoped>
.search-bar {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  font-size: 1.1rem;
  z-index: 1;
  pointer-events: none;
}

.search-input {
  padding-left: 42px;
  padding-right: 42px;
  border-radius: var(--radius-md, 12px);
  border: 2px solid #dee2e6;
  transition: border-color var(--transition-fast, 0.2s ease);
}

.search-input:focus {
  border-color: var(--bs-primary, #0d6efd);
  box-shadow: none;
}

.btn-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: #6c757d;
  padding: 8px;
  cursor: pointer;
  font-size: 0.9rem;
}

.tag-chip {
  font-size: 0.8rem;
  padding: 0.3rem 0.6rem;
  cursor: pointer;
  transition: all 0.15s ease;
  font-weight: 400;
}

.tag-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}
</style>
