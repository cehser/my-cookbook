# Development Guidelines — my-cookbook Frontend

> **Gültig ab:** 28.03.2026
> **Durchsetzung:** ESLint (`npm run lint`), TypeScript (`vue-tsc --noEmit`), CI-Pipeline
> **Scope:** Alle Dateien unter `frontend/src/`

---

## 1. Komponenten-Stil

### 1.1 Nur `<script setup lang="ts">` — keine Options API

```vue
<!-- ✅ Richtig -->
<script setup lang="ts">
import { ref, computed } from 'vue'
const count = ref(0)
</script>

<!-- ❌ Verboten -->
<script lang="ts">
export default {
  data() { return { count: 0 } }
}
</script>
```

**Regel:** Alle Vue-Komponenten MÜSSEN `<script setup lang="ts">` verwenden.
**ESLint:** `vue/component-api-style: ["error", ["script-setup"]]`

### 1.2 Kein `defineComponent()` in `<script setup>`

`defineComponent()` ist nur für Options API nötig und darf nicht in `<script setup>` verwendet werden.

**ESLint:** `vue/no-undef-components` (via unplugin auto-import)

---

## 2. State Management

### 2.1 Nur Pinia — kein Vuex, kein globaler State

```ts
// ✅ Richtig
import { useRecipeStore } from '@/store/recipeStore'
const store = useRecipeStore()
await store.loadRecipes()

// ❌ Verboten
import { useStore } from 'vuex'
this.$store.dispatch('loadRecipes')
```

**Regel:** State Management ausschließlich über Pinia-Stores (`useRecipeStore`, `useUIStore`).
**ESLint:** `no-restricted-imports` für `vuex`

### 2.2 Store-Zugriff über Composables

Stores werden in Komponenten über `useXxxStore()` aufgerufen, nie über `inject()` oder globale Variablen.

---

## 3. TypeScript

### 3.1 Strict Mode — immer aktiv

`tsconfig.json` hat `"strict": true`. Das bedeutet:
- `noImplicitAny` — kein implizites `any`
- `strictNullChecks` — `null`/`undefined` müssen explizit behandelt werden
- `strictFunctionTypes` — Funktionstypen sind kontravariant

### 3.2 Kein `any` — konkrete Typen verwenden

```ts
// ✅ Richtig
function handleError(err: unknown) {
  if (err instanceof Error) console.error(err.message)
}

// ❌ Verboten
function handleError(err: any) {
  console.error(err.message)
}
```

**Regel:** `any` ist verboten. Stattdessen `unknown`, Generics oder konkrete Interfaces verwenden.
**ESLint:** `@typescript-eslint/no-explicit-any: "error"`

### 3.3 Typen für Props und Emits

```vue
<script setup lang="ts">
// ✅ Richtig — typisierte Props
const props = defineProps<{
  recipe: Recipe
  editable?: boolean
}>()

// ✅ Richtig — typisierte Emits
const emit = defineEmits<{
  save: [recipe: Recipe]
  cancel: []
}>()
</script>
```

**Regel:** Props und Emits MÜSSEN TypeScript-Generics verwenden, nicht die Runtime-Deklaration.

---

## 4. Imports & Exports

### 4.1 Nur Named Exports — kein `export default`

```ts
// ✅ Richtig
export function loadRecipe(id: string): Recipe { ... }
export { recipeApi }

// ❌ Verboten (in .ts-Dateien)
export default { loadRecipe }
```

**Regel:** TypeScript-Module (`.ts`) verwenden ausschließlich Named Exports.
**ESLint:** `no-restricted-exports` für `default` in `.ts`-Dateien

### 4.2 Verbotene Imports

Folgende Packages dürfen nicht importiert werden:

| Package | Grund |
|---------|-------|
| `vuex` | Ersetzt durch Pinia |
| `jsonpath` | Sicherheitslücke (Arbitrary Code Injection) |
| `lodash` | Nicht installiert, native JS bevorzugen |

**ESLint:** `no-restricted-imports`

---

## 5. Code-Qualität

### 5.1 Keine ungenutzten Variablen

**ESLint:** `@typescript-eslint/no-unused-vars: "error"` (mit `_`-Prefix-Ausnahme für absichtlich ignorierte Werte)

### 5.2 Keine `console.log` in Production Code

```ts
// ✅ Richtig — kein console.log (oder bewusst als warn/error)
console.warn('Recipe not found:', id)

// ❌ Verboten
console.log('debug:', data)
```

**ESLint:** `no-console: ["warn", { allow: ["warn", "error"] }]`

### 5.3 Kein `var` — nur `const` und `let`

**ESLint:** `no-var: "error"`, `prefer-const: "error"`

---

## 6. Vue-spezifische Regeln

### 6.1 Component Names

- Komponenten in `views/` dürfen Single-Word-Namen haben (`Gallery.vue`, `Edit.vue`)
- Alle anderen Komponenten MÜSSEN Multi-Word-Namen verwenden (`RecipeCard.vue`, `AppNavbar.vue`)

**ESLint:** `vue/multi-word-component-names` (mit Ausnahme für `views/`)

### 6.2 Keine `v-html` ohne Sanitization

`v-html` ist ein XSS-Risiko und sollte vermieden werden. Falls nötig, Input vorher sanitizen.

**ESLint:** `vue/no-v-html: "warn"`

### 6.3 Template-Reihenfolge

```vue
<!-- Reihenfolge in .vue-Dateien -->
<script setup lang="ts">...</script>
<template>...</template>
<style scoped lang="scss">...</style>
```

**ESLint:** `vue/block-order: ["error", { order: ["script", "template", "style"] }]`

---

## 7. Dateistruktur

```
src/
├── api/          # API-Client-Module (ein File pro Ressource)
├── assets/       # Statische Assets (Bilder, Samples)
├── auth/         # OIDC Auth (Guards, Client)
├── components/   # Vue-Komponenten (nach Feature gruppiert)
│   ├── common/   # Wiederverwendbare UI-Bausteine
│   ├── edit/     # Edit-spezifische Komponenten
│   ├── features/ # Feature-Komponenten (AI Import, etc.)
│   ├── layout/   # App-Shell (Navbar, etc.)
│   └── recipe/   # Rezept-Anzeige-Komponenten
├── composables/  # Vue Composables (useXxx.ts)
├── js/           # Reine Utility-Funktionen (kein Vue)
├── prompts/      # AI-Prompts
├── router/       # Vue Router Config
├── store/        # Pinia Stores (useXxxStore.ts)
├── types/        # TypeScript Interfaces & Types
└── views/        # Routen-Views (1:1 mit Router)
```

### 7.1 Benennungskonventionen

| Typ | Konvention | Beispiel |
|-----|-----------|----------|
| Vue-Komponente | PascalCase | `RecipeCard.vue` |
| Composable | camelCase mit `use`-Prefix | `useRecipeHelper.ts` |
| Pinia Store | camelCase mit `use`-Prefix + `Store`-Suffix | `useRecipeStore.ts` |
| TypeScript-Modul | camelCase | `deepCopy.ts` |
| Interface/Type | PascalCase | `Recipe`, `UserSettings` |

---

## 8. Abhängigkeiten

### 8.1 Keine neuen Dependencies ohne Review

Vor dem Hinzufügen einer neuen Dependency:
1. Prüfen ob native JS/TS ausreicht
2. Bundle-Size-Impact prüfen (`npm pack --dry-run` oder bundlephobia.com)
3. Maintenance-Status prüfen (letzte Updates, open Issues)
4. `npm audit` nach Installation ausführen

### 8.2 Regelmäßiger Dependency-Audit

- `npm outdated` und `npm audit` mindestens monatlich ausführen
- Patch/Minor-Updates zeitnah einspielen
- Major-Updates einzeln mit Changelog-Review

---

## 9. Git-Konventionen

### 9.1 Commit-Messages

Format: `<type>(<scope>): <description>`

| Type | Verwendung |
|------|-----------|
| `feat` | Neues Feature |
| `fix` | Bugfix |
| `refactor` | Code-Umbau ohne Funktionsänderung |
| `chore` | Dependencies, Config, CI |
| `docs` | Dokumentation |
| `style` | Formatting, kein Code-Change |

### 9.2 Branch-Strategie

- `main` — Production-ready
- `feat-*` — Feature-Branches
- Kein direkter Push auf `main`

---

## 10. Qualitätssicherung

### 10.1 Vor jedem Commit

```bash
npm run lint          # ESLint + Auto-Fix
npx vue-tsc --noEmit  # TypeScript-Check
npm run build         # Build-Verifizierung
```

### 10.2 CI-Pipeline (Ziel)

Jeder Push sollte automatisch folgende Checks durchlaufen:
1. `npm run lint` (kein `--fix`, nur prüfen)
2. `vue-tsc --noEmit`
3. `npm run build`
4. `npm audit --audit-level=high`
