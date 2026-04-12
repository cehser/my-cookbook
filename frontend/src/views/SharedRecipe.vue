<script setup lang="ts">
import { ref, onMounted } from "vue";
import RecipeDisplay from "@/components/recipe/display/RecipeDisplay.vue";
import type { Recipe } from "@/types/recipe";

const props = defineProps<{ token: string }>();

const loading = ref(true);
const error = ref<string | null>(null);
const current_recipe = ref<Recipe | null>(null);
const sharedBy = ref("");
const sharedAt = ref("");
const imageSrc = ref<string | null>(null);

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

onMounted(async () => {
  try {
    const response = await fetch(
      `/api/v1/shared/${encodeURIComponent(props.token)}`,
    );
    if (!response.ok) {
      if (response.status === 404) {
        error.value = "Dieser Link ist ungültig oder abgelaufen.";
      } else if (response.status === 410) {
        error.value = "Dieser Share-Link ist abgelaufen.";
      } else {
        error.value = "Fehler beim Laden des Rezepts.";
      }
      return;
    }
    const json = await response.json();
    const data = json.data || {};
    current_recipe.value = {
      recipe_uuid: "",
      recipe_name: json.recipe_name,
      subtitle: data.subtitle,
      author: data.author,
      source_url: data.source_url,
      source_book: data.source_book,
      prep_time: data.prep_time,
      cook_time: data.cook_time,
      bake_time: data.bake_time,
      total_time: data.total_time,
      servings: data.servings,
      difficulty: data.difficulty,
      notes: data.notes,
      yields: data.yields || [],
      ingredients: data.ingredients || [],
      steps: data.steps || [],
      sections: data.sections || [{ section: "" }],
      recalc_exp: data.recalc_exp,
      tags: json.tags || [],
      imageurl: null,
      lastUpdated: json.shared_at,
      first_image_id: json.first_image_id,
    };
    if (json.first_image_id) {
      imageSrc.value = `/api/v1/images/${json.first_image_id}`;
    }
    sharedBy.value = json.shared_by;
    sharedAt.value = formatDate(json.shared_at);
  } catch {
    error.value = "Netzwerkfehler — bitte versuche es später erneut.";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div id="recipe" :class="{ 'shared-mode': true }">
    <!-- Minimale Navbar -->
    <nav class="shared-navbar sticky-top">
      <div class="container-fluid">
        <span class="navbar-brand">Kochbuch</span>
        <span class="badge bg-secondary"
          ><i class="bi bi-share"></i> Geteiltes Rezept</span
        >
      </div>
    </nav>

    <!-- Loading -->
    <div v-if="loading" class="text-center mt-5">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">Laden...</span>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="container mt-5">
      <div class="alert alert-warning text-center">
        <i class="bi bi-exclamation-triangle me-2"></i>{{ error }}
      </div>
    </div>

    <template v-else-if="current_recipe">
      <RecipeDisplay
        :recipe="current_recipe"
        :image-src="imageSrc || '/placeholder-image.png'"
      />
    </template>

    <!-- Footer -->
    <div v-if="!loading && !error && current_recipe" class="container">
      <hr />
      <p class="text-muted small pb-3">
        Geteilt von <strong>{{ sharedBy }}</strong> am {{ sharedAt }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.shared-navbar {
  display: flex;
  align-items: center;
  height: var(--view-header-height);
  padding: 0 var(--space-3);
  background: var(--color-chrome);
  color: var(--color-chrome-text);
}

.shared-navbar .container-fluid {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.shared-navbar .navbar-brand {
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-lg);
  color: var(--color-chrome-text);
}
</style>
