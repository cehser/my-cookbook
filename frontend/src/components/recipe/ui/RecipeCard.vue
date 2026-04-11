<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { useRecipeStore } from "@/store/recipeStore";
import { useDraftIndex } from "@/composables/useDraftIndex";
import { useRouter } from "vue-router";
import type { Recipe } from "@/types/recipe";
import { recipeUrl, editUrl } from "@/js/slug";

const props = defineProps<{
  recipe: Recipe;
  picture_src: string;
  index: number;
  highlight?: string;
  read_only: boolean;
  compact?: boolean;
}>();

const emit = defineEmits<{
  delete: [];
  "update:recipe": [recipe: Recipe];
}>();

const store = useRecipeStore();
const { hasDraft } = useDraftIndex();
const router = useRouter();
const newTag = ref("");
const showTagEditor = ref(false);
const fabMenuOpen = ref(false);

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
  return store.favorites.includes(props.recipe.recipe_uuid);
});

const allTags = computed(() => {
  const tags = new Set<string>();
  const recipes = store.recipes;
  recipes.forEach((recipe: Recipe) => {
    if (recipe.tags) {
      recipe.tags.forEach((tag: string) => tags.add(tag));
    }
  });
  return Array.from(tags).sort();
});

const availableTags = computed(() => {
  return allTags.value.filter((tag) => !props.recipe.tags?.includes(tag));
});

// Safe search highlighting without v-html (XSS protection)
const highlightedNameParts = computed(() => {
  if (!props.highlight || !props.recipe.recipe_name) {
    return [{ text: props.recipe.recipe_name, highlight: false }];
  }

  const parts: Array<{ text: string; highlight: boolean }> = [];
  const regex = new RegExp(`(${props.highlight})`, "gi");
  let lastIndex = 0;
  let match;

  const text = props.recipe.recipe_name;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push({
        text: text.substring(lastIndex, match.index),
        highlight: false,
      });
    }
    // Add highlighted match
    parts.push({ text: match[0], highlight: true });
    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex), highlight: false });
  }

  return parts.length > 0 ? parts : [{ text: text, highlight: false }];
});

const recipeLink = computed(() =>
  recipeUrl(props.recipe.recipe_uuid, props.recipe.recipe_name),
);

const isDraft = computed(() => hasDraft(props.recipe.recipe_uuid));

const displayTime = computed(() => {
  return (
    props.recipe.total_time ||
    props.recipe.cook_time ||
    props.recipe.prep_time ||
    null
  );
});

const toggleFavorite = () => {
  if (isFavorite.value) {
    store.removeFavorite(props.recipe.recipe_uuid);
  } else {
    store.addFavorite(props.recipe.recipe_uuid);
  }
};

const editRecipe = () => {
  router.push(editUrl(props.recipe.recipe_uuid, props.recipe.recipe_name));
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
    store.setRecipe({ index: props.index, recipe: props.recipe });
  }

  newTag.value = "";
};

const removeTag = (index: number) => {
  if (props.recipe.tags) {
    props.recipe.tags.splice(index, 1);
    store.setRecipe({ index: props.index, recipe: props.recipe });
  }
};

const addExistingTag = (tag: string) => {
  if (!props.recipe.tags) {
    props.recipe.tags = [];
  }

  if (!props.recipe.tags.includes(tag)) {
    props.recipe.tags.push(tag);
    store.setRecipe({ index: props.index, recipe: props.recipe });
  }
};
</script>

<template>
  <div class="card recipe_card_container">
    <router-link
      :to="recipeLink"
      class="recipe-card-link"
      :class="{ 'pointer-events-none': showTagEditor }"
    >
      <div class="recipe_card_container">
        <img class="" id="recipe_img" :src="picture_src" alt="Card image cap" />

        <!-- Favoriten-Stern (immer sichtbar, linke obere Ecke) -->
        <div
          v-if="!read_only && !compact"
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

        <!-- FAB mit Menü (rechts unten in der Karte) -->
        <div
          v-if="!read_only && !compact"
          class="card-fab-container"
          @click.stop
        >
          <transition name="fab-items">
            <div v-if="fabMenuOpen" class="card-fab-menu">
              <BButton
                @click.prevent.stop="
                  showTagEditor = !showTagEditor;
                  fabMenuOpen = false;
                "
                variant="light"
                size="sm"
                class="card-fab-menu-item"
                :class="{ active: showTagEditor }"
                title="Tags bearbeiten"
              >
                <i class="bi bi-tags"></i>
                <span>Tags</span>
              </BButton>
              <BButton
                @click.prevent="
                  editRecipe();
                  fabMenuOpen = false;
                "
                variant="light"
                size="sm"
                class="card-fab-menu-item"
                title="Bearbeiten"
              >
                <i class="bi bi-pencil"></i>
                <span>Bearbeiten</span>
              </BButton>
              <BButton
                @click.prevent="
                  deleteRecipe();
                  fabMenuOpen = false;
                "
                variant="danger"
                size="sm"
                class="card-fab-menu-item"
                title="Löschen"
              >
                <i class="bi bi-trash"></i>
                <span>Löschen</span>
              </BButton>
            </div>
          </transition>
          <BButton
            @click.prevent.stop="fabMenuOpen = !fabMenuOpen"
            class="card-fab-button"
            variant="primary"
            size="sm"
            :class="{ 'fab-open': fabMenuOpen }"
            title="Aktionen"
          >
            <i
              class="bi"
              :class="fabMenuOpen ? 'bi-x-lg' : 'bi-three-dots-vertical'"
            ></i>
          </BButton>
        </div>
      </div>

      <div
        class="card-body recipe_title"
        :class="{ 'card-body-compact': compact }"
      >
        <h2
          class="card-title d-flex flex-row flex-wrap justify-content-between"
        >
          <span class="card-title-text">
            <template v-for="(part, idx) in highlightedNameParts" :key="idx">
              <mark v-if="part.highlight" class="search-highlight">{{
                part.text
              }}</mark>
              <span v-else>{{ part.text }}</span>
            </template>
          </span>
        </h2>
        <template v-if="!compact">
          <p class="card-text">{{ recipe.subtitle }}</p>
          <div v-if="displayTime || isDraft" class="recipe-badges mt-1 mb-1">
            <span v-if="displayTime" class="badge bg-light text-muted me-1">
              <i class="bi bi-clock"></i> {{ displayTime }}
            </span>
            <span
              v-if="isDraft"
              class="badge bg-warning-subtle text-warning-emphasis me-1"
            >
              <i class="bi bi-pencil"></i> Entwurf
            </span>
          </div>
          <div v-if="recipe.tags && recipe.tags.length" class="mt-2">
            <span
              v-for="(tag, idx) in recipe.tags"
              :key="idx"
              class="badge bg-secondary me-1"
              >{{ tag }}</span
            >
          </div>
        </template>
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
  border-radius: var(--radius-sm);

  object-fit: cover;
  object-position: center;
  width: 100%;
  height: 100%;
  margin: auto;
}

.recipe_title {
  width: 100%;
  position: absolute;
  bottom: 0;
  background-color: rgba(230, 230, 230, 0.6);
}

[data-bs-theme="dark"] .recipe_title {
  background-color: rgba(30, 28, 26, 0.75);
}

.card-body-compact {
  padding: var(--space-1) var(--space-2);
}

.card-body-compact .card-title {
  font-size: var(--font-size-xs);
  margin-bottom: 0;
  line-height: var(--line-height-tight);
}

.quick-actions {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  display: flex;
  gap: var(--space-1);
  z-index: var(--z-actions);
}

/* Edit und Delete buttons nur beim Hover zeigen */
.quick-actions .action-btn {
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.recipe_card_container:hover .quick-actions .action-btn {
  opacity: 1;
}

/* FAB Container in der Karte (rechts oben) */
.card-fab-container {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  z-index: var(--z-actions);
  display: flex;
  flex-direction: column-reverse;
  align-items: flex-end;
}

.card-fab-menu {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
  align-items: flex-end;
}

.card-fab-menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  box-shadow: var(--shadow-md);
  white-space: nowrap;
  min-width: 120px;
  justify-content: flex-start;
}

.card-fab-menu-item i {
  font-size: 1rem;
}

.card-fab-button {
  width: var(--fab-size-small);
  height: var(--fab-size-small);
  border-radius: var(--radius-circle);
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  transition:
    var(--transition-all-normal),
    background-color var(--transition-fast);
  color: white;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
}

.card-fab-button:hover {
  background: rgba(255, 255, 255, 0.2) !important;
}

.card-fab-button.fab-open {
  transform: rotate(90deg);
  background: rgba(255, 255, 255, 0.2) !important;
}

.card-fab-button i {
  font-size: 1.2rem;
}

/* FAB Animation */
.fab-items-enter-active,
.fab-items-leave-active {
  transition: var(--transition-all-normal);
}

.fab-items-enter-from,
.fab-items-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.fab-items-enter-to,
.fab-items-leave-from {
  opacity: 1;
  transform: translateY(0);
}

/* Favoriten-Stern in der oberen linken Ecke */
.favorite-star {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  z-index: var(--z-actions);
  cursor: pointer;
  font-size: var(--font-size-xl);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  transition: transform var(--transition-fast);
}

.favorite-star:hover {
  transform: scale(1.2);
}

/* Tag-Editor */
.tag-editor {
  background: var(--color-surface-raised);
  padding: var(--space-2);
  padding-top: var(--space-6);
  border-radius: var(--radius-sm);
  position: absolute;
  bottom: 3.5rem;
  left: var(--space-2);
  right: var(--space-2);
  z-index: 11;
  box-shadow: var(--shadow-md);
}

.tag-editor:focus {
  outline: none;
}

.tag-editor-close {
  position: absolute;
  top: var(--space-1);
  right: var(--space-1);
  color: var(--color-text-muted);
  padding: var(--space-1) var(--space-2);
  line-height: 1;
  z-index: 12;
}

.tag-editor-close:hover {
  color: var(--color-text);
}

.recipe_card_container:hover .tag-editor {
  display: block;
}

.action-btn {
  width: var(--action-btn-size-small);
  height: var(--action-btn-size-small);
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
}

.action-btn i {
  font-size: 1.1rem;
}

.action-btn.btn-light:hover {
  background-color: var(--color-divider);
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

/* Search highlighting without v-html (XSS-safe) */
.search-highlight {
  padding: 0 !important;
  background-color: rgba(255, 204, 0, 0.5);
  border-radius: 2px;
}
</style>
