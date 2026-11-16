<script setup lang="ts">
/**
 * Vorlage des Foto-Imports (kind=source): aufklappbar, standardmäßig zu.
 * Unsichtbar ohne Vorlagen oder wenn die Liste nicht ladbar ist (offline, lokales Rezept).
 * Antippen öffnet das Bild groß in einem neuen Tab: Dort lässt es sich zoomen,
 * was die App selbst (Viewport ohne Pinch-Zoom) nicht erlaubt.
 */
import { ref, watch } from "vue";
import { imageApi, type ImageInfo } from "@/api/images";

const props = defineProps<{ recipeId: string }>();

const sources = ref<ImageInfo[]>([]);

watch(
  () => props.recipeId,
  async (id) => {
    sources.value = [];
    if (!id) return;
    try {
      const images = await imageApi.list(id, "source");
      // Antwort zu einem inzwischen gewechselten Rezept verwerfen
      if (id === props.recipeId) sources.value = images;
    } catch {
      // Ohne Vorlage einfach nichts anzeigen
    }
  },
  { immediate: true },
);
</script>

<template>
  <details v-if="sources.length" class="source-images">
    <summary>
      <i class="bi bi-file-earmark-image"></i> Vorlage ({{ sources.length }}
      {{ sources.length === 1 ? "Seite" : "Seiten" }})
    </summary>
    <div class="source-images-list">
      <a
        v-for="(img, i) in sources"
        :key="img.id"
        :href="imageApi.imageUrl(img.id)"
        target="_blank"
        rel="noopener"
        :title="`Seite ${i + 1} groß anzeigen`"
      >
        <img
          :src="imageApi.thumbnailUrl(img.id)"
          :alt="`Vorlage Seite ${i + 1}`"
          loading="lazy"
        />
      </a>
    </div>
  </details>
</template>

<style scoped>
.source-images {
  margin: var(--space-4) 0;
}

.source-images summary {
  cursor: pointer;
  user-select: none;
  color: var(--color-text-muted);
}

.source-images-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.source-images-list img {
  height: 120px;
  width: auto;
  max-width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  object-fit: cover;
}
</style>
