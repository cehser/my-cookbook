# Sprint 3: Editor-Neugestaltung – Umsetzungsplan

Basiert auf: [SPRINT-3-EDITOR-ANALYSE.md](SPRINT-3-EDITOR-ANALYSE.md)
Branch: `feat-ui-editor`

---

## Übersicht der Phasen

| Phase | Beschreibung | Teilschritte | Risiko | Status |
|-------|-------------|-------------|--------|--------|
| **0** | Dependencies & Infrastruktur | 0.1 – 0.2 | Gering | ✅ `9088b08` |
| **1** | Composables (Draft, UnsavedGuard, Undo/Redo) | 1.1 – 1.4 | Gering | ✅ `a99440b` |
| **2** | Basis-Komponenten | 2.1 – 2.2 | Mittel | |
| **3** | SectionCard + Editor-Umbau | 3.1 – 3.6 | **Hoch** | |
| **4** | Drag & Drop | 4.1 – 4.4 | Mittel | |
| **5** | Recovery, Preview & Polish | 5.1 – 5.8 | Gering | |

---

## Phase 0: Dependencies & Infrastruktur ✅

### 0.1 — Dependencies installieren ✅
```bash
npm install @vueuse/core @vueuse/integrations sortablejs
npm install -D @types/sortablejs
```
- `@vueuse/core` = Explizite Dependency (bisher nur transitiv via bootstrap-vue-next). Wird intensiv genutzt:
  - `useLocalStorage`, `watchDebounced` → Draft-System
  - `useDebouncedRefHistory` → Undo/Redo
  - `useTextareaAutosize` → Auto-wachsende Textareas (erspart eigene Komponente)
  - `onKeyStroke` → Ctrl+S (ersetzt manuellen EventListener)
  - `useEventListener` → beforeunload Guard (auto-cleanup)
  - `onClickOutside` → InlineEditField Bestätigung
  - `useBreakpoints` → Responsive Layout im JS
  - `useConfirmDialog` → Crash Recovery / Revert Dialoge
- `@vueuse/integrations` = `useSortable` Composable (tree-shakeable)
- `sortablejs` = DnD-Engine

### 0.2 — Commit: `chore: add @vueuse/core, @vueuse/integrations, sortablejs` ✅ `9088b08`

---

## Phase 1: Composables ✅

### 1.1 — `useDraft` Composable ✅
**Datei:** `src/composables/useDraft.ts`

```typescript
import { useLocalStorage, watchDebounced } from '@vueuse/core'

// API-Skizze:
useDraft(recipeUuid: Ref<string>, recipe: Ref<Recipe | null>) → {
  hasDraft: Ref<boolean>       // Draft im LocalStorage vorhanden?
  restoreDraft: () => void      // Draft wiederherstellen
  discardDraft: () => void      // Draft löschen
  clearDraft: () => void        // Nach erfolgreichem Save aufrufen
}
```

**Verhalten:**
- `watchDebounced(recipe, saveDraft, { deep: true, debounce: 2000 })` ← VueUse
- `useLocalStorage('draft:' + uuid, null)` für reaktive Bindung ← VueUse
- `onBeforeUnmount`: sofortiger Flush des pending Debounce
- Beim Initialisieren: `hasDraft` prüfen

### 1.2 — `useUnsavedGuard` Composable ✅
**Datei:** `src/composables/useUnsavedGuard.ts`

```typescript
import { useEventListener } from '@vueuse/core'

// API-Skizze:
useUnsavedGuard(isDirty: Ref<boolean> | ComputedRef<boolean>) → void
```

**Verhalten:**
- `onBeforeRouteLeave` → Wenn dirty, `window.confirm()`
- `useEventListener(window, 'beforeunload', …)` ← VueUse (auto-cleanup, kein manuelles `onBeforeUnmount`)

### 1.3 — Undo/Redo via `useDebouncedRefHistory`
**In:** `EditV2.vue` (direkt genutzt, kein eigenes Composable nötig)

```typescript
import { useDebouncedRefHistory } from '@vueuse/core'

const { undo, redo, canUndo, canRedo } = useDebouncedRefHistory(current_recipe, {
  deep: true,
  debounce: 1000,
  capacity: 50,
})
```

**Löst UX-Problem #10** (Kein Undo/Redo) aus der Analyse — quasi geschenkt.
Buttons: `↶ Undo` + `↷ Redo` in der Navbar neben Save/Revert.
Keyboard: `onKeyStroke('z', handler, { ctrl: true })` für Ctrl+Z/Ctrl+Y.

### 1.4 — Commit: `feat(editor): add useDraft + useUnsavedGuard composables` ✅ `a99440b`

---

## Phase 2: Basis-Komponenten

### 2.1 — `InlineEditField.vue`
**Datei:** `src/components/edit/InlineEditField.vue`

Click-to-Edit Muster für Zutatnamen (ersetzt das Rename-Modal):

```
Anzeige:  "200g Mehl"  (Hover → leichter Hintergrund + ✏️)
Klick:    [Input-Feld mit Fokus]  (Enter/Blur → zurück zur Anzeige)
```

**Props:** `modelValue: string`, `placeholder?: string`
**Emits:** `update:modelValue`
**Details:**
- Anzeige-Modus: `<span>` mit `cursor: pointer`, Hover-Klasse
- Edit-Modus: `<input>` mit Auto-Focus, Enter → Commit, Escape → Cancel
- `onClickOutside(inputRef, commit)` ← VueUse (sicherer als blur-Event)
- Kein Modal, kein Extra-Button — direktes Inline-Editing

### ~~2.2~~ — ~~`AutoResizeTextarea.vue`~~ → **Entfällt**

VueUse bietet `useTextareaAutosize` — macht genau das Gleiche als Composable:
```typescript
import { useTextareaAutosize } from '@vueuse/core'
const { textarea, input } = useTextareaAutosize({ input: props.modelValue })
```
Wird direkt in `StepRow.vue` verwendet, keine eigene Komponente nötig.

### 2.2 — Commit: `feat(editor): add InlineEditField component`

---

## Phase 3: SectionCard + Editor-Umbau ⚠️ Kernphase

### 3.1 — `SectionCard.vue`
**Datei:** `src/components/edit/SectionCard.vue`

Die zentrale neue Komponente — eine Card pro Abschnitt:

```
┌─────────────────────────────────────────────────┐
│ [≡] TEIG (inline editierbar)     [▲][▼][···][🗑] │
│ ┌────────────────────┬──────────────────────────┐ │
│ │ ZUTATEN            │ SCHRITTE                 │ │
│ │ (IngredientsCol)   │ (StepsCol)               │ │
│ └────────────────────┴──────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Props:**
```typescript
{
  section: Section              // Der Abschnitt
  ingredients: Ingredient[]     // ALLE Zutaten (flat, wird intern gefiltert)
  steps: Step[]                 // ALLE Schritte (flat, wird intern gefiltert)
  sections: string[]            // Alle Section-Namen (für Verschieben)
  sectionIndex: number          // Position im sections-Array
  totalSections: number         // Für ▲/▼ Disable-Logik
  showHeader: boolean           // false wenn nur 1 leerer Abschnitt
  ingredientUnits: string[]     // Autocomplete-Liste
}
```

**Emits:**
```typescript
{
  'update:section': [name: string]
  'delete-section': []
  'move-section': [direction: 'up' | 'down']
  'add-ingredient': [section: string]
  'add-step': [section: string]
  'update:ingredients': [ingredients: Ingredient[]]
  'update:steps': [steps: Step[]]
}
```

**Layout:**
- Desktop: CSS Grid `grid-template-columns: 1fr 1fr` (Zutaten | Schritte)
- Mobile: `grid-template-columns: 1fr` (untereinander)
- Breakpoint: `@media (max-width: 768px)`

**Interner Aufbau:**
- Header: InlineEditField für Section-Name, Reorder-Buttons, ··· Dropdown, 🗑
- Links: Zutaten-Liste (`filteredIngredients` computed) + „+ Zutat"
- Rechts: Schritte-Liste (`filteredSteps` computed) + „+ Schritt"
- Jede Zutat: InlineEditField (Name), Menge-Input, Einheit-Input, [🗑][▲▼]
- Jeder Schritt: `useTextareaAutosize` (VueUse), Nummerierung, [🗑][▲▼]

### 3.2 — `IngredientRow.vue` (Refactor aus IngredientEdit)
**Datei:** `src/components/edit/IngredientRow.vue`

Vereinfachte Zutat-Zeile innerhalb der SectionCard:

```
[≡] Mehl          200  g     [🗑][▲][▼]
     ↑ InlineEdit  ↑ Inputs        ↑ Actions
```

**Gegenüber IngredientEdit:**
- ❌ Kein Section-Dropdown (gehört zur Card)
- ❌ Kein Rename-Modal (InlineEditField stattdessen)
- ✅ InlineEditField für Name
- ✅ Menge + Einheit Inputs bleiben
- ✅ Notizen über ··· Menü → Collapse
- ✅ Drag Handle `≡`

### 3.3 — `StepRow.vue` (Refactor aus StepEdit)
**Datei:** `src/components/edit/StepRow.vue`

Vereinfachte Schritt-Zeile innerhalb der SectionCard:

```
[≡] 1.  Mehl und Zucker vermischen, dann...    [🗑][▲][▼]
         ↑ AutoResizeTextarea
```

**Gegenüber StepEdit:**
- ❌ Kein Section-Dropdown (gehört zur Card)
- ✅ `useTextareaAutosize` (VueUse) statt BFormInput — auto-wachsend, kein eigenes Komponente
- ✅ Nummerierung (prop `number`)
- ✅ Drag Handle `≡`

### 3.4 — `EditV2.vue` als parallele View

**Strategie:** Der alte Editor (`Edit.vue`) bleibt **vollständig erhalten** unter `/edit/:id`. Der neue Editor wird als `EditV2.vue` mit eigener Route `/edit-v2/:id` entwickelt. So kann man jederzeit vergleichen und notfalls zurückfallen.

**Datei:** `src/views/EditV2.vue`

**Struktur:**
```
Kopfdaten (Titel, Untertitel, Bild, Tags)
Metadaten (collapsible?)
──────────────────────────────
SectionCard ×N (Zutaten + Schritte zusammen)
[+ Neuer Abschnitt]
──────────────────────────────
YAML (nur wenn Expert-Mode)
```

**Vorgehen:**
1. `Edit.vue` kopieren → `EditV2.vue`
2. Route `/edit-v2/:id` in `router/index.ts` hinzufügen (gleiche Guards wie `/edit/:id`)
3. Abschnitte-Block, Zutaten-Block, Schritte-Block **ersetzen** durch:
   ```html
   <SectionCard
     v-for="(section, idx) in current_recipe.sections"
     :key="section.section"
     :section="section"
     :ingredients="current_recipe.ingredients"
     :steps="current_recipe.steps"
     ... weitere Props ...
   />
   <BButton @click="addSection">+ Neuer Abschnitt</BButton>
   ```
4. YAML-Block: `v-if="settings.expert_mode"` (oder ähnliches Flag)
5. `useDraft` + `useUnsavedGuard` integrieren
6. `useDebouncedRefHistory` für Undo/Redo integrieren
7. `onKeyStroke` (VueUse) für Ctrl+S, Ctrl+Z, Ctrl+Y — ersetzt manuellen EventListener
8. isDirty als `computed(() => !deepEqual(store.recipes[selected], current_recipe))`
9. Revert-Button + Undo/Redo-Buttons neben Save-Button in Navbar
10. `addIngredient()` → bekommt Section-Parameter

**Kopfdaten + Metadaten** werden 1:1 aus Edit.vue übernommen (vorerst kein Umbau).

### 3.5 — Route hinzufügen
**Datei:** `src/router/index.ts`

```typescript
{
  path: '/edit-v2/:id',
  name: 'EditV2',
  component: () => import('@/views/EditV2.vue'),
  props: true,
  // gleiche beforeEnter-Guards wie Edit
}
```

Die temporäre Route ermöglicht parallelen Zugriff auf alten + neuen Editor.

### 3.6 — Commit: `feat(editor): card-based EditV2 with SectionCard, IngredientRow, StepRow`

**Alte Komponenten bleiben vorerst alle erhalten** (werden weiterhin von Edit.vue genutzt).
Neue Komponenten werden parallel dazu erstellt.

| Alt (bleibt für Edit.vue) | Neu (für EditV2.vue) |
|---|---|
| SectionIngredientsEdit.vue | SectionCard.vue |
| IngredientEdit.vue | IngredientRow.vue |
| StepEdit.vue | StepRow.vue |
| IngredientModalDialogRename.vue | InlineEditField.vue |
| ArrayReorderBtnGroup.vue | ArrayReorderBtnGroup.vue (shared) |
| IngredientNotesFormRow.vue | IngredientNotesFormRow.vue (shared) |

---

## Phase 4: Drag & Drop

### 4.1 — DnD innerhalb einer SectionCard
**In:** `SectionCard.vue`

```typescript
import { useSortable } from '@vueuse/integrations/useSortable'

const ingredientListRef = ref<HTMLElement>()
const stepListRef = ref<HTMLElement>()

useSortable(ingredientListRef, filteredIngredients, {
  handle: '.drag-handle',
  animation: 150,
  ghostClass: 'sortable-ghost',
})

useSortable(stepListRef, filteredSteps, {
  handle: '.drag-handle',
  animation: 150,
  ghostClass: 'sortable-ghost',
})
```

- Zutaten innerhalb einer Card umsortieren ✅
- Schritte innerhalb einer Card umsortieren ✅
- Handle `.drag-handle` = das `≡` Element

**Herausforderung:** `useSortable` arbeitet mit dem gefilterten Array, aber das Eltern-Array (flat) muss korrekt aktualisiert werden. Lösung: `onUpdate`-Callback, der die Indizes im flachen Array mappt.

### 4.2 — DnD zwischen SectionCards
**In:** `SectionCard.vue` + `EditV2.vue`

```typescript
useSortable(ingredientListRef, filteredIngredients, {
  group: 'ingredients',  // Ermöglicht Cross-Card-DnD
  handle: '.drag-handle',
  onAdd: (evt) => { /* Section-Zuweisung updaten */ },
})
```

- Zutat von Card A nach Card B ziehen → `.section` automatisch updaten
- Schritte analog mit `group: 'steps'`

### 4.3 — DnD für SectionCards selbst
**In:** `EditV2.vue`

```typescript
const sectionContainerRef = ref<HTMLElement>()
useSortable(sectionContainerRef, current_recipe.sections, {
  handle: '.section-drag-handle',
  animation: 150,
})
```

- Ganze Abschnitt-Cards per DnD umsortieren

### 4.4 — Commit: `feat(editor): drag & drop for ingredients, steps, and sections`

---

## Phase 5: Recovery, Preview & Polish

### 5.1 — Crash Recovery Dialog
**In:** `EditV2.vue` (onMounted)

```typescript
onMounted(() => {
  if (hasDraft.value) {
    // Bootstrap-Modal: "Ungespeicherte Änderungen gefunden"
    // → Wiederherstellen / Verwerfen
  }
})
```

### 5.2 — Revert-Button
**In:** `EditV2.vue`

- Button „↩ Verwerfen" neben „💾 Speichern" in Navbar
- `@click` → Bestätigungsdialog → `current_recipe = deepCopy(store.recipes[selected])` + `discardDraft()`
- `disabled` wenn `!isDirty`

### 5.3 — Live-Vorschau
**In:** `EditV2.vue`

- Button „👁 Vorschau" → Modal mit RecipeDisplay-Komponente
- Übergibt `current_recipe` als Prop
- Kein neuer Render-Code nötig

### 5.4 — YAML hinter Expert-Toggle
**In:** `EditV2.vue`

- `v-if="settings.expert_mode"` um den YAML-Block
- Falls `expert_mode` Setting noch nicht existiert → BButton Toggle inline

### 5.5 — Mobile-Optimierung & CSS
- SectionCard responsive Grid (2-col → 1-col)
- Touch-Targets ≥ 44px
- Drag Handle groß genug für Finger
- Sortable-Ghost Styling

### 5.6 — Umschaltung: Edit.vue → EditV2.vue
- Route `/edit/:id` → zeigt auf `EditV2.vue`
- Route `/edit-v2/:id` → entfernen
- Alte `Edit.vue` → in `EditLegacy.vue` umbenennen (oder löschen)
- Alte Edit-Subkomponenten löschen: `SectionIngredientsEdit`, `IngredientEdit`, `StepEdit`, `IngredientModalDialogRename`
- `EditV2.vue` → in `Edit.vue` umbenennen

### 5.7 — Commit: `feat(editor): crash recovery, revert, preview, expert YAML toggle`
### 5.8 — Commit: `refactor(editor): replace legacy editor, cleanup old components`

---

## Reihenfolge & Abhängigkeiten

```
Phase 0 ──→ Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5
 (deps)     (composables) (component)   (umbau)     (DnD)     (polish)
                              │            ↑
                              └────────────┘
                          2.1 wird in 3.x verwendet
```

**Kritischer Pfad:** Phase 3 (SectionCard + Editor-Umbau) ist der größte Block. Wenn das steht, sind die restlichen Phasen relativ unabhängig voneinander.

---

## Test-Strategie

Jede Phase wird manuell getestet:

| Phase | Test |
|-------|------|
| 1 | Draft in DevTools → LocalStorage prüfen; Navigation → Confirm-Dialog |
| 2 | InlineEditField: Klick→Edit→Enter, Escape→Cancel, ClickOutside→Commit |
| 3 | Editor laden → Cards sichtbar, Zutaten+Schritte zusammen, CRUD funktioniert |
| 4 | DnD innerhalb Card, DnD zwischen Cards, Card-Reorder |
| 5 | Browser schließen → Draft Recovery; Revert → Original; Vorschau korrekt; Undo/Redo (Ctrl+Z/Y) |

---

## Dateien-Übersicht (Neu / Geändert)

### Neue Dateien
| Datei | Phase |
|-------|-------|
| `src/composables/useDraft.ts` | 1 |
| `src/composables/useUnsavedGuard.ts` | 1 |
| `src/components/edit/InlineEditField.vue` | 2 |
| `src/components/edit/SectionCard.vue` | 3 |
| `src/components/edit/IngredientRow.vue` | 3 |
| `src/components/edit/StepRow.vue` | 3 |
| `src/views/EditV2.vue` | 3 |

### Geänderte Dateien
| Datei | Phase |
|-------|-------|
| `package.json` | 0 |
| `src/router/index.ts` | 3 (Route hinzufügen), 5 (Route umhängen) |

### Entfallende Dateien (nach Phase 5.6 — Umschaltung)
| Datei | Ersatz |
|-------|--------|
| `Edit.vue` (alt) | EditV2.vue → Edit.vue |
| `SectionIngredientsEdit.vue` | SectionCard.vue |
| `IngredientEdit.vue` | IngredientRow.vue |
| `StepEdit.vue` | StepRow.vue |
| `IngredientModalDialogRename.vue` | InlineEditField.vue |

### Unveränderte Dateien
| Datei | Grund |
|-------|-------|
| `Edit.vue` | **Bleibt während der Entwicklung erhalten** (Legacy) |
| `ArrayReorderBtnGroup.vue` | Weiterhin für ▲/▼ Fallback |
| `IngredientNotesFormRow.vue` | Weiterhin für Notizen |
| `src/types/recipe.ts` | Keine Datenstruktur-Änderung |
| `src/composables/useRecipeHelper.ts` | Unverändert |

---

## VueUse Composables — Übersicht

Alle genutzten `@vueuse/core` + `@vueuse/integrations` Composables auf einen Blick:

| Composable | Paket | Einsatzort | Ersetzt |
|---|---|---|---|
| `useLocalStorage` | core | `useDraft.ts` | Manuelles `localStorage.get/setItem` |
| `watchDebounced` | core | `useDraft.ts` | Eigener `debounce()`-Wrapper |
| `useEventListener` | core | `useUnsavedGuard.ts` | Manuelles `addEventListener` + Cleanup |
| `useDebouncedRefHistory` | core | `EditV2.vue` | — (Bonus: Undo/Redo) |
| `onKeyStroke` | core | `EditV2.vue` | Manuelles `document.addEventListener('keydown')` |
| `useTextareaAutosize` | core | `StepRow.vue` | Geplante `AutoResizeTextarea.vue` Komponente |
| `onClickOutside` | core | `InlineEditField.vue` | blur-Event |
| `useConfirmDialog` | core | `EditV2.vue` | Manuelles Modal-State-Management |
| `useBreakpoints` | core | `SectionCard.vue` | Reine CSS-Media-Queries (optional JS-Zugriff) |
| `useSortable` | integrations | `SectionCard.vue`, `EditV2.vue` | — (DnD-Kern) |
