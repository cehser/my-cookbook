import { defineStore } from "pinia";
import { set, get } from "idb-keyval";
import { loadYamlCookbook, loadSample } from "@/js/recipes";
import { deepCopyJSON } from "@/js/deepCopy";
import { detailToRecipe, listItemToRecipe } from "@/js/recipeMapping";
import {
  serializeRecipePictures,
  deserializeRecipePictures,
  type SerializedRecipePictures,
} from "@/js/fileStorage";
import {
  readFavorites,
  readRecipeDetail,
  readRecipes,
  readSettings,
  writeFavorites,
  writeRecipeDetail,
  writeRecipes,
  writeSettings,
} from "@/js/offlineCache";
import { api, isClientError } from "@/api/client";
import { recipeApi, type RecipeDetail } from "@/api/recipes";
import { favoritesApi } from "@/api/favorites";
import { imageApi } from "@/api/images";
import { ensureAuth, isAuthenticated, loginFollows } from "@/auth/session";
import type { Recipe, RecipePictures } from "@/types/recipe";
import type { Settings } from "@/types/settings";

/**
 * Herkunft der geladenen Daten: noch nichts, API (auch eine verbindliche
 * Ablehnung wie 403 für `pending`) oder Offline-Cache (vorläufig oder Ersatz).
 * `cache` nur, wenn tatsächlich Daten aus dem Cache gelesen wurden.
 */
export type DataSource = "none" | "api" | "cache";

/**
 * Ergebnis von `appendRecipe`:
 * - `created`: vom Backend angelegt (`detail.id` ist die Backend-ID)
 * - `local`: nur auf diesem Gerät gespeichert (offline, Timeout, 5xx); wird
 *   nicht nachträglich hochgeladen
 * - `failed`: vom Backend abgelehnt (4xx, z. B. fehlende Rolle, 422), nicht
 *   gespeichert
 */
export type AppendResult =
  | { status: "created"; detail: RecipeDetail }
  | { status: "local" }
  | { status: "failed"; error: unknown };

const default_settings: Settings = {
  read_only: true,
  expert_mode: false,
  role: "readonly",
};

// Single-Flight für loadAll(): Anfragen während eines Laufs lösen genau einen
// weiteren Lauf aus, falls der laufende keine API-Daten geliefert hat.
let loadAllInFlight: Promise<void> | null = null;
let loadAllRerun = false;

// Angelegte Rezepte gegen parallel laufende Listenabrufe: Eine Liste, deren
// Abruf vor dem Anlegen begann, enthält das neue Rezept nicht. `listSeq` zählt
// die Abrufe; ein angelegtes Rezept bleibt vorgemerkt, bis ein danach
// gestarteter Abruf fertig ist.
let listSeq = 0;
let appliedListSeq = 0;
let createdPending: { seq: number; recipe: Recipe }[] = [];

export const useRecipeStore = defineStore("recipe", {
  state: () => ({
    recipes: [] as Recipe[],
    settings: { ...default_settings } as Settings,
    recipe_pictures: {} as RecipePictures,
    favorites: [] as string[],
    dataSource: "none" as DataSource,
  }),

  actions: {
    // --- Laden (Start, Login, Token-Erneuerung, wieder online) ---

    /**
     * Lädt Settings, Rezepte und Favoriten. Beim ersten Laden zeigt der
     * Cache sofort vorläufige Daten (Quelle „cache“). Nach geklärtem
     * Auth-Zustand: gültig → API (Cache nur bei Ausfall, nicht bei 4xx),
     * offline → Cache, abgelehnt → Login folgt (ohne Netz: Cache). Quelle
     * `cache` nur mit tatsächlich gelesenen Cache-Daten, sonst `none`.
     */
    loadAll(): Promise<void> {
      if (loadAllInFlight) {
        loadAllRerun = true;
        return loadAllInFlight;
      }
      loadAllInFlight = (async () => {
        try {
          do {
            loadAllRerun = false;
            await this.loadAllOnce();
          } while (loadAllRerun && this.dataSource !== "api");
        } finally {
          loadAllInFlight = null;
          loadAllRerun = false;
        }
      })();
      return loadAllInFlight;
    },

    /** Lädt neu, wenn die Daten (noch) nicht von der API stammen. */
    async reloadIfStale(): Promise<void> {
      if (this.dataSource === "api") return;
      await this.loadAll();
    },

    async loadAllOnce() {
      // Vorläufige Daten, damit bei hängender Verbindung nicht bis zum
      // Timeout eine leere Liste steht. Läuft parallel zur Auth-Klärung.
      const preliminary =
        this.dataSource === "none" ? this.showCachedData() : undefined;
      const auth = await ensureAuth();
      await preliminary;
      if (loginFollows(auth)) {
        // Login folgt (Guard bzw. onRejected): kein Offline-Banner.
        if (this.dataSource === "cache") this.dataSource = "none";
        return;
      }
      const useApi = auth === "valid";
      const sources = await Promise.all([
        this.loadSettings(useApi),
        this.loadRecipes(useApi),
        this.loadFavorites(useApi),
      ]);
      this.dataSource = sources.every((s) => s === "api")
        ? "api"
        : sources.includes("cache")
          ? "cache"
          : "none";
    },

    /** Zeigt vorhandene Cache-Daten als vorläufigen Stand. */
    async showCachedData() {
      const [settings, recipes, favorites] = await Promise.all([
        readSettings(),
        readRecipes(),
        readFavorites(),
      ]);
      if (!settings && !recipes && !favorites) return;
      // Nur übernehmen, solange nichts Verbindliches geladen ist
      if (this.dataSource !== "none") return;
      if (settings) this.settings = settings;
      if (recipes) this.recipes = recipes;
      if (favorites) this.favorites = favorites;
      this.dataSource = "cache";
    },

    // --- Settings ---
    async loadSettings(useApi: boolean): Promise<DataSource> {
      if (useApi) {
        try {
          const settings = await api.get<Settings>("/me/settings");
          this.settings = settings;
          void writeSettings(settings);
          return "api";
        } catch (e) {
          if (isClientError(e)) {
            // verbindliche Ablehnung: Standardwerte statt Cache
            this.settings = { ...default_settings };
            return "api";
          }
          console.warn(
            "Failed to load settings from API, falling back to IDB",
            e,
          );
        }
      }
      const val = await readSettings();
      if (!val) return "none";
      this.settings = val;
      return "cache";
    },

    async saveSettings(settings: Settings) {
      this.settings = deepCopyJSON(settings);
      if (await isAuthenticated()) {
        try {
          const updated = await api.put<Settings>("/me/settings", {
            read_only: settings.read_only,
            expert_mode: settings.expert_mode,
          });
          this.settings = updated;
          void writeSettings(updated);
          return;
        } catch (e) {
          console.warn("Failed to save settings to API", e);
        }
      }
      void writeSettings(deepCopyJSON(settings));
    },

    // --- Recipes ---
    async loadRecipes(useApi: boolean): Promise<DataSource> {
      if (useApi) {
        try {
          await this.loadRecipesFromApi();
          return "api";
        } catch (e) {
          if (isClientError(e)) {
            // z. B. 403 für `pending`: verbindlich keine Rezepte, kein Cache
            this.recipes = [];
            return "api";
          }
          console.warn("API load failed, falling back to IDB", e);
        }
      }

      console.warn("Read recipes from idb");
      const val = await readRecipes();
      if (val) {
        this.recipes = val;
        return "cache";
      }
      console.warn("Fallback to localstorage");
      let recipes: Recipe[];
      let source: DataSource;
      const recipesStr = localStorage.getItem("recipes");

      if (recipesStr) {
        recipes = loadYamlCookbook(recipesStr);
        localStorage.removeItem("recipes");
        source = "cache";
      } else {
        // Das Beispielrezept sind keine gelesenen Daten
        console.warn("Fallback to sample");
        recipes = [loadSample()];
        source = "none";
      }

      void writeRecipes(recipes);
      this.recipes = recipes;
      return source;
    },

    saveRecipes() {
      const saved = deepCopyJSON(this.recipes);
      writeRecipes(saved).then(() => {
        this.recipes = [...this.recipes]; // trigger reactivity
      });
    },

    async deleteRecipe(idOrIndex: string | number) {
      let index: number;
      let uuid: string | undefined;
      if (typeof idOrIndex === "string") {
        index = this.recipes.findIndex((r) => r.recipe_uuid === idOrIndex);
        uuid = idOrIndex;
      } else {
        index = idOrIndex;
        uuid = this.recipes[index]?.recipe_uuid;
      }
      if (index < 0) return;
      this.recipes.splice(index, 1);
      if ((await isAuthenticated()) && uuid) {
        try {
          await recipeApi.delete(uuid);
        } catch (e) {
          console.warn("Failed to delete recipe via API", e);
        }
      }
      this.saveRecipes();
    },

    /**
     * Legt ein Rezept an, Ergebnis siehe `AppendResult`. Nach dem Anlegen
     * kommt das Rezept aus der Antwort direkt in die Liste (kein Neuladen,
     * das scheitern und ein Duplikat erzeugen könnte). Nur Ausfälle (offline,
     * Timeout, 5xx) speichern lokal; eine Ablehnung (4xx) speichert nichts,
     * weil lokale Rezepte nie zum Backend übertragen werden.
     */
    async appendRecipe(recipe: Recipe): Promise<AppendResult> {
      const recipeCopy = deepCopyJSON(recipe);
      if (await isAuthenticated()) {
        const {
          recipe_uuid: _uuid,
          recipe_name,
          lastUpdated: _updated,
          first_image_id: _fii,
          ingredients,
          steps,
          sections,
          tags,
          ...rest
        } = recipeCopy;
        let detail: RecipeDetail | undefined;
        try {
          detail = await recipeApi.create({
            recipe_name,
            data: { ingredients, steps, sections, ...rest },
            tags: tags || [],
          });
        } catch (e) {
          if (isClientError(e)) {
            console.warn("Recipe rejected by API, not saved", e);
            return { status: "failed", error: e };
          }
          console.warn("Failed to create recipe via API, saving locally", e);
        }
        if (detail) {
          this.insertCreated(detailToRecipe(detail));
          return { status: "created", detail };
        }
      }
      this.recipes.push(recipeCopy);
      this.saveRecipes();
      return { status: "local" };
    },

    /** Vom Backend angelegtes Rezept in Liste und Cache übernehmen. */
    insertCreated(recipe: Recipe) {
      void writeRecipeDetail(recipe);
      createdPending.push({ seq: listSeq, recipe });
      if (!this.recipes.some((r) => r.recipe_uuid === recipe.recipe_uuid)) {
        this.recipes.push(recipe);
      }
      this.saveRecipes();
    },

    async setRecipe({ index, recipe }: { index: number; recipe: Recipe }) {
      const recipeCopy = deepCopyJSON(recipe);
      this.recipes.splice(index, 1, recipeCopy);
      if ((await isAuthenticated()) && recipeCopy.recipe_uuid) {
        try {
          const {
            recipe_uuid,
            recipe_name,
            lastUpdated: _updated,
            first_image_id: _fii,
            ingredients,
            steps,
            sections,
            tags,
            ...rest
          } = recipeCopy;
          await recipeApi.update(recipe_uuid, {
            recipe_name,
            data: { ingredients, steps, sections, ...rest },
            tags: tags || [],
          });
          void writeRecipeDetail(recipeCopy);
        } catch (e) {
          console.warn("Failed to update recipe via API", e);
        }
      }
      this.saveRecipes();
    },

    // --- Recipe Pictures ---
    loadRecipePictures() {
      console.warn("Read recipe pictures from idb");
      get("recipe_pictures").then((val: unknown) => {
        if (val) {
          this.recipe_pictures = deserializeRecipePictures(
            val as SerializedRecipePictures,
          );
        }
      });
    },

    async saveRecipePictures() {
      const serialized = await serializeRecipePictures(this.recipe_pictures);
      set("recipe_pictures", serialized);
    },

    async setRecipePicture({
      uuid,
      picture,
    }: {
      uuid: string;
      picture: File | null;
    }) {
      if (picture && (await isAuthenticated())) {
        try {
          // Vorhandene Fotos ersetzen; Vorlagen (kind=source) bleiben
          const existing = await imageApi.list(uuid, "photo");
          for (const img of existing) {
            await imageApi.delete(uuid, img.id);
          }
          const uploaded = await imageApi.upload(uuid, picture);
          // Update first_image_id in store so the UI shows the new image
          const recipe = this.recipes.find((r) => r.recipe_uuid === uuid);
          if (recipe) {
            recipe.first_image_id = uploaded.id;
          }
          return;
        } catch (e) {
          console.warn("Failed to upload image to API, saving locally", e);
        }
      }
      if (!picture && (await isAuthenticated())) {
        try {
          const images = await imageApi.list(uuid, "photo");
          for (const img of images) {
            await imageApi.delete(uuid, img.id);
          }
          // Clear first_image_id in store
          const recipe = this.recipes.find((r) => r.recipe_uuid === uuid);
          if (recipe) {
            recipe.first_image_id = undefined;
          }
          return;
        } catch (e) {
          console.warn("Failed to delete images via API", e);
        }
      }
      this.recipe_pictures[uuid] = picture ? [picture] : [];
      this.saveRecipePictures();
    },

    // --- Favorites ---
    async loadFavorites(useApi: boolean): Promise<DataSource> {
      if (useApi) {
        try {
          const favorites = await favoritesApi.list();
          this.favorites = favorites;
          void writeFavorites(favorites);
          return "api";
        } catch (e) {
          if (isClientError(e)) {
            this.favorites = [];
            return "api";
          }
          console.warn(
            "Failed to load favorites from API, falling back to IDB",
            e,
          );
        }
      }
      const val = await readFavorites();
      if (!val) return "none";
      this.favorites = val;
      return "cache";
    },

    async addFavorite(uuid: string) {
      if (!this.favorites.includes(uuid)) {
        this.favorites.push(uuid);
      }
      if (await isAuthenticated()) {
        try {
          await favoritesApi.add(uuid);
        } catch (e) {
          console.warn("Failed to add favorite via API", e);
        }
      }
      const favorites = [...((await readFavorites()) || [])];
      if (!favorites.includes(uuid)) favorites.push(uuid);
      void writeFavorites(favorites);
    },

    async removeFavorite(uuid: string) {
      const idx = this.favorites.indexOf(uuid);
      if (idx > -1) {
        this.favorites.splice(idx, 1);
      }
      if (await isAuthenticated()) {
        try {
          await favoritesApi.remove(uuid);
        } catch (e) {
          console.warn("Failed to remove favorite via API", e);
        }
      }
      const favorites = ((await readFavorites()) || []).filter(
        (id: string) => id !== uuid,
      );
      void writeFavorites(favorites);
    },

    // --- API-backed actions ---
    async loadRecipesFromApi() {
      const seq = ++listSeq;
      const items = await recipeApi.listAll();
      // Eine neuere Antwort ist schon übernommen: diese ist veraltet.
      if (seq < appliedListSeq) return;
      appliedListSeq = seq;
      const recipes = items.map(listItemToRecipe);
      // Vor diesem Abruf angelegte Rezepte sind in der Antwort enthalten;
      // während des Abrufs angelegte fehlen womöglich und bleiben erhalten.
      createdPending = createdPending.filter((c) => c.seq >= seq);
      for (const { recipe } of createdPending) {
        if (!recipes.some((r) => r.recipe_uuid === recipe.recipe_uuid)) {
          recipes.push(recipe);
        }
      }
      this.recipes = recipes;
      void writeRecipes(deepCopyJSON(recipes));
      this.prefetchRecipeDetails(recipes);
    },

    async loadRecipeDetailFromApi(id: string) {
      const recipe = detailToRecipe(await recipeApi.get(id));
      void writeRecipeDetail(recipe);
      return recipe;
    },

    async prefetchRecipeDetails(recipes: Recipe[]) {
      let fetched = 0;
      const batchSize = 5;
      for (let i = 0; i < recipes.length; i += batchSize) {
        const batch = recipes.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map(async (r) => {
            try {
              const cached = await readRecipeDetail(r.recipe_uuid);
              const isComplete = cached?.ingredients?.some(
                (i) => i.amounts?.length > 0,
              );
              if (
                cached &&
                cached.lastUpdated === r.lastUpdated &&
                isComplete
              ) {
                fetched++;
                return;
              }
              const full = detailToRecipe(await recipeApi.get(r.recipe_uuid));
              await writeRecipeDetail(full);
              fetched++;
            } catch {
              // Best-effort — skip on error
            }
          }),
        );
      }
      console.warn(
        `Prefetched ${fetched}/${recipes.length} recipe details for offline use`,
      );
    },
  },
});
