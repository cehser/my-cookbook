<template>
  <div id="administration">
    <AppNavbar
      @update:selected="navSelected"
      :recipes_list="recipes_list"
      selected=""
      :read_only="settings.read_only"
    >
    </AppNavbar>
    <BContainer>
      <h2>Verwaltung</h2>

      <!-- User Management Section -->
      <div class="mb-4">
        <h4><i class="bi bi-people"></i> Benutzer</h4>
        <div v-if="usersLoading" class="text-muted">Lade Benutzer…</div>
        <div v-else-if="usersError" class="text-danger">{{ usersError }}</div>
        <div v-else>
          <div v-if="pendingUsers.length" class="alert alert-warning py-2 mb-3">
            <i class="bi bi-exclamation-triangle"></i>
            <strong>{{ pendingUsers.length }}</strong> Nutzer warten auf Freigabe
          </div>
          <table class="table table-sm table-hover align-middle">
            <thead class="table-light">
              <tr>
                <th>Name</th>
                <th>E-Mail</th>
                <th>Rolle</th>
                <th>Erstellt</th>
                <th>Letzter Login</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.oidc_sub" :class="{ 'table-warning': u.role === 'pending' }">
                <td>
                  <div>{{ u.given_name || u.family_name ? [u.given_name, u.family_name].filter(Boolean).join(' ') : u.display_name }}</div>
                  <small v-if="u.given_name || u.family_name" class="text-muted">{{ u.display_name }}</small>
                </td>
                <td><small>{{ u.email || '—' }}</small></td>
                <td>
                  <select
                    class="form-select form-select-sm"
                    style="width: auto; min-width: 120px"
                    :value="u.role"
                    @change="changeRole(u, $event.target.value)"
                    :disabled="u.saving"
                  >
                    <option value="pending">⏳ Pending</option>
                    <option value="readonly">👁️ Readonly</option>
                    <option value="editor">✏️ Editor</option>
                    <option value="admin">🛡️ Admin</option>
                  </select>
                </td>
                <td>{{ formatDate(u.created_at) }}</td>
                <td>{{ u.last_login ? formatDate(u.last_login) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <hr />

      <div class="d-flex flex-wrap">
        <BButton
          v-if="!settings.read_only && settings.role === 'admin'"
          class="btn m-2"
          @click="migrateImages"
          ><i class="bi bi-images"></i><br />Bild-URLs migrieren</BButton
        >
        <BButton v-if="!settings.read_only" class="btn m-2" @click="newRecipe"
          ><i class="bi bi-file-earmark-plus"></i><br />Neues Rezept</BButton
        >
        <BButton v-if="!settings.read_only" class="btn m-2" @click="loadSample"
          ><i class="bi bi-file-earmark-text"></i><br />Beispielrezept</BButton
        >
        <BButton
          v-if="!settings.read_only && settings.expert_mode"
          class="btn m-2"
          @click="triggerImport"
          ><i class="bi bi-upload"></i><br />YAML Import</BButton
        >
        <input
          ref="fileInput"
          type="file"
          accept=".yaml,.yml"
          @change="importRecipe"
          style="display: none"
        />
      </div>

      <BListGroup flush v-for="(recipe, index) in recipes" :key="index">
        <BListGroupItem
          >{{ recipe.recipe_name }}
          <BButton
            v-if="!settings.read_only"
            class="btn-sm"
            @click="deleteRecipe(index)"
            ><i class="bi bi-x"></i
          ></BButton>
          <BButton
            v-if="!settings.read_only"
            class="btn-sm"
            @click="copyRecipe(index)"
            ><i class="bi bi-files"></i
          ></BButton>
          <BButton
            v-if="settings.expert_mode"
            class="btn-sm"
            @click="exportRecipe(index)"
            title="Als YAML exportieren"
            ><i class="bi bi-download"></i
          ></BButton>
        </BListGroupItem>
      </BListGroup>

      <BButton class="btn mb-4" @click="saveToLocalStorage"
        ><i class="bi bi-archive-fill"></i> Speichern</BButton
      >
    </BContainer>
  </div>
</template>

<script>
import { mapState } from "vuex";

import AppNavbar from "@/components/layout/AppNavbar.vue";
import { adminApi } from "@/api/admin";
import { useRecipeHelper } from "@/composables/useRecipeHelper";
import { useToast } from "@/composables/useToast";
import UUID from "@/js/uuid";
import { deepCopyYaml } from "@/js/deepCopy";
import Recipes from "@/js/recipes";
import jsyaml from "js-yaml";
import { ref } from "vue";
import { recipeUrl } from "@/js/slug";

export default {
  name: "Administration",
  components: {
    AppNavbar,
  },
  setup() {
    const recipeId = ref('');
    const recipeHelper = useRecipeHelper({ recipeId });
    const { toast } = useToast();

    return {
      ...recipeHelper,
      toast,
    };
  },
  data() {
    return {
      users: [],
      usersLoading: false,
      usersError: null,
    };
  },
  computed: {
    // mix the getters into computed with object spread operator
    ...mapState(["settings", "recipes", "recipe_pictures"]),
    pendingUsers() {
      return this.users.filter(u => u.role === 'pending');
    },
  },
  mounted() {
    this.loadUsers();
    document.onkeydown = (event) => {
      //ctrl + s
      if (event.ctrlKey && event.code === "KeyS") {
        event.preventDefault(); //do not show browser dialog
        this.saveToLocalStorage();
      }
    };
  },
  methods: {
    async loadUsers() {
      this.usersLoading = true;
      this.usersError = null;
      try {
        this.users = (await adminApi.listUsers()).map(u => ({ ...u, saving: false }));
      } catch (e) {
        this.usersError = 'Benutzer konnten nicht geladen werden.';
      } finally {
        this.usersLoading = false;
      }
    },
    async changeRole(user, newRole) {
      const oldRole = user.role;
      user.role = newRole;
      user.saving = true;
      try {
        await adminApi.updateRole(user.oidc_sub, newRole);
        this.toast(`Rolle von ${user.display_name} → ${newRole}`, 'success');
      } catch (e) {
        user.role = oldRole;
        this.toast('Rolle konnte nicht geändert werden: ' + e.message, 'danger');
      } finally {
        user.saving = false;
      }
    },
    formatDate(iso) {
      if (!iso) return '—';
      return new Date(iso).toLocaleDateString('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    },
    navSelected(uuid) {
      const recipe = this.recipes.find(r => r.recipe_uuid === uuid);
      this.$router.push(recipeUrl(uuid, recipe?.recipe_name));
    },
    deleteRecipe: function (index) {
      this.$store.dispatch("deleteRecipe", index);
    },
    copyRecipe: function (index) {
      //deep copy recipe
      let recipe = deepCopyYaml(this.recipes[index]);
      //new uuid
      recipe.recipe_uuid = UUID.generateUUID();
      //load
      this.$store.dispatch("appendRecipe", recipe);
    },
    newRecipe: function () {
      this.$store.dispatch("appendRecipe", Recipes.loadNewRecipe());
    },
    loadSample: function () {
      this.$store.dispatch("appendRecipe", Recipes.loadSample());
    },
    async migrateImages() {
      try {
        const { default: api } = await import('@/api/client');
        const result = await api.post('/admin/migrate-images');
        this.toast(
          `Migration: ${result.migrated} Bilder gespeichert, ${result.failed} fehlgeschlagen.`,
          result.failed > 0 ? 'warning' : 'success'
        );
        // Reload recipes to pick up new image IDs
        this.$store.dispatch('loadRecipesFromApi');
      } catch (e) {
        this.toast('Migration fehlgeschlagen: ' + e.message, 'danger');
      }
    },
    saveToLocalStorage: function () {
      this.$store.dispatch("saveRecipes");
      this.$store
        .dispatch("saveRecipePictures")
        .then(() => this.toast("Gespeichert.", "success"));
    },
    saveRecipeAsFile: function () {
      let fileNameToSaveAs = "recipe.yaml";
      let textFileAsBlob = new Blob([jsyaml.dump(this.current_recipe)], {
        type: "text/plain",
      });
      let downloadLink = document.createElement("a");
      downloadLink.download = fileNameToSaveAs;
      downloadLink.innerHTML = "Download File";
      if (window.webkitURL != null) {
        // Chrome allows the link to be clicked
        // without actually adding it to the DOM.
        downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
      } else {
        // Firefox requires the link to be added to the DOM
        // before it can be clicked.
        downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
        downloadLink.onclick = this.destroyClickedElement;
        downloadLink.style.display = "none";
        document.body.appendChild(downloadLink);
      }

      downloadLink.click();
    },
    saveCookbookAsFile: function () {
      let fileNameToSaveAs = "cookbook.yaml";
      let blob = new Blob([jsyaml.dump(this.recipes)], {
        type: "application/octet-stream",
      });
      let url = window.URL.createObjectURL(blob);
      window.URL = window.URL || window.webkitURL;

      window.location.href = url;

      if (
        navigator.userAgent.match(/iPad/i) ||
        navigator.userAgent.match(/iPhone/i)
      ) {
        //Safari & Opera iOS
        window.location.href = url;
      } else {
        let downloadLink = document.createElement("a");
        downloadLink.download = fileNameToSaveAs;
        downloadLink.innerHTML = "Download File";
        downloadLink.href = url;
        downloadLink.onclick = this.destroyClickedElement;
        downloadLink.style.display = "none";
        document.body.appendChild(downloadLink);
        downloadLink.click();
      }
    },
    loadFromFile: function (ev) {
      const file = ev.target.files[0];
      const reader = new FileReader();

      reader.onload = (e) => {
        let content = jsyaml.load(e.target.result);
        let recipes = [];

        if (!Array.isArray(content)) {
          recipes = [content];
        } else {
          recipes = content;
        }

        recipes.forEach((recipe) => {
          this.appendRecipe(recipe);
        });
      };
      //reader.onload = e => console.log(e.target.result);

      reader.readAsText(file);
    },
    triggerImport: function () {
      this.$refs.fileInput.click();
    },
    importRecipe: function (ev) {
      const file = ev.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const recipe = jsyaml.load(e.target.result);
          this.$store.dispatch("appendRecipe", recipe);
          this.toast(`Rezept "${recipe.recipe_name}" importiert.`, "success");
          this.$refs.fileInput.value = "";
        } catch (error) {
          this.toast("Fehler beim Importieren: " + error.message, "danger");
        }
      };
      reader.readAsText(file);
    },
    exportRecipe: function (index) {
      const recipe = this.recipes[index];
      const yaml = jsyaml.dump(recipe);
      const blob = new Blob([yaml], { type: "text/yaml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${recipe.recipe_name || "recipe"}.yaml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  },
};
</script>
