# Sprint 1: Detaillierter Implementierungsplan

> **Sprint:** Split-View Desktop/Tablet + Metadaten-Verbesserungen  
> **Zeitrahmen:** 4-6 Tage | **Priorität:** 🔴 Kritisch  
> **Start:** TBD | **Status:** 📋 Geplant

---

## 🎯 Sprint-Ziele

1. **Split-View** für Desktop/Tablet (Zutaten sticky links, Schritte rechts)
2. **Mobile Bottom Bar** für Zutaten (sticky, expandable, auto-filtered)
3. **Abschnitts-Synchronisation** (Scroll → Highlight aktiver Abschnitt)
4. **Portionen-Skalierung** prominent im Header platzieren
5. **Metadaten-Button** dezent gestalten (icon-only, rechts oben auf Bild)
6. **Metadaten-Overlay** als seitliche Spalte über Bild (Desktop) / Bottom Sheet (Mobile)
7. **Metadaten-Editor** in Edit.vue integrieren

---

## 📋 Task-Breakdown

### Phase 1: Split-View Foundation (Tag 1-2)

#### Task 1.1: Layout-Struktur implementieren ⏱️ 3-4h

**Ziel:** Responsive Split-View Layout für Desktop/Tablet erstellen

**Schritte:**
- [ ] `Recipe.vue` analysieren: Bestehende Single-Column-Struktur
- [ ] Media Queries definieren:
  - Mobile (< 768px): Sticky Bottom Bar für Zutaten (NEU!)
  - Tablet (768px - 1024px): 40% / 60% Split
  - Desktop (> 1024px): 35% / 65% Split
- [ ] CSS Grid oder Flexbox Layout erstellen
- [ ] Zutaten-Bereich als `sticky` positionieren (top: var(--navbar-height))
- [ ] Mobile Bottom Bar Struktur erstellen (collapsed + expanded states)

**Geplante Struktur:**
```vue
<!-- src/views/Recipe.vue -->
<template>
  <div class="recipe-container" :class="{ 'split-view': isDesktopOrTablet, 'mobile-view': isMobile }">
    
    <!-- Desktop/Tablet: Split-View -->
    <div v-if="isDesktopOrTablet" class="split-layout">
      <aside class="ingredients-column">
        <div class="sticky-wrapper">
          <!-- Filter Toggle -->
          <div class="filter-controls">
            <BButton 
              variant="outline-secondary" 
              size="sm"
              @click="showAllIngredients = !showAllIngredients"
            >
              {{ showAllIngredients ? 'Alle Zutaten' : 'Nur aktueller Abschnitt' }}
            </BButton>
          </div>
          
          <!-- Zutaten (gefiltert oder alle) -->
          <div v-for="section in visibleSections" :key="section.section">
            <h4>{{ section.section }}</h4>
            <div v-for="ingredient in getIngredients(section.section)" :key="ingredient.id">
              <!-- Ingredient Display -->
            </div>
          </div>
        </div>
      </aside>
      
      <main class="steps-column">
        <!-- Rezept-Header (Bild, Titel, Portionen) -->
        <!-- Schritte mit data-section Attributen -->
      </main>
    </div>
    
    <!-- Mobile: Smart Bottom Bar -->
    <div v-else class="mobile-layout">
      <!-- Rezept-Header & Schritte (normale Ansicht) -->
      <div class="recipe-content">
        <!-- Bild, Titel, Portionen, Schritte -->
      </div>
      
      <!-- Sticky Bottom Bar -->
      <div 
        class="ingredients-bottom-bar"
        :class="{ expanded: ingredientsExpanded }"
      >
        <!-- Collapsed State (immer sichtbar) -->
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
              v-for="section in visibleIngredientSections" 
              :key="section.section"
              class="ingredient-section"
              :class="{ active: section.section === activeSection }"
              :data-section="section.section"
            >
              <h6>{{ section.section }}</h6>
              <div v-for="ingredient in getIngredients(section.section)" :key="ingredient.id">
                <input type="checkbox" /> {{ ingredient.amount }} {{ ingredient.unit }} {{ ingredient.name }}
              </div>
            </div>
          </div>
          
          <!-- Section Quick-Jump Chips (wenn "Alle" aktiv) -->
          <div v-if="!showOnlyCurrentSection && current_recipe.sections.length > 1" class="section-chips">
            <BButton
              v-for="section in current_recipe.sections"
              :key="section.section"
              size="sm"
              :variant="section.section === activeSection ? 'primary' : 'outline-secondary'"
              @click="scrollToIngredientSection(section.section)"
            >
              {{ section.section }}
            </BButton>
          </div>
        </div>
      </div>
      
      <!-- Backdrop (wenn expanded) -->
      <div 
        v-if="ingredientsExpanded" 
        class="bottom-bar-backdrop"
        @click="closeIngredientsBar"
      ></div>
    </div>
    
  </div>
</template>
```

**CSS:**
```css
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
  }
}

.ingredients-column {
  position: relative;
}

.sticky-wrapper {
  position: sticky;
  top: calc(var(--navbar-height, 56px) + 1rem);
  max-height: calc(100vh - var(--navbar-height, 56px) - 2rem);
  overflow-y: auto;
  padding: 1.5rem;
  background: var(--bs-body-bg);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.steps-column {
  min-height: 100vh;
}

/* Mobile: Sticky Bottom Bar */
@media (max-width: 767px) {
  .mobile-layout {
    position: relative;
    padding-bottom: 80px; /* Platz für collapsed bar */
  }
  
  .ingredients-bottom-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
    background: white;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -2px 12px rgba(0,0,0,0.15);
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
    height: 70vh;
    max-height: 70vh;
  }
  
  .bottom-bar-expanded {
    display: flex;
    flex-direction: column;
    height: 100%;
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
    flex: 1;
    overflow-y: auto;
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
  
  /* Backdrop */
  .bottom-bar-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 99;
    animation: fadeIn 0.3s ease;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  /* Body Scroll Lock wenn expanded */
  body.bottom-bar-open {
    overflow: hidden;
  }
}
```

**Betroffene Dateien:**
- `src/views/Recipe.vue` (Template + Style)

---

#### Task 1.2: Responsive Detection ⏱️ 1h

**Ziel:** Composable für Viewport-Detection erstellen

**Schritte:**
- [ ] Neue Datei `src/composables/useViewport.ts` erstellen
- [ ] Window resize listener implementieren
- [ ] Breakpoints definieren: mobile / tablet / desktop
- [ ] OrientationChange Detection (Vorbereitung für Sprint 2)

**Code:**
```typescript
// src/composables/useViewport.ts
import { ref, onMounted, onUnmounted, computed } from 'vue'

export function useViewport() {
  const windowWidth = ref(window.innerWidth)
  const windowHeight = ref(window.innerHeight)
  
  const isMobile = computed(() => windowWidth.value < 768)
  const isTablet = computed(() => windowWidth.value >= 768 && windowWidth.value < 1024)
  const isDesktop = computed(() => windowWidth.value >= 1024)
  const isDesktopOrTablet = computed(() => windowWidth.value >= 768)
  
  // Portrait vs Landscape (für Sprint 2)
  const isPortrait = computed(() => windowHeight.value > windowWidth.value)
  const isLandscape = computed(() => windowWidth.value > windowHeight.value)
  
  const updateViewport = () => {
    windowWidth.value = window.innerWidth
    windowHeight.value = window.innerHeight
  }
  
  onMounted(() => {
    window.addEventListener('resize', updateViewport)
    window.addEventListener('orientationchange', updateViewport)
  })
  
  onUnmounted(() => {
    window.removeEventListener('resize', updateViewport)
    window.removeEventListener('orientationchange', updateViewport)
  })
  
  return {
    windowWidth,
    windowHeight,
    isMobile,
    isTablet,
    isDesktop,
    isDesktopOrTablet,
    isPortrait,
    isLandscape
  }
}
```

**Integration in Recipe.vue:**
```typescript
import { useViewport } from '@/composables/useViewport'

const { isMobile, isTablet, isDesktop, isDesktopOrTablet } = useViewport()
```

**Betroffene Dateien:**
- `src/composables/useViewport.ts` (NEU)
- `src/views/Recipe.vue` (Import + Nutzung)

---

### Phase 2: Zutaten-Filter & Synchronisation (Tag 2-3)

#### Task 2.1: Filter-Toggle UI ⏱️ 2h

**Ziel:** Toggle zwischen "Alle Zutaten" und "Nur aktueller Abschnitt"

**Schritte:**
- [ ] Toggle-Button in Zutaten-Header erstellen (Desktop/Tablet)
- [ ] Toggle-Buttons in Mobile Bottom Bar erstellen
- [ ] Reactive State `showAllIngredients` (Desktop default: true)
- [ ] Reactive State `showOnlyCurrentSection` (Mobile default: true) 🆕
- [ ] State in UIState Store persistent machen (optional)

**Code:**
```typescript
// In Recipe.vue <script setup>

// Desktop/Tablet: Default "Alle anzeigen"
const showAllIngredients = ref(true)

// Mobile: Default "Nur aktueller Abschnitt" (optimiert für Kochen)
const showOnlyCurrentSection = ref(true)

const activeSection = ref<string | null>(null)

// Desktop/Tablet: Sections filtern
const visibleSections = computed(() => {
  if (showAllIngredients.value) {
    return current_recipe.value.sections
  }
  return current_recipe.value.sections.filter(
    section => section.section === activeSection.value
  )
})

// Mobile: Sections filtern (andere Logic wegen Default)
const visibleIngredientSections = computed(() => {
  if (showOnlyCurrentSection.value && activeSection.value) {
    return current_recipe.value.sections.filter(
      section => section.section === activeSection.value
    )
  }
  return current_recipe.value.sections
})

const getIngredients = (sectionName: string) => {
  return current_recipe.value.ingredients.filter(
    ing => ing.section === sectionName
  )
}

// Mobile Bottom Bar Controls
const ingredientsExpanded = ref(false)

const openIngredientsBar = () => {
  ingredientsExpanded.value = true
  document.body.classList.add('bottom-bar-open')
  
  // Smart scroll zu aktiver Section (wenn "Alle" aktiv)
  if (!showOnlyCurrentSection.value && activeSection.value) {
    nextTick(() => {
      const sectionEl = document.querySelector(
        `.ingredient-section[data-section="${activeSection.value}"]`
      )
      sectionEl?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
}

const closeIngredientsBar = () => {
  ingredientsExpanded.value = false
  document.body.classList.remove('bottom-bar-open')
}

const scrollToIngredientSection = (sectionName: string) => {
  const sectionEl = document.querySelector(
    `.ingredient-section[data-section="${sectionName}"]`
  )
  sectionEl?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
```

**Betroffene Dateien:**
- `src/views/Recipe.vue`

---

#### Task 2.2: Abschnitts-Synchronisation ⏱️ 4-5h

**Ziel:** Intersection Observer für automatische Section-Erkennung beim Scrollen

**Schritte:**
- [ ] Intersection Observer für Schritt-Abschnitte implementieren
- [ ] Active Section State aktualisieren beim Scrollen
- [ ] Zutaten-Abschnitt highlighten wenn aktiv
- [ ] Smooth Scroll zu Abschnitt bei Klick auf Zutat-Section-Header (optional)

**Code:**
```typescript
// In Recipe.vue <script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const activeSection = ref<string | null>(null)
let observer: IntersectionObserver | null = null

const observeStepSections = () => {
  const stepSections = document.querySelectorAll('[data-step-section]')
  
  if (stepSections.length === 0) return
  
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          const sectionName = entry.target.getAttribute('data-step-section')
          if (sectionName) {
            activeSection.value = sectionName
          }
        }
      })
    },
    {
      threshold: [0, 0.5, 1],
      rootMargin: '-100px 0px -50% 0px' // Top navbar offset + center bias
    }
  )
  
  stepSections.forEach(section => observer?.observe(section))
}

onMounted(async () => {
  await nextTick()
  observeStepSections()
})

onUnmounted(() => {
  observer?.disconnect()
})
```

**Template Anpassungen:**
```vue
<!-- Steps mit data-step-section -->
<div
  v-for="(section, index) in current_recipe.sections"
  :key="index"
  :data-step-section="section.section"
  class="step-section"
>
  <h3>{{ section.section }}</h3>
  <ol>
    <li v-for="(step, idx) in getSteps(section.section)" :key="idx">
      {{ step.step }}
    </li>
  </ol>
</div>
```

**Betroffene Dateien:**
- `src/views/Recipe.vue`

---

#### Task 2.3: Visual Feedback ⏱️ 2h

**Ziel:** Active Section visuell hervorheben

**Schritte:**
- [ ] CSS Klasse für aktiven Abschnitt
- [ ] Smooth Transitions
- [ ] Optional: Scroll-Indikator/Progress Bar

**CSS:**
```css
.ingredient-section {
  padding: 1rem;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.ingredient-section.active {
  background: rgba(var(--bs-primary-rgb), 0.1);
  border-left: 4px solid var(--bs-primary);
  padding-left: calc(1rem - 4px);
}

.ingredient-section h4 {
  transition: color 0.3s ease;
}

.ingredient-section.active h4 {
  color: var(--bs-primary);
  font-weight: 600;
}
```

**Template:**
```vue
<div
  v-for="section in visibleSections"
  :key="section.section"
  class="ingredient-section"
  :class="{ active: activeSection === section.section }"
>
  <h4>{{ section.section }}</h4>
  <!-- ... -->
</div>
```

**Betroffene Dateien:**
- `src/views/Recipe.vue` (Template + CSS)

---

### Phase 3: Portionen-Skalierung prominent (Tag 3)

#### Task 3.1: Header-Redesign ⏱️ 3h

**Ziel:** Portionen-Kontrolle prominent im Recipe Header platzieren

**Schritte:**
- [ ] Portionen-Anzeige in Recipe Header verschieben (neben oder unter Titel)
- [ ] +/− Buttons größer gestalten (min. 44x44px Touch-Target)
- [ ] Besseres visuelles Design
- [ ] Responsive (Mobile: volle Breite, Desktop: inline mit Titel)

**Geplante UI:**
```vue
<div class="recipe-header">
  <div class="recipe-image-container">
    <img :src="picture_src" alt="Rezeptbild" />
    
    <!-- Metadaten-Icon (Task 4.1) -->
    <div class="metadata-toggle-icon" @click="showMetadata = !showMetadata">
      <i class="bi bi-info-circle"></i>
    </div>
    
    <!-- Metadaten-Overlay (Task 4.2) -->
    <transition name="slide-in-right">
      <div v-if="showMetadata" class="metadata-sidebar-overlay">
        <!-- ... -->
      </div>
    </transition>
  </div>
  
  <div class="recipe-title-section">
    <h1>{{ current_recipe.recipe_name }}</h1>
    
    <!-- Portionen-Kontrolle -->
    <div class="portions-control">
      <BButton 
        @click="decreaseServings" 
        variant="primary"
        size="lg"
        class="portion-btn"
        :disabled="yields_value <= 1"
      >
        <i class="bi bi-dash-lg"></i>
      </BButton>
      
      <div class="portions-display">
        <span class="value">{{ yields_value }}</span>
        <span class="unit">{{ yields_unit }}</span>
      </div>
      
      <BButton 
        @click="increaseServings" 
        variant="primary"
        size="lg"
        class="portion-btn"
      >
        <i class="bi bi-plus-lg"></i>
      </BButton>
    </div>
  </div>
</div>
```

**CSS:**
```css
.recipe-title-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 1.5rem 0;
  gap: 2rem;
  flex-wrap: wrap;
}

.portions-control {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: var(--bs-light);
  border-radius: 50px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.portion-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

.portions-display {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  min-width: 80px;
  justify-content: center;
}

.portions-display .value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--bs-primary);
}

.portions-display .unit {
  font-size: 1rem;
  color: var(--bs-secondary);
}

@media (max-width: 768px) {
  .recipe-title-section {
    flex-direction: column;
    align-items: stretch;
  }
  
  .portions-control {
    justify-content: center;
  }
}
```

**Betroffene Dateien:**
- `src/views/Recipe.vue`

---

#### Task 3.2: Bestehende Portionen-Logic refactoren ⏱️ 2h

**Ziel:** Portionen-Skalierung Logic prüfen und mit neuer UI verbinden

**Schritte:**
- [ ] Prüfen wo Skalierung aktuell implementiert ist
- [ ] Falls nötig: Logic in separates Composable extrahieren
- [ ] Neue UI mit Logic verbinden
- [ ] Min/Max Limits setzen (z.B. 1-100 Portionen)
- [ ] Edge Cases testen (0.5 Portionen, sehr große Zahlen)

**Mögliche Composable-Struktur:**
```typescript
// src/composables/useServingsScale.ts (falls nötig)
export function useServingsScale(recipe: Ref<Recipe>, originalServings: number) {
  const currentServings = ref(originalServings)
  const scaleFactor = computed(() => currentServings.value / originalServings)
  
  const scaleIngredient = (amount: number) => {
    return (amount * scaleFactor.value).toFixed(2)
  }
  
  const increaseServings = () => {
    if (currentServings.value < 100) {
      currentServings.value++
    }
  }
  
  const decreaseServings = () => {
    if (currentServings.value > 1) {
      currentServings.value--
    }
  }
  
  return {
    currentServings,
    scaleFactor,
    scaleIngredient,
    increaseServings,
    decreaseServings
  }
}
```

**Betroffene Dateien:**
- `src/views/Recipe.vue`
- `src/composables/useServingsScale.ts` (NEU, falls extrahiert)

---

### Phase 4: Metadaten-Button & Overlay (Tag 3-4)

#### Task 4.1: Icon-only Button ⏱️ 2h

**Ziel:** Dezenten Info-Button rechts oben auf Rezeptbild erstellen

**Schritte:**
- [ ] Bestehenden Button analysieren (Recipe.vue ca. L130-145)
- [ ] Redesign: Nur Icon, transparent, absolute Position
- [ ] Hover-Effekte (Scale, Shadow)
- [ ] Mobile: Größer (min. 44px Touch-Target)

**Code:**
```vue
<!-- In recipe-image-container -->
<div class="metadata-toggle-icon" @click="showMetadata = !showMetadata">
  <i class="bi bi-info-circle"></i>
</div>
```

**CSS:**
```css
.recipe-image-container {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: 12px;
}

.metadata-toggle-icon {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10;
  font-size: 1.25rem;
  color: var(--bs-primary);
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.metadata-toggle-icon:hover {
  background: rgba(255, 255, 255, 1);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

@media (max-width: 768px) {
  .metadata-toggle-icon {
    width: 44px;
    height: 44px;
    font-size: 1.5rem;
  }
}
```

**Betroffene Dateien:**
- `src/views/Recipe.vue`

---

#### Task 4.2: Overlay-Redesign ⏱️ 3h

**Ziel:** Metadaten als Overlay über Bild (Desktop: Seitliche Spalte, Mobile: Bottom Sheet)

**Desktop/Tablet - Seitliche Spalte:**
```vue
<transition name="slide-in-right">
  <div v-if="showMetadata" class="metadata-sidebar-overlay">
    <div class="metadata-header">
      <h6><i class="bi bi-info-circle me-2"></i>Informationen</h6>
      <button class="btn-close-custom" @click="showMetadata = false">
        <i class="bi bi-x-lg"></i>
      </button>
    </div>
    
    <div class="metadata-content">
      <div v-if="current_recipe.author" class="meta-row">
        <i class="bi bi-person"></i>
        <div>
          <strong>Autor</strong>
          <p>{{ current_recipe.author }}</p>
        </div>
      </div>
      
      <div v-if="current_recipe.source_url || current_recipe.source_book" class="meta-row">
        <i class="bi bi-link-45deg"></i>
        <div>
          <strong>Quelle</strong>
          <a v-if="current_recipe.source_url" :href="current_recipe.source_url" target="_blank">
            {{ current_recipe.source_url }}
          </a>
          <p v-if="current_recipe.source_book">{{ current_recipe.source_book }}</p>
        </div>
      </div>
      
      <div v-if="current_recipe.servings" class="meta-row">
        <i class="bi bi-people"></i>
        <div>
          <strong>Portionen</strong>
          <p>{{ current_recipe.servings }}</p>
        </div>
      </div>
      
      <div v-if="hasTimeInfo" class="meta-row">
        <i class="bi bi-clock"></i>
        <div>
          <strong>Zeiten</strong>
          <p v-if="current_recipe.prep_time">Vorbereitung: {{ current_recipe.prep_time }}</p>
          <p v-if="current_recipe.cook_time">Kochen: {{ current_recipe.cook_time }}</p>
          <p v-if="current_recipe.bake_time">Backen: {{ current_recipe.bake_time }}</p>
          <p v-if="current_recipe.total_time">Gesamt: {{ current_recipe.total_time }}</p>
        </div>
      </div>
      
      <div v-if="current_recipe.difficulty" class="meta-row">
        <i class="bi bi-bar-chart"></i>
        <div>
          <strong>Schwierigkeit</strong>
          <span class="badge" :class="difficultyClass">{{ difficultyLabel }}</span>
        </div>
      </div>
      
      <div v-if="current_recipe.notes" class="meta-row">
        <i class="bi bi-journal-text"></i>
        <div>
          <strong>Notizen</strong>
          <p>{{ current_recipe.notes }}</p>
        </div>
      </div>
    </div>
  </div>
</transition>
```

**CSS Desktop:**
```css
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

.btn-close-custom {
  background: none;
  border: none;
  color: white;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.25rem;
  transition: transform 0.2s;
}

.btn-close-custom:hover {
  transform: scale(1.1);
}

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
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.slide-in-right-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-in-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
```

**Mobile - Bottom Sheet:**
```vue
<!-- Mobile Version -->
<div v-if="isMobile && showMetadata">
  <!-- Backdrop -->
  <div class="metadata-backdrop" @click="showMetadata = false"></div>
  
  <!-- Bottom Sheet -->
  <transition name="slide-up">
    <div class="metadata-bottom-sheet">
      <!-- Drag Handle (visuell) -->
      <div class="drag-handle"></div>
      
      <div class="metadata-header">
        <h6>Informationen</h6>
        <button class="btn-close-custom" @click="showMetadata = false">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      
      <div class="metadata-content">
        <!-- Same content as desktop -->
      </div>
    </div>
  </transition>
</div>
```

**CSS Mobile:**
```css
.metadata-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 100;
  backdrop-filter: blur(4px);
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

.metadata-backdrop {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

**Computed Properties:**
```typescript
const hasTimeInfo = computed(() => 
  current_recipe.value.prep_time || 
  current_recipe.value.cook_time || 
  current_recipe.value.bake_time || 
  current_recipe.value.total_time
)

const difficultyLabel = computed(() => {
  switch(current_recipe.value.difficulty) {
    case 'easy': return 'Einfach'
    case 'medium': return 'Mittel'
    case 'hard': return 'Schwer'
    default: return ''
  }
})

const difficultyClass = computed(() => {
  switch(current_recipe.value.difficulty) {
    case 'easy': return 'bg-success'
    case 'medium': return 'bg-warning'
    case 'hard': return 'bg-danger'
    default: return 'bg-secondary'
  }
})
```

**Betroffene Dateien:**
- `src/views/Recipe.vue`

---

### Phase 5: Metadaten-Editor Integration (Tag 4-5)

#### Task 5.1: Edit.vue erweitern ⏱️ 4-5h

**Ziel:** Metadaten-Section im Editor hinzufügen

**Schritte:**
- [ ] Neue einklappbare Section "Metadaten" in Edit.vue
- [ ] Formular-Felder für alle Metadaten erstellen
- [ ] V-Model Bindings zu recipe Objekt
- [ ] Collapse-Toggle Button

**Code:**
```vue
<!-- In Edit.vue nach Basis-Infos (Titel, Bild) -->
<div class="metadata-section card mb-3">
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0">
      <i class="bi bi-info-circle me-2"></i>
      Metadaten (optional)
    </h5>
    <BButton 
      variant="link" 
      @click="metadataExpanded = !metadataExpanded"
    >
      <i :class="metadataExpanded ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
    </BButton>
  </div>
  
  <BCollapse v-model="metadataExpanded">
    <div class="card-body">
      <div class="row g-3">
        
        <!-- Autor -->
        <div class="col-md-6">
          <label class="form-label">Autor</label>
          <BFormInput
            v-model="current_recipe.author"
            placeholder="Dein Name oder Quelle"
          />
        </div>
        
        <!-- Schwierigkeit -->
        <div class="col-md-6">
          <label class="form-label">Schwierigkeit</label>
          <BFormSelect
            v-model="current_recipe.difficulty"
            :options="[
              { value: null, text: 'Nicht angegeben' },
              { value: 'easy', text: 'Einfach' },
              { value: 'medium', text: 'Mittel' },
              { value: 'hard', text: 'Schwer' }
            ]"
          />
        </div>
        
        <!-- Quelle URL -->
        <div class="col-md-6">
          <label class="form-label">Quelle (URL)</label>
          <BFormInput
            v-model="current_recipe.source_url"
            type="url"
            placeholder="https://..."
          />
        </div>
        
        <!-- Quelle Buch -->
        <div class="col-md-6">
          <label class="form-label">Quelle (Buch)</label>
          <BFormInput
            v-model="current_recipe.source_book"
            placeholder="Kochbuch-Titel, Seite X"
          />
        </div>
        
        <!-- Zeiten Row -->
        <div class="col-12">
          <h6 class="mb-3">Zeiten</h6>
          <div class="row g-3">
            
            <div class="col-md-3">
              <label class="form-label">Vorbereitung</label>
              <div class="input-group">
                <BFormInput
                  v-model="current_recipe.prep_time"
                  placeholder="30"
                />
                <span class="input-group-text">Min</span>
              </div>
            </div>
            
            <div class="col-md-3">
              <label class="form-label">Kochen/Braten</label>
              <div class="input-group">
                <BFormInput
                  v-model="current_recipe.cook_time"
                  placeholder="45"
                />
                <span class="input-group-text">Min</span>
              </div>
            </div>
            
            <div class="col-md-3">
              <label class="form-label">Backen</label>
              <div class="input-group">
                <BFormInput
                  v-model="current_recipe.bake_time"
                  placeholder="60"
                />
                <span class="input-group-text">Min</span>
              </div>
            </div>
            
            <div class="col-md-3">
              <label class="form-label">Gesamt</label>
              <div class="input-group">
                <BFormInput
                  v-model="current_recipe.total_time"
                  placeholder="120"
                />
                <span class="input-group-text">Min</span>
              </div>
            </div>
            
          </div>
          <small class="form-text text-muted">
            Zeitangaben in Minuten. Gesamtzeit kann automatisch berechnet werden.
          </small>
        </div>
        
        <!-- Notizen -->
        <div class="col-12">
          <label class="form-label">Notizen</label>
          <BFormTextarea
            v-model="current_recipe.notes"
            rows="3"
            placeholder="Zusätzliche Hinweise, Tipps, Variationen..."
          />
        </div>
        
      </div>
    </div>
  </BCollapse>
</div>
```

**Script:**
```typescript
const metadataExpanded = ref(false)

// Optional: Gesamt-Zeit automatisch berechnen
watch([
  () => current_recipe.value.prep_time,
  () => current_recipe.value.cook_time,
  () => current_recipe.value.bake_time
], () => {
  const prep = parseInt(current_recipe.value.prep_time) || 0
  const cook = parseInt(current_recipe.value.cook_time) || 0
  const bake = parseInt(current_recipe.value.bake_time) || 0
  const total = prep + cook + bake
  
  if (total > 0 && !current_recipe.value.total_time) {
    current_recipe.value.total_time = total.toString()
  }
})
```

**Betroffene Dateien:**
- `src/views/Edit.vue`

---

#### Task 5.2: Validierung & UX ⏱️ 2h

**Ziel:** Form-Validierung und UX-Verbesserungen

**Schritte:**
- [ ] URL-Validierung (optional, nur warnen)
- [ ] Hilfe-Texte/Tooltips wo nötig
- [ ] Responsive Design (Mobile: Full-Width)
- [ ] Auto-Save beim Verlassen der Felder (optional)

**URL Validierung:**
```typescript
const isValidUrl = (url: string) => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

const urlWarning = computed(() => {
  if (current_recipe.value.source_url && !isValidUrl(current_recipe.value.source_url)) {
    return 'URL scheint ungültig zu sein'
  }
  return null
})
```

**Template mit Validierung:**
```vue
<div class="col-md-6">
  <label class="form-label">Quelle (URL)</label>
  <BFormInput
    v-model="current_recipe.source_url"
    type="url"
    placeholder="https://..."
    :state="urlWarning ? false : null"
  />
  <div v-if="urlWarning" class="invalid-feedback d-block">
    {{ urlWarning }}
  </div>
</div>
```

**Betroffene Dateien:**
- `src/views/Edit.vue`

---

### Phase 6: Testing & Polish (Tag 5-6)

#### Task 6.1: Responsiveness Testing ⏱️ 3h

**Testplan:**

**Mobile:**
- [ ] iPhone SE (375px)
- [ ] iPhone 14 Pro (393px)
- [ ] Portrait & Landscape
- [ ] Bottom Sheet funktioniert
- [ ] Touch-Targets mind. 44px
- [ ] Keine horizontalen Scrollbars

**Tablet:**
- [ ] iPad (768px)
- [ ] iPad Pro (1024px)
- [ ] Split-View 40/60
- [ ] Sticky Zutaten funktioniert
- [ ] Rotation Portrait ↔ Landscape

**Desktop:**
- [ ] 1280px
- [ ] 1920px
- [ ] 2560px (4K)
- [ ] Split-View 35/65
- [ ] Sidebar-Overlay passt
- [ ] Keine Layout-Shifts

---

#### Task 6.2: Cross-Browser Testing ⏱️ 2h

**Testplan:**
- [ ] Chrome (Windows + macOS)
- [ ] Edge (Windows)
- [ ] Safari (macOS + iOS)
- [ ] Firefox (Windows)

**Bekannte Probleme prüfen:**
- Safari: Backdrop-filter Support
- Safari iOS: Sticky-Positioning
- Firefox: CSS Grid Gaps

---

#### Task 6.3: Edge Cases & Bugfixes ⏱️ 3-4h

**Testszenarien:**
- [ ] Rezept ohne Abschnitte (nur eine Section)
- [ ] Rezept mit 10+ Abschnitten
- [ ] Sehr lange Zutatenliste (50+ Zutaten)
- [ ] Leere Metadatenfelder (keine Infos)
- [ ] Rezept ohne Bild
- [ ] Sehr langer Rezepttitel (Wrapping)
- [ ] 0.5 Portionen, 100 Portionen
- [ ] Schnelles Scrollen (Intersection Observer)

---

#### Task 6.4: Performance-Optimierung ⏱️ 2h

**Metriken:**
- [ ] First Contentful Paint < 1s
- [ ] Interaction to Next Paint < 200ms
- [ ] Scroll Performance 60fps

**Optimierungen:**
- [ ] v-memo für ingredient lists (falls nötig)
- [ ] Intersection Observer throttling
- [ ] CSS will-change für Animationen
- [ ] Lazy-loading für Bilder (falls nicht bereits)

---

#### Task 6.5: Accessibility ⏱️ 2h

**Checkliste:**
- [ ] Keyboard Navigation (Tab, Enter, ESC)
- [ ] ESC schließt Metadaten-Overlay
- [ ] Focus-Trap in Bottom Sheet
- [ ] ARIA Labels für Icon-Buttons
- [ ] Alt-Text für Bilder
- [ ] Kontrast-Ratio mind. 4.5:1
- [ ] Screen Reader Testing (optional)

**Accessibility Fixes:**
```vue
<!-- Icon Button -->
<div 
  class="metadata-toggle-icon" 
  @click="showMetadata = !showMetadata"
  role="button"
  tabindex="0"
  @keyup.enter="showMetadata = !showMetadata"
  :aria-label="showMetadata ? 'Metadaten ausblenden' : 'Metadaten anzeigen'"
>
  <i class="bi bi-info-circle" aria-hidden="true"></i>
</div>

<!-- Overlay ESC Handler -->
<div 
  v-if="showMetadata" 
  class="metadata-sidebar-overlay"
  @keyup.esc="showMetadata = false"
  tabindex="-1"
  ref="metadataOverlay"
>
```

---

## 📦 Betroffene Dateien - Übersicht

```
src/
├── views/
│   ├── Recipe.vue ⚠️ MAJOR CHANGES
│   │   ├── Split-View Layout
│   │   ├── Intersection Observer
│   │   ├── Portionen-Header
│   │   ├── Metadaten-Icon + Overlay
│   │   └── Responsive Handling
│   └── Edit.vue ⚠️ MODERATE CHANGES
│       └── Metadaten-Section mit Formular
├── composables/
│   └── useViewport.ts ✨ NEW
│       └── Responsive Detection
└── types/
    └── recipe.ts (bereits erweitert in Sprint 0)
```

---

## 🎯 Definition of Done

### Für jede Task:
- [ ] Code geschrieben und funktionsfähig
- [ ] Lokal getestet (Chrome + Safari iOS Simulator)
- [ ] Keine Console Errors/Warnings
- [ ] TypeScript Errors behoben
- [ ] Code committed (sinnvolle Commit Messages)

### Sprint 1 Abschluss:
- [ ] Alle 6 Phasen abgeschlossen
- [ ] Cross-Browser Testing erfolgreich
- [ ] Responsive auf allen Breakpoints
- [ ] Performance akzeptabel (< 200ms Interaction)
- [ ] Accessibility Basics erfüllt
- [ ] Known Issues dokumentiert
- [ ] UI-ROADMAP-FINAL.md aktualisiert (Sprint 1 → ✅)

---

## ⚠️ Risiken & Mitigation

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|---------|------------|
| Intersection Observer Performance bei 10+ Abschnitten | Mittel | Mittel | Throttling, fallback zu manueller Section-Auswahl |
| Sticky Positioning Bugs iOS < 13 | Niedrig | Niedrig | Fallback zu fixed positioning mit JS |
| Layout-Shifts beim Resize | Mittel | Niedrig | CSS Grid mit festen Proportionen |
| Bottom Sheet Touch-Gesten nicht intuitiv | Mittel | Mittel | Ausführliche Tests, evtl. Anleitung beim ersten Öffnen |
| Metadaten-Felder fehlende Validierung | Niedrig | Niedrig | Warnings statt Errors, keine Pflichtfelder |

---

## 📝 Notizen & Learnings

**Nach Sprint-Abschluss hier dokumentieren:**
- Unerwartete Probleme
- Performance-Erkenntnisse
- Verbesserungsideen für Sprint 2
- Browser-spezifische Workarounds

---

## 🚀 Empfohlene Arbeitsweise

### Tag 1 (Start)
- **Morning:** Task 1.1 + 1.2 (Layout Foundation, Viewport Detection)
- **Afternoon:** Task 2.1 (Filter-Toggle UI)

### Tag 2
- **Full Day:** Task 2.2 + 2.3 (Intersection Observer + Visual Feedback)

### Tag 3
- **Morning:** Task 3.1 + 3.2 (Portionen-Skalierung Header)
- **Afternoon:** Task 4.1 (Metadaten-Icon Button)

### Tag 4
- **Morning:** Task 4.2 (Overlay-Redesign Desktop)
- **Afternoon:** Task 4.2 (Bottom Sheet Mobile) + Task 5.1 Start

### Tag 5
- **Morning:** Task 5.1 Finish (Edit.vue Formular)
- **Afternoon:** Task 5.2 + Task 6.1 Start (Validierung, Testing)

### Tag 6 (Polish & Testing)
- **Morning:** Task 6.2 + 6.3 (Cross-Browser, Edge Cases)
- **Afternoon:** Task 6.4 + 6.5 (Performance, Accessibility)

---

**Bereit anzufangen?** 🚀

Vorschlag: Mit **Task 1.1** starten (Split-View Layout Foundation in Recipe.vue)
