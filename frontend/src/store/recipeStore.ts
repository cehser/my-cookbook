import { defineStore } from "pinia";
import { set, get } from "idb-keyval";
import { loadYamlCookbook, loadSample } from "@/js/recipes";
import { deepCopyJSON, deepCopyYaml } from "@/js/deepCopy";
import {
  serializeRecipePictures,
  deserializeRecipePictures,
  type SerializedRecipePictures,
} from "@/js/fileStorage";
import { recipeApi } from "@/api/recipes";
import { imageApi } from "@/api/images";
import { isAuthenticated } from "@/auth/oidc";
import type { Recipe, RecipePictures } from "@/types/recipe";
import type { Settings } from "@/types/settings";

const default_settings: Settings = {
  read_only: true,
  expert_mode: false,
  gpt_model: "gpt-4o-mini",
  role: "readonly",
};

export const useRecipeStore = defineStore("recipe", {
  state: () => ({
    recipes: [] as Recipe[],
    settings: { ...default_settings } as Settings,
    recipe_pictures: {} as RecipePictures,
    favorites: [] as string[],
  }),

  actions: {
    // --- Settings ---
    async loadSettings() {
      if (await isAuthenticated()) {
        try {
          const { api } = await import("@/api/client");
          const settings = await api.get<Settings>("/me/settings");
          this.settings = settings;
          set("settings", settings);
          return;
        } catch (e) {
          console.warn(
            "Failed to load settings from API, falling back to IDB",
            e,
          );
        }
      }
      const val: Settings | undefined = await get("settings");
      if (val) {
        this.settings = val;
      }
    },

    async saveSettings(settings: Settings) {
      this.settings = settings;
      if (await isAuthenticated()) {
        try {
          const { api } = await import("@/api/client");
          const updated = await api.put<Settings>("/me/settings", {
            read_only: settings.read_only,
            expert_mode: settings.expert_mode,
            gpt_model: settings.gpt_model,
          });
          this.settings = updated;
          set("settings", updated);
          return;
        } catch (e) {
          console.warn("Failed to save settings to API", e);
        }
      }
      set("settings", deepCopyJSON(settings));
    },

    // --- Recipes ---
    async loadRecipes() {
      if (await isAuthenticated()) {
        console.warn("Authenticated – loading recipes from API");
        try {
          await this.loadRecipesFromApi();
          return;
        } catch (e) {
          console.warn("API load failed, falling back to IDB", e);
        }
      }

      console.warn("Read recipes from idb");
      get("recipes").then((val: Recipe[] | undefined) => {
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

          set("recipes", recipes);
          this.recipes = recipes;
        }
      });
    },

    saveRecipes() {
      const saved = deepCopyYaml(this.recipes);
      set("recipes", saved).then(() => {
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
          set(`recipe:${recipe_uuid}`, recipeCopy);
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
          this.recipe_pictures = deserializeRecipePictures(val as SerializedRecipePictures);
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
          await imageApi.upload(uuid, picture);
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
          return;
        } catch (e) {
          console.warn("Failed to delete images via API", e);
        }
      }
      this.recipe_pictures[uuid] = picture ? [picture] : [];
      this.saveRecipePictures();
    },

    // --- Favorites ---
    async loadFavorites() {
      if (await isAuthenticated()) {
        try {
          const { favoritesApi } = await import("@/api/favorites");
          const favorites = await favoritesApi.list();
          this.favorites = favorites;
          set("favorites", favorites);
          return;
        } catch (e) {
          console.warn(
            "Failed to load favorites from API, falling back to IDB",
            e,
          );
        }
      }
      const val: string[] | undefined = await get("favorites");
      if (val) {
        this.favorites = val;
      }
    },

    async addFavorite(uuid: string) {
      if (!this.favorites.includes(uuid)) {
        this.favorites.push(uuid);
      }
      if (await isAuthenticated()) {
        try {
          const { favoritesApi } = await import("@/api/favorites");
          await favoritesApi.add(uuid);
        } catch (e) {
          console.warn("Failed to add favorite via API", e);
        }
      }
      const favorites = [...(((await get("favorites")) as string[]) || [])];
      if (!favorites.includes(uuid)) favorites.push(uuid);
      set("favorites", favorites);
    },

    async removeFavorite(uuid: string) {
      const idx = this.favorites.indexOf(uuid);
      if (idx > -1) {
        this.favorites.splice(idx, 1);
      }
      if (await isAuthenticated()) {
        try {
          const { favoritesApi } = await import("@/api/favorites");
          await favoritesApi.remove(uuid);
        } catch (e) {
          console.warn("Failed to remove favorite via API", e);
        }
      }
      const favorites = (((await get("favorites")) as string[]) || []).filter(
        (id: string) => id !== uuid,
      );
      set("favorites", favorites);
    },

    // --- API-backed actions ---
    async loadRecipesFromApi() {
      const res = await recipeApi.list({ page_size: 200 });
      const recipes: Recipe[] = res.items.map((item) => ({
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
      }));
      this.recipes = recipes;
      set("recipes", deepCopyYaml(recipes));
      this.prefetchRecipeDetails(recipes);
    },

    async loadRecipeDetailFromApi(id: string) {
      const detail = await recipeApi.get(id);
      const recipe: Recipe = {
        recipe_uuid: detail.id,
        recipe_name: detail.recipe_name,
        lastUpdated: detail.updated_at,
        first_image_id: detail.first_image_id ?? undefined,
        ingredients: [],
        steps: [],
        sections: [],
        tags: detail.tags,
        ...(detail.data as Record<string, unknown>),
      };
      set(`recipe:${recipe.recipe_uuid}`, recipe);
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
              const cached: Recipe | undefined = await get(
                `recipe:${r.recipe_uuid}`,
              );
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
              const detail = await recipeApi.get(r.recipe_uuid);
              const full: Recipe = {
                recipe_uuid: detail.id,
                recipe_name: detail.recipe_name,
                lastUpdated: detail.updated_at,
                first_image_id: detail.first_image_id ?? undefined,
                ingredients: [],
                steps: [],
                sections: [],
                tags: detail.tags,
                ...(detail.data as Record<string, unknown>),
              };
              set(`recipe:${full.recipe_uuid}`, full);
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
      const res = await recipeApi.list({ q: query, page_size: 200 });
      const recipes: Recipe[] = res.items.map((item) => ({
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
      }));
      return recipes;
    },
  },
});
