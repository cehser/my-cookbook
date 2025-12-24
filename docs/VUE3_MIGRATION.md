# Vue 3 Migration - Roadmap

## ✅ Phase 1 - Grundstruktur (FERTIG)
- [x] package.json → Vue 3, Vite, Bootstrap-Vue-Next
- [x] vite.config.js erstellt
- [x] index.html für Vite erstellt
- [x] Router → Vue Router 4 (createRouter, createWebHistory)
- [x] Store → Vuex 4 (createStore)
- [x] main.js → createApp API
- [x] Navbar.vue → jQuery entfernt
- [x] Gallery.vue → Teilweise Bootstrap-Vue-Next

**Branch:** `vue3-migration`  
**Commit:** Phase 1

---

## 🚧 Phase 2 - Bootstrap-Vue-Next Migration (IN ARBEIT)

### Komponentennamen-Mapping
```
Vue 2 (bootstrap-vue)     →  Vue 3 (bootstrap-vue-next)
b-button                  →  BButton
b-form                    →  BForm
b-form-input              →  BFormInput
b-form-select             →  BFormSelect
b-form-checkbox           →  BFormCheckbox
b-form-textarea           →  BFormTextarea
b-form-file               →  BFormFile
b-input-group             →  BInputGroup
b-input-group-prepend     →  #prepend slot
b-input-group-append      →  #append slot
b-container               →  BContainer
b-row                     →  BRow
b-col                     →  BCol
b-link                    →  BLink
b-button                  →  BButton
b-icon-*                  →  Inline SVG oder @bootstrap-icons/vue
b-collapse                →  BCollapse (+ v-b-toggle → v-model)
b-modal                   →  BModal
b-toast                   →  useToast() composable
b-list-group              →  BListGroup
b-list-group-item         →  BListGroupItem
```

### Icons ersetzen
Bootstrap-Vue-Next hat keine eingebauten Icons mehr.

**Option 1: Inline SVG** (aktuell verwendet in Gallery.vue)
```vue
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x">
  <path d="..."/>
</svg>
```

**Option 2: Bootstrap Icons Package** (empfohlen)
```bash
npm install bootstrap-icons
```
```vue
<i class="bi bi-x"></i>
```

### Dateien zu migrieren:

#### Views (Priorität: Hoch)
- [ ] **src/views/Edit.vue** - VIELE Komponenten, komplex
  - b-form-datalist, b-form-input, b-form-select, b-button
  - b-icon-archive-fill, b-icon-pencil, b-icon-trash, b-icon-plus
  - v-model auf Komponenten
  
- [ ] **src/views/Settings.vue** - Mittel komplex
  - b-form-checkbox, b-form-input, b-button, b-input-group
  - b-icon-files
  - vue-async-computed → computed mit async/await ersetzen
  - jQuery für QR-Code
  
- [ ] **src/views/Recipe.vue** - jQuery-lastig
  - jQuery für Collapse/Toggle
  - list-group Komponenten
  
- [ ] **src/views/Administration.vue** - Einfach
  - b-button, b-icon-*, b-list-group

#### Components (Priorität: Mittel)
- [ ] **src/components/RecipeCard.vue**
  - b-icon-pencil → SVG
  - TextHighlight (vue-text-highlight@3.0)
  
- [ ] **src/components/IngredientEdit.vue**
  - b-form-row, b-form-input, b-form-select
  - b-button, b-icon-*
  - v-b-toggle → v-model mit BCollapse
  - v-model="ingredient" → defineEmits
  
- [ ] **src/components/StepEdit.vue**
  - b-form-row, b-form-input, b-button
  - b-icon-*
  
- [ ] **src/components/SectionIngredientsEdit.vue**
  - Vermutlich b-form Komponenten
  
- [ ] **src/components/IngredientNotesFormRow.vue**
  - b-form-row, b-form-input, b-button
  
- [ ] **src/components/IngredientModalDialogRename.vue**
  - jQuery modal Handling → BModal mit v-model
  
- [ ] **src/components/ArrayReorderBtnGroup.vue**
  - b-button, b-icon-*

### Breaking Changes zu beachten:

#### 1. v-model auf Custom Components
**Vue 2:**
```vue
<custom-input v-model="value" />
// In Component:
props: ['value']
this.$emit('input', newValue)
```

**Vue 3:**
```vue
<custom-input v-model="value" />
// In Component:
props: ['modelValue']
defineEmits(['update:modelValue'])
emit('update:modelValue', newValue)
```

#### 2. $listeners entfernt
**Vue 2:**
```vue
v-on="$listeners"
```

**Vue 3:**
```vue
// Nicht mehr nötig, automatisch weitergegeben
// Oder explizit mit defineEmits
```

#### 3. Bootstrap Collapse
**Vue 2:**
```vue
<b-button v-b-toggle="'collapse-id'">Toggle</b-button>
<b-collapse id="collapse-id">...</b-collapse>
```

**Vue 3:**
```vue
<BButton @click="visible = !visible">Toggle</BButton>
<BCollapse v-model="visible">...</BCollapse>
```

#### 4. Toasts
**Vue 2:**
```vue
this.$bvToast.toast('Message', { variant: 'success' })
```

**Vue 3:**
```vue
import { useToast } from 'bootstrap-vue-next'
const toast = useToast()
toast.show({ title: 'Message', variant: 'success' })
```

#### 5. Input Group Slots
**Vue 2:**
```vue
<b-input-group>
  <b-input-group-prepend>Text</b-input-group-prepend>
  <b-form-input />
  <b-input-group-append>Button</b-input-group-append>
</b-input-group>
```

**Vue 3:**
```vue
<BInputGroup>
  <template #prepend>Text</template>
  <BFormInput />
  <template #append>Button</template>
</BInputGroup>
```

---

## 🔜 Phase 3 - jQuery entfernen

jQuery wird verwendet in:
- src/views/Recipe.vue - Collapse/Toggle, Scrolling
- src/views/Settings.vue - QR Scanner, DOM Manipulation
- src/components/IngredientModalDialogRename.vue - Modal Handling
- src/components/IngredientEdit.vue - Focus Handling
- src/components/StepEdit.vue - Focus Handling
- src/store/actions.js - DOM Manipulation (?)

**Ersetzen durch:**
- Vanilla JS oder Vue refs
- Bootstrap 5 native JS
- Vue Lifecycle Hooks

---

## 🔜 Phase 4 - Weitere Libraries

### vue-async-computed entfernen
Settings.vue verwendet `asyncComputed`.

**Ersetzen durch:**
```vue
<script setup>
import { ref, watch } from 'vue'

const configurl = ref('')

const updateConfigUrl = async () => {
  configurl.value = await json_url.compress(settings.value)
}

watch(settings, updateConfigUrl, { deep: true })
</script>
```

### v-clipboard ersetzen
Settings.vue: copyConfigUrl Funktion ist bereits implementiert ✅

---

## 🔜 Phase 5 - Testing & Docker

- [ ] npm install im Container
- [ ] Dev-Server testen (Vite)
- [ ] Build testen
- [ ] Dockerfile für Vite anpassen
- [ ] docker-compose.dev.yml testen
- [ ] Alle Features durchgehen

---

## 🔜 Phase 6 - Cleanup

- [ ] vue.config.js löschen
- [ ] babel.config.js löschen (?)
- [ ] public/index.html löschen
- [ ] registerServiceWorker.js löschen
- [ ] Alte Dev-Dependencies entfernen

---

## Hilfreiche Commands

### Alle Bootstrap-Vue Komponenten finden
```powershell
Get-ChildItem -Path "src" -Include "*.vue" -Recurse | Select-String -Pattern "b-[a-z-]+" | Group-Object Pattern
```

### Alle jQuery Verwendungen finden
```powershell
Get-ChildItem -Path "src" -Include "*.vue","*.js" -Recurse | Select-String -Pattern '\$\('
```

### Dependencies installieren
```powershell
docker run --rm -it -v ${PWD}:/app -w /app node:lts-alpine sh -c "rm -rf node_modules package-lock.json && npm install --legacy-peer-deps"
```

### Dev-Server starten
```powershell
docker-compose -f docker-compose.dev.yml up
```

---

## Migration Script (PowerShell)

Automatisches Ersetzen von Komponentennamen:

```powershell
# Bootstrap-Vue zu Bootstrap-Vue-Next
$files = Get-ChildItem -Path "src" -Include "*.vue" -Recurse

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    
    # Komponenten ersetzen (kebab-case zu PascalCase)
    $content = $content -replace '<b-button', '<BButton'
    $content = $content -replace '</b-button>', '</BButton>'
    $content = $content -replace '<b-form-input', '<BFormInput'
    $content = $content -replace '</b-form-input>', '</BFormInput>'
    # ... mehr Ersetzungen
    
    Set-Content $file.FullName $content
}
```

---

## Nächste Schritte

1. Bootstrap Icons Package installieren
2. Edit.vue migrieren (größte Datei)
3. Settings.vue migrieren
4. Recipe.vue jQuery entfernen
5. Restliche Komponenten
6. Testing
