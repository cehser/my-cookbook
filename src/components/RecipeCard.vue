<template>
  <div class="card recipe_card_container">
    <router-link
      :to="{ path: '/recipe/' + index }"
      class="recipe-card-link"
      :class="{ 'pointer-events-none': showTagEditor }"
    >
      <div class="recipe_card_container">
        <img class="" id="recipe_img" :src="picture_src" alt="Card image cap" />

        <!-- Quick Actions Overlay -->
        <div v-if="!read_only" class="quick-actions" @click.stop>
          <BButton
            @click.prevent.stop="showTagEditor = !showTagEditor"
            variant="info"
            size="sm"
            class="action-btn"
            :class="{ active: showTagEditor }"
            title="Tags bearbeiten"
          >
            <i class="bi bi-tags"></i>
          </BButton>
          <BButton
            @click.prevent="editRecipe"
            variant="light"
            size="sm"
            class="action-btn"
            title="Bearbeiten"
          >
            <i class="bi bi-pencil"></i>
          </BButton>
          <BButton
            @click.prevent="deleteRecipe"
            variant="danger"
            size="sm"
            class="action-btn"
            title="Löschen"
          >
            <i class="bi bi-trash"></i>
          </BButton>
        </div>

        <!-- Favoriten-Stern (immer sichtbar, linke obere Ecke) -->
        <div
          v-if="!read_only"
          class="favorite-star"
          @click.prevent="toggleFavorite"
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

        <div class="card-body recipe_title">
          <h2
            class="card-title d-flex flex-row flex-wrap justify-content-between"
          >
            <span class="card-title-text" v-html="highlightedName"></span>
          </h2>
          <p class="card-text">{{ recipe.subtitle }}</p>
          <div v-if="recipe.tags && recipe.tags.length" class="mt-2">
            <span
              v-for="(tag, idx) in recipe.tags"
              :key="idx"
              class="badge bg-secondary me-1"
              >{{ tag }}</span
            >
          </div>
        </div>
      </div>
    </router-link>
    
    <!-- Tag-Editor außerhalb des Links -->
    <div
      v-if="!read_only && showTagEditor"
      class="tag-editor"
      @click.stop
      @mousedown.stop
      @keyup.esc="showTagEditor = false"
      tabindex="-1"
    >
      <!-- Schließen-Button -->
      <BButton
        variant="link"
        size="sm"
        class="tag-editor-close"
        @click.prevent.stop="showTagEditor = false"
        title="Schließen (ESC)"
      >
        <i class="bi bi-x-lg"></i>
      </BButton>
      
      <!-- Neue Tags hinzufügen -->
      <div class="d-flex gap-1 mb-2">
        <BFormInput
          v-model="newTag"
          size="sm"
          placeholder="Neuer Tag..."
          @keyup.enter="addTag"
          @click.stop
          @mousedown.stop
        />
        <BButton size="sm" variant="primary" @click.prevent.stop="addTag">
          <i class="bi bi-plus-lg"></i>
        </BButton>
      </div>
      
      <!-- Aktuelle Tags -->
      <div v-if="recipe.tags && recipe.tags.length" class="mb-2">
        <small class="text-muted d-block mb-1">Aktuelle Tags:</small>
        <div class="d-flex flex-wrap gap-1">
          <span
            v-for="(tag, idx) in recipe.tags"
            :key="idx"
            class="badge bg-primary"
            style="cursor: pointer"
            @click.prevent.stop="removeTag(idx)"
          >
            {{ tag }} <i class="bi bi-x"></i>
          </span>
        </div>
      </div>
      
      <!-- Verfügbare Tags -->
      <div v-if="availableTags.length" class="mt-2">
        <small class="text-muted d-block mb-1">Verfügbare Tags:</small>
        <div class="d-flex flex-wrap gap-1">
          <span
            v-for="tag in availableTags"
            :key="tag"
            class="badge bg-light text-dark border"
            style="cursor: pointer"
            @click.prevent.stop="addExistingTag(tag)"
          >
            <i class="bi bi-plus-circle"></i> {{ tag }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";

interface Recipe {
  recipe_uuid: string;
  recipe_name: string;
  subtitle?: string;
  tags?: string[];
}

const props = defineProps<{
  recipe: Recipe;
  picture_src: string;
  index: number;
  highlight?: string;
  read_only: boolean;
}>();

const emit = defineEmits<{
  delete: [];
  "update:recipe": [recipe: Recipe];
}>();

const store = useStore();
const router = useRouter();
const newTag = ref("");
const showTagEditor = ref(false);

// Global ESC handler for tag editor
const handleEscapeKey = (event: KeyboardEvent) => {
  if (event.key === "Escape" && showTagEditor.value) {
    showTagEditor.value = false;
  }
};

// Setup/cleanup global ESC listener
watch(showTagEditor, (isOpen) => {
  if (isOpen) {
    window.addEventListener("keydown", handleEscapeKey);
  } else {
    window.removeEventListener("keydown", handleEscapeKey);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleEscapeKey);
});

const isFavorite = computed(() => {
  const favorites = store.state.favorites || [];
  return favorites.includes(props.recipe.recipe_uuid);
});

const allTags = computed(() => {
  const tags = new Set<string>();
  const recipes = store.state.recipes || [];
  recipes.forEach((recipe: any) => {
    if (recipe.tags) {
      recipe.tags.forEach((tag: string) => tags.add(tag));
    }
  });
  return Array.from(tags).sort();
});

const availableTags = computed(() => {
  return allTags.value.filter((tag) => !props.recipe.tags?.includes(tag));
});

const highlightedName = computed(() => {
  if (!props.highlight || !props.recipe.recipe_name) {
    return props.recipe.recipe_name;
  }
  const regex = new RegExp(`(${props.highlight})`, "gi");
  return props.recipe.recipe_name.replace(regex, "<mark>$1</mark>");
});

const toggleFavorite = () => {
  if (isFavorite.value) {
    store.dispatch("removeFavorite", props.recipe.recipe_uuid);
  } else {
    store.dispatch("addFavorite", props.recipe.recipe_uuid);
  }
};

const editRecipe = () => {
  router.push(`/edit/${props.index}`);
};

const deleteRecipe = () => {
  if (
    confirm(
      `Möchten Sie das Rezept "${props.recipe.recipe_name}" wirklich löschen?`,
    )
  ) {
    emit("delete");
  }
};

const addTag = () => {
  if (!newTag.value.trim()) return;
  
  if (!props.recipe.tags) {
    props.recipe.tags = [];
  }
  
  if (!props.recipe.tags.includes(newTag.value.trim())) {
    props.recipe.tags.push(newTag.value.trim());
    store.dispatch("setRecipe", { index: props.index, recipe: props.recipe });
  }
  
  newTag.value = "";
};

const removeTag = (index: number) => {
  if (props.recipe.tags) {
    props.recipe.tags.splice(index, 1);
    store.dispatch("setRecipe", { index: props.index, recipe: props.recipe });
  }
};

const addExistingTag = (tag: string) => {
  if (!props.recipe.tags) {
    props.recipe.tags = [];
  }
  
  if (!props.recipe.tags.includes(tag)) {
    props.recipe.tags.push(tag);
    store.dispatch("setRecipe", { index: props.index, recipe: props.recipe });
  }
};
</script>

<style scoped>
.recipe-card-link {
  text-decoration: none;
  color: inherit;
  display: block;
}

.recipe-card-link.pointer-events-none {
  pointer-events: none;
  cursor: default;
}

.recipe_card_container img {
  position: absolute;
  border-radius: calc(0.25rem - 1px);

  object-fit: cover; /* Do not scale the image */
  object-position: center; /* Center the image within the element */
  width: 100%;
  height: 100%;
  margin: auto;
}

.recipe_title {
  width: 100%;
  position: absolute;
  bottom: 0;
  background-color: rgba(230, 230, 230, 0.6);
  /*color: black;*/
}

.quick-actions {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  gap: 0.25rem;
  z-index: 10;
}

/* Edit und Delete buttons nur beim Hover zeigen */
.quick-actions .action-btn {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.recipe_card_container:hover .quick-actions .action-btn {
  opacity: 1;
}

/* Favoriten-Stern in der oberen linken Ecke */
.favorite-star {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  z-index: 10;
  cursor: pointer;
  font-size: 1.5rem;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  transition: transform 0.2s ease;
}

.favorite-star:hover {
  transform: scale(1.2);
}

/* Tag-Editor */
.tag-editor {
  background: rgba(255, 255, 255, 0.95);
  padding: 0.5rem;
  padding-top: 2rem;
  border-radius: 0.25rem;
  position: absolute;
  bottom: 3.5rem;
  left: 0.5rem;
  right: 0.5rem;
  z-index: 11;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.tag-editor:focus {
  outline: none;
}

.tag-editor-close {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  color: #6c757d;
  padding: 0.25rem 0.5rem;
  line-height: 1;
  z-index: 12;
}

.tag-editor-close:hover {
  color: #000;
}

.recipe_card_container:hover .tag-editor {
  display: block;
}

.action-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.action-btn i {
  font-size: 1.1rem;
}

.action-btn.btn-light:hover {
  background-color: #e2e6ea;
}
.recipe_title p {
  -webkit-line-clamp: 1;
  line-clamp: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
}

.card-title-text {
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  line-height: 1.3;
}

.card-title :deep(mark) {
  padding: 0 !important;
  background-color: rgba(255, 204, 0, 0.5);
}
</style>
