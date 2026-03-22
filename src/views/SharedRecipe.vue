<template>
  <div class="container py-4">
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Rezept wird geladen...</span>
      </div>
    </div>
    <div v-else-if="error" class="alert alert-warning text-center">
      <i class="bi bi-exclamation-triangle me-2"></i>
      {{ error }}
    </div>
    <div v-else-if="recipe">
      <h1>{{ recipe.recipe_name }}</h1>
      <p class="text-muted">
        Geteilt von {{ recipe.shared_by }} am {{ formatDate(recipe.shared_at) }}
      </p>
      <!-- Rezept-Anzeige wird in Sprint B2 vollständig implementiert -->
      <pre class="bg-light p-3 rounded">{{ JSON.stringify(recipe.data, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{ token: string }>()

const loading = ref(true)
const error = ref<string | null>(null)
const recipe = ref<any>(null)

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE')
}

onMounted(async () => {
  try {
    const response = await fetch(`/api/v1/shared/${encodeURIComponent(props.token)}`)
    if (!response.ok) {
      if (response.status === 404) {
        error.value = 'Dieser Link ist ungültig oder abgelaufen.'
      } else {
        error.value = 'Fehler beim Laden des Rezepts.'
      }
      return
    }
    recipe.value = await response.json()
  } catch {
    error.value = 'Netzwerkfehler — bitte versuche es später erneut.'
  } finally {
    loading.value = false
  }
})
</script>
