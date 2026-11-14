import { defineStore } from "pinia";
import { set, get } from "idb-keyval";
import { loadYamlCookbook, loadSample } from "@/js/recipes";
import { deepCopyJSON, deepCopyYaml } from "@/js/deepCopy";
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
import {
  recipeApi,
  type RecipeDetail,
  type RecipeListItem,
} from "@/api/recipes";
import { favoritesApi } from "@/api/favorites";
import { imageApi } from "@/api/images";
import { ensureAuth, isAuthenticated } from "@/auth/oidc";
import type { Recipe, RecipePictures } from "@/types/recipe";
import type { Settings } from "@/types/settings";

/**
 * Herkunft der geladenen Daten: noch nichts, API (auch eine verbindliche
 * Ablehnung wie 403 für `pending`) oder Offline-Cache (vorläufig oder Ersatz).
 */
export type DataSource = "none" | "api" | "cache";

const default_settings: Settings = {
  read_only: true,
  expert_mode: false,
  gpt_model: "gpt-4o-mini",
  role: "readonly",
};

const LIST_PAGE_SIZE = 200; // Maximum des Backends

/** Lädt alle Seiten der Rezeptliste, optional gefiltert per Volltextsuche. */
async function fetchAllRecipeListItems(q?: string): Promise<RecipeListItem[]> {
  const items: RecipeListItem[] = [];
  const seen = new Set<string>();
  for (let page = 1; ; page++) {
    const res = await recipeApi.list({ q, page, page_size: LIST_PAGE_SIZE });
    for (const item of res.items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        items.push(item);
      }
    }
    const lastPage =
      res.items.length < LIST_PAGE_SIZE || page * LIST_PAGE_SIZE >= res.total;
    if (lastPage) return items;
  }
}

function listItemToRecipe(item: RecipeListItem): Recipe {
  return {
    recipe_uuid: item.id,
    recipe_name: item.recipe_name,
    author: item.author ?? undefined,
    subtitle: item.subtitle ?? undefined,
    tags: item.tags,
    imageurl: item.imageurl ?? undefined,
    first_image_id: item.first_image_id ?? undefined,
    lastUpdated: item.updated_at,
    ingredients: [],
    steps: [],
    sections: [],
  };
}

function detailToRecipe(detail: RecipeDetail): Recipe {
  const { first_image_id: _fii, ...data } = (detail.data ?? {}) as Record<
    string,
    unknown
  >;
  return {
    recipe_uuid: detail.id,
    recipe_name: detail.recipe_name,
    lastUpdated: detail.updated_at,
    ingredients: [],
    steps: [],
    sections: [],
    tags: detail.tags,
    ...data,
    first_image_id: detail.first_image_id ?? undefined,
  };
}

// Single-Flight für loadAll(): Anfragen während eines Laufs lösen genau einen
// weiteren Lauf aus, falls der laufende keine API-Daten geliefert hat.
let loadAllInFlight: Promise<void> | null = null;
let loadAllRerun = false;

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
     * offline → Cache, abgelehnt → Login folgt (ohne Netz: Cache).
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
      if (auth === "rejected" && navigator.onLine) {
        // Login folgt (Guard bzw. onSessionRejected): kein Offline-Banner.
        if (this.dataSource === "cache") this.dataSource = "none";
        return;
      }
      const useApi = auth === "valid";
      const sources = await Promise.all([
        this.loadSettings(useApi),
        this.loadRecipes(useApi),
        this.loadFavorites(useApi),
      ]);
      this.dataSource = sources.every((s) => s === "api") ? "api" : "cache";
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
      if (val) {
        this.settings = val;
      }
      return "cache";
    },

    async saveSettings(settings: Settings) {
      this.settings = settings;
      if (await isAuthenticated()) {
        try {
          const updated = await api.put<Settings>("/me/settings", {
            read_only: settings.read_only,
            expert_mode: settings.expert_mode,
            gpt_model: settings.gpt_model,
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
      } else {
        console.warn("Fallback to localstorage");
        let recipes: Recipe[];
        const recipesStr = localStorage.getItem("recipes");

        if (recipesStr) {
          recipes = loadYamlCookbook(recipesStr);
          localStorage.removeItem("recipes");
        } else {
          console.warn("Fallback to sample");
          recipes = [loadSample()];
        }

        void writeRecipes(recipes);
        this.recipes = recipes;
      }
      return "cache";
    },

    saveRecipes() {
      const saved = deepCopyYaml(this.recipes);
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

    async appendRecipe(recipe: Recipe) {
      const recipeCopy = deepCopyYaml(recipe);
      if (await isAuthenticated()) {
        try {
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
          const detail = await recipeApi.create({
            recipe_name,
            data: { ingredients, steps, sections, ...rest },
            tags: tags || [],
          });
          await this.loadRecipesFromApi();
          return detail;
        } catch (e) {
          console.warn("Failed to create recipe via API, saving locally", e);
        }
      }
      this.recipes.push(recipeCopy);
      this.saveRecipes();
    },

    async setRecipe({ index, recipe }: { index: number; recipe: Recipe }) {
      const recipeCopy = deepCopyYaml(recipe);
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
          // Delete existing images before uploading the new one
          const existing = await imageApi.list(uuid);
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
          const images = await imageApi.list(uuid);
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
      if (val) {
        this.favorites = val;
      }
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
      const items = await fetchAllRecipeListItems();
      const recipes = items.map(listItemToRecipe);
      this.recipes = recipes;
      void writeRecipes(deepCopyYaml(recipes));
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

    async searchRecipesApi(query: string) {
      const items = await fetchAllRecipeListItems(query);
      return items.map(listItemToRecipe);
    },
  },
});
