<template>
  <div id="settings">
    <AppNavbar
      @input="navSelected"
      :recipes_list="recipes_list"
      selected=""
      :read_only="store_settings.read_only"
    />
    <BContainer>
      <h2>Einstellungen</h2>

      <!-- Role badge -->
      <div class="mb-3">
        <span class="badge" :class="roleBadgeClass">{{ roleLabel }}</span>
      </div>

      <!-- Read-only toggle -->
      <BFormCheckbox v-model="settings.read_only" name="read-only" switch>
        Nur lesen
      </BFormCheckbox>

      <!-- Expert mode toggle -->
      <BFormCheckbox v-model="settings.expert_mode" name="expert-mode" switch>
        Experten-Modus
      </BFormCheckbox>

      <!-- Expert mode info -->
      <BAlert
        v-if="settings.expert_mode"
        variant="info"
        :model-value="true"
        class="mt-2"
      >
        <h6 class="alert-heading">
          <i class="bi bi-info-circle-fill"></i> Experten-Modus aktiv
        </h6>
        <p class="mb-0">Folgende erweiterte Funktionen sind jetzt verfügbar:</p>
        <ul class="mb-0 mt-2">
          <li><strong>Galerie:</strong> YAML-Import von Rezepten</li>
          <li><strong>Rezeptansicht:</strong> YAML-Export einzelner Rezepte</li>
          <li>
            <strong>Verwaltung:</strong> YAML Import/Export für alle Rezepte
          </li>
        </ul>
      </BAlert>

      <!-- GPT Model -->
      <div class="mt-4">
        <h5>AI-Integration</h5>
        <div class="form-group">
          <label for="gpt_model" class="col-form-label">GPT-Modell</label>
          <input
            id="gpt_model"
            v-model="settings.gpt_model"
            list="gpt-model-options"
            autocomplete="off"
            placeholder="z.B. gpt-5.4-mini"
            class="form-control"
            @input="userEdited = true"
          />
          <datalist id="gpt-model-options">
            <option value="gpt-5.4-nano">GPT-5.4 nano – günstigstes GPT-5.4-Modell</option>
            <option value="gpt-5.4-mini">GPT-5.4 mini – stark, schnell, günstig</option>
            <option value="gpt-5.4">GPT-5.4 – bestes Frontier-Modell</option>
            <option value="gpt-5-nano">GPT-5 nano – schnellstes GPT-5</option>
            <option value="gpt-5-mini">GPT-5 mini – near-frontier, günstig</option>
            <option value="gpt-5">GPT-5 – leistungsstarkes Reasoning</option>
            <option value="gpt-4.1-nano">GPT-4.1 nano – schnell, sparsam</option>
            <option value="gpt-4.1-mini">GPT-4.1 mini – kompakt</option>
            <option value="gpt-4.1">GPT-4.1 – bestes Non-Reasoning-Modell</option>
            <option value="gpt-4o-mini">GPT-4o mini – älter, günstig</option>
            <option value="gpt-4o">GPT-4o – älter, flexibel</option>
          </datalist>
          <small class="form-text text-muted">
            Wähle ein Modell aus der Liste oder gib eine eigene ID ein.
          </small>
        </div>
      </div>

      <!-- Save button -->
      <div class="mt-4 mb-4">
        <BButton
          variant="primary"
          :disabled="!changed"
          @click="saveChanges"
        >
          Speichern
        </BButton>
      </div>
    </BContainer>
  </div>
</template>

<script>
import AppNavbar from "@/components/layout/AppNavbar.vue";
import { useRecipeHelper } from "@/composables/useRecipeHelper";
import { mapState } from "vuex";
import { useToast } from "@/composables/useToast";
import deepEqual from "deep-equal";
import { ref } from "vue";
import { recipeUrl } from "@/js/slug";

export default {
  name: "Settings",
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
      settings: null,
      userEdited: false,
    };
  },
  created() {
    this.settings = JSON.parse(JSON.stringify(this.store_settings));
  },
  watch: {
    store_settings: {
      deep: true,
      handler(newVal) {
        // Update local copy when store is updated (e.g. async loadSettings),
        // but only if the user hasn't started editing yet.
        if (!this.userEdited) {
          this.settings = JSON.parse(JSON.stringify(newVal));
        }
      },
    },
    settings: {
      deep: true,
      handler() {
        // Mark as user-edited once local settings diverge from store
        if (this.settings && !deepEqual(this.settings, this.store_settings)) {
          this.userEdited = true;
        }
      },
    },
  },
  computed: {
    ...mapState({
      store_settings: "settings",
      recipes: "recipes",
    }),
    changed() {
      return !deepEqual(this.settings, this.store_settings);
    },
    roleBadgeClass() {
      const role = this.settings?.role || this.store_settings?.role;
      if (role === "admin") return "bg-danger";
      if (role === "editor") return "bg-success";
      return "bg-secondary";
    },
    roleLabel() {
      const role = this.settings?.role || this.store_settings?.role;
      if (role === "admin") return "Administrator";
      if (role === "editor") return "Bearbeiter";
      return "Nur Lesen";
    },
  },
  methods: {
    navSelected(uuid) {
      const recipe = this.$store.state.recipes.find(r => r.recipe_uuid === uuid);
      this.$router.push(recipeUrl(uuid, recipe?.recipe_name));
    },
    async saveChanges() {
      await this.$store.dispatch("saveSettings", this.settings);
      this.settings = JSON.parse(JSON.stringify(this.store_settings));
      this.userEdited = false;
      this.toast("Einstellungen", "Gespeichert.", "success");
    },
  },
};
</script>
