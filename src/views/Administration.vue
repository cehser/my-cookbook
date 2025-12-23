<template>
  <div id="administration">
    <Navbar
      @input="selected = $event"
      :recipes_list="recipes_list"
      :selected="selected"
      :read_only="settings.read_only"
    >
    </Navbar>
    <BContainer>
      <h2>Verwaltung</h2>

      <!-- AI Import Section -->
      <AIRecipeImport
        v-if="!settings.read_only"
        @imported="onAIImport"
        class="mb-4"
      />

      <div class="d-flex flex-wrap">
        <BButton
          v-if="!settings.read_only"
          class="btn m-2"
          @click="syncWithWebDAV"
          ><i class="bi bi-arrow-repeat"></i><br />Cloud-Abgleich</BButton
        >
        <BButton class="btn m-2" @click="loadFromWebDAV"
          ><i class="bi bi-cloud-download"></i><br />Cloud-Download</BButton
        >
        <BButton class="btn m-2" @click="loadPictures"
          ><i class="bi bi-cloud-download"></i><br />Bilder-Download</BButton
        >
        <BButton
          v-if="!settings.read_only"
          class="btn m-2"
          @click="saveToWebDAV"
          ><i class="bi bi-cloud-upload"></i><br />Cloud-Upload</BButton
        >
      </div>

      <div class="d-flex flex-wrap">
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

import Navbar from "@/components/Navbar.vue";
import AIRecipeImport from "@/components/AIRecipeImport.vue";
import { useRecipeHelper } from "@/composables/useRecipeHelper";
import { useToast } from "@/composables/useToast";
import UUID from "../js/uuid";
import { deepCopyYaml } from "../js/deepCopy";
import Recipes from "../js/recipes";
import Cloud from "../js/cloud";

import jsyaml from "js-yaml";
import { computed } from "vue";

export default {
  name: "Administration",
  props: {
    selected: {
      type: Number,
      default: 0,
    },
  },
  components: {
    Navbar,
    AIRecipeImport,
  },
  setup(props) {
    const selectedRef = computed(() => props.selected);
    const recipeHelper = useRecipeHelper({ selected: selectedRef });
    const { toast } = useToast();

    return {
      ...recipeHelper,
      toast,
    };
  },
  data() {
    return {};
  },
  computed: {
    // mix the getters into computed with object spread operator
    ...mapState(["settings", "recipes", "recipe_pictures"]),
  },
  mounted() {
    document.onkeydown = (event) => {
      //ctrl + s
      if (event.ctrlKey && event.code === "KeyS") {
        event.preventDefault(); //do not show browser dialog
        this.saveToLocalStorage();
      }
    };
  },
  methods: {
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
    saveToWebDAV: function () {
      const spinner = document.querySelector("#loading-spinner");
      if (spinner) spinner.classList.remove("d-none");
      Cloud.putRecipes(this.settings, this.recipes, this.recipe_pictures)
        .then(() => this.toast("Gespeichert.", "success"))
        .catch(() => this.toast("Fehlgeschlagen.", "danger"))
        .finally(() => {
          if (spinner) spinner.classList.add("d-none");
        });
    },
    loadFromWebDAV: async function () {
      const spinner = document.querySelector("#loading-spinner");
      if (spinner) spinner.classList.remove("d-none");
      this.$store
        .dispatch("getRecipesFromCloud")
        .then(() => this.toast("Geladen.", "success"))
        .catch(() => this.toast("Fehler.", "danger"))
        .finally(() => {
          if (spinner) spinner.classList.add("d-none");
        });
    },
    loadPictures: async function () {
      const spinner = document.querySelector("#loading-spinner");
      if (spinner) spinner.classList.remove("d-none");
      this.$store
        .dispatch("downloadRecipePictures")
        .then(() => this.toast("Geladen.", "success"))
        .catch(() => this.toast("Fehler.", "danger"))
        .finally(() => {
          const spinner = document.querySelector("#loading-spinner");
          if (spinner) spinner.classList.add("d-none");
        });
    },
    syncWithWebDAV: async function () {
      const spinner = document.querySelector("#loading-spinner");
      if (spinner) spinner.classList.remove("d-none");
      this.$store
        .dispatch("syncRecipesWithCloud")
        .then(() => this.toast("Synchronisiert.", "success"))
        .catch(() => this.toast("Fehler.", "danger"))
        .finally(() => {
          if (spinner) spinner.classList.add("d-none");
        });
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
    onAIImport(recipe) {
      this.toast(
        `Rezept "${recipe.recipe_name}" per AI importiert.`,
        "success",
      );
    },
  },
};
</script>
