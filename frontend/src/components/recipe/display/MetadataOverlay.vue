<template>
  <!-- Desktop: Sidebar Overlay -->
  <transition name="slide-in-right">
    <div v-if="show && !isMobile" class="metadata-sidebar-overlay">
      <div class="metadata-header">
        <h6><i class="bi bi-info-circle me-2"></i>Informationen</h6>
        <CloseButton @close="$emit('close')" />
      </div>

      <div class="metadata-content">
        <div v-if="recipe.author" class="meta-row">
          <i class="bi bi-person"></i>
          <div>
            <strong>Autor</strong>
            <p>{{ recipe.author }}</p>
          </div>
        </div>

        <div v-if="recipe.source_url || recipe.source_book" class="meta-row">
          <i class="bi bi-link-45deg"></i>
          <div>
            <strong>Quelle</strong>
            <a
              v-if="recipe.source_url"
              :href="recipe.source_url"
              target="_blank"
            >
              {{ recipe.source_url }}
            </a>
            <p v-if="recipe.source_book">{{ recipe.source_book }}</p>
          </div>
        </div>

        <div v-if="yieldsValue && yieldsUnit" class="meta-row">
          <i class="bi bi-calculator"></i>
          <div>
            <strong>Menge</strong>
            <p>{{ yieldsValue }} {{ yieldsUnit }}</p>
          </div>
        </div>

        <div v-if="hasTimeInfo" class="meta-row">
          <i class="bi bi-clock"></i>
          <div>
            <strong>Zeiten</strong>
            <p v-if="recipe.prep_time">
              Vorbereitung: {{ recipe.prep_time }} Min
            </p>
            <p v-if="recipe.cook_time">Kochen: {{ recipe.cook_time }} Min</p>
            <p v-if="recipe.bake_time">Backen: {{ recipe.bake_time }} Min</p>
            <p v-if="recipe.total_time">Gesamt: {{ recipe.total_time }} Min</p>
          </div>
        </div>

        <div v-if="recipe.difficulty" class="meta-row">
          <i class="bi bi-bar-chart"></i>
          <div>
            <strong>Schwierigkeit</strong>
            <span class="badge" :class="difficultyClass">{{
              difficultyLabel
            }}</span>
          </div>
        </div>

        <div v-if="recipe.notes" class="meta-row">
          <i class="bi bi-journal-text"></i>
          <div>
            <strong>Notizen</strong>
            <p>{{ recipe.notes }}</p>
          </div>
        </div>
      </div>
    </div>
  </transition>

  <!-- Mobile: Bottom Sheet -->
  <div v-if="isMobile && show">
    <!-- Backdrop -->
    <div class="metadata-backdrop" @click="$emit('close')"></div>

    <!-- Bottom Sheet -->
    <transition name="slide-up">
      <div v-if="show" class="metadata-bottom-sheet">
        <!-- Drag Handle -->
        <div class="drag-handle"></div>

        <div class="metadata-header">
          <h6><i class="bi bi-info-circle me-2"></i>Informationen</h6>
          <CloseButton @close="$emit('close')" />
        </div>

        <div class="metadata-content">
          <div v-if="recipe.author" class="meta-row">
            <i class="bi bi-person"></i>
            <div>
              <strong>Autor</strong>
              <p>{{ recipe.author }}</p>
            </div>
          </div>

          <div v-if="recipe.source_url || recipe.source_book" class="meta-row">
            <i class="bi bi-link-45deg"></i>
            <div>
              <strong>Quelle</strong>
              <a
                v-if="recipe.source_url"
                :href="recipe.source_url"
                target="_blank"
              >
                {{ recipe.source_url }}
              </a>
              <p v-if="recipe.source_book">{{ recipe.source_book }}</p>
            </div>
          </div>

          <div v-if="yieldsValue && yieldsUnit" class="meta-row">
            <i class="bi bi-calculator"></i>
            <div>
              <strong>Menge</strong>
              <p>{{ yieldsValue }} {{ yieldsUnit }}</p>
            </div>
          </div>

          <div v-if="hasTimeInfo" class="meta-row">
            <i class="bi bi-clock"></i>
            <div>
              <strong>Zeiten</strong>
              <p v-if="recipe.prep_time">
                Vorbereitung: {{ recipe.prep_time }} Min
              </p>
              <p v-if="recipe.cook_time">Kochen: {{ recipe.cook_time }} Min</p>
              <p v-if="recipe.bake_time">Backen: {{ recipe.bake_time }} Min</p>
              <p v-if="recipe.total_time">
                Gesamt: {{ recipe.total_time }} Min
              </p>
            </div>
          </div>

          <div v-if="recipe.difficulty" class="meta-row">
            <i class="bi bi-bar-chart"></i>
            <div>
              <strong>Schwierigkeit</strong>
              <span class="badge" :class="difficultyClass">{{
                difficultyLabel
              }}</span>
            </div>
          </div>

          <div v-if="recipe.notes" class="meta-row">
            <i class="bi bi-journal-text"></i>
            <div>
              <strong>Notizen</strong>
              <p>{{ recipe.notes }}</p>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
export default {
  name: "MetadataOverlay",
  props: {
    show: {
      type: Boolean,
      required: true,
    },
    isMobile: {
      type: Boolean,
      required: true,
    },
    recipe: {
      type: Object,
      required: true,
    },
    yieldsValue: {
      type: Number,
      default: null,
    },
    yieldsUnit: {
      type: String,
      default: null,
    },
  },
  emits: ["close"],
  computed: {
    hasTimeInfo() {
      return !!(
        this.recipe.prep_time ||
        this.recipe.cook_time ||
        this.recipe.bake_time ||
        this.recipe.total_time
      );
    },
    difficultyLabel() {
      if (!this.recipe.difficulty) return "";
      const difficulties = {
        easy: "Einfach",
        medium: "Mittel",
        hard: "Schwer",
      };
      return difficulties[this.recipe.difficulty] || "";
    },
    difficultyClass() {
      if (!this.recipe.difficulty) return "bg-secondary";
      const classes = {
        easy: "bg-success",
        medium: "bg-warning",
        hard: "bg-danger",
      };
      return classes[this.recipe.difficulty] || "bg-secondary";
    },
  },
};
</script>

<style scoped>
/* Metadata Sidebar Overlay (Desktop/Tablet) */
.metadata-sidebar-overlay {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(350px, 40%);
  background: rgba(0, 0, 0, 0.92);
  backdrop-filter: blur(12px);
  color: white;
  padding: 1.5rem;
  overflow-y: auto;
  z-index: 20;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.4);
}

.metadata-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 1rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.metadata-header h6 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

/* Close button uses shared CloseButton component */

.metadata-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.meta-row {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  align-items: start;
}

.meta-row i {
  font-size: 1.5rem;
  opacity: 0.8;
  min-width: 24px;
}

.meta-row strong {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.meta-row p {
  margin: 0;
  font-size: 1rem;
}

.meta-row a {
  color: #6ea8fe;
  text-decoration: none;
  word-break: break-all;
}

.meta-row a:hover {
  text-decoration: underline;
}

/* Slide-in Animation */
.slide-in-right-enter-active,
.slide-in-right-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

.slide-in-right-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-in-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* Mobile - Metadata Bottom Sheet */
.metadata-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 100;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.metadata-bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-height: 75vh;
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(20px);
  color: white;
  border-radius: 20px 20px 0 0;
  padding: 1.5rem;
  overflow-y: auto;
  z-index: 101;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.5);
}

.drag-handle {
  width: 40px;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  margin: 0 auto 1rem;
}

/* Slide-up Animation */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
