import { defineStore } from "pinia";
import { set, get } from "idb-keyval";
import { loadYamlCookbook, loadSample } from "@/js/recipes";
import { deepCopyJSON } from "@/js/deepCopy";
import {
  detailToRecipe,
  IncompleteRecipeError,
  listItemToRecipe,
  looksLikeListRow,
  recipeToPayload,
  withoutListOnly,
} from "@/js/recipeMapping";
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
import { api, ApiError, isClientError } from "@/api/client";
import { recipeApi, type RecipeDetail } from "@/api/recipes";
import { favoritesApi } from "@/api/favorites";
import { imageApi } from "@/api/images";
import { canDeleteRecipe, canEdit } from "@/auth/role";
import {
  currentUserSub,
  ensureAuth,
  isAuthenticated,
  loginFollows,
} from "@/auth/session";
import {
  addPending,
  createWithClientId,
  deleteOnServer,
  listPending,
  LocalReadError,
  markDeleted,
  readPending,
  transferPending,
  type TransferReport,
} from "@/store/pendingCreates";
import { saveChange, sessionError, type SaveResult } from "@/store/saveRecipe";
import {
  markListRows,
  mergeFetched,
  noteCreated,
  noteDeleted,
  startListFetch,
  withPending,
} from "@/store/listSync";
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
 * - `created`: vom Backend angelegt (`detail.id` ist die Backend-ID); mit
 *   `updateError`: angelegt, aber die letzte Änderung abgelehnt
 * - `local`: auf diesem Gerät vorgemerkt (offline, Timeout, 5xx); wird beim
 *   nächsten Laden mit gültiger Sitzung übertragen (`store/pendingCreates.ts`)
 * - `failed`: vom Backend abgelehnt (4xx, z. B. fehlende Rolle, 422),
 *   Sitzung abgelaufen (401, Login folgt), ohne angemeldeten Nutzer
 *   (`NotSignedInError`), Vormerkung nicht speicherbar
 *   (`LocalSaveError`) oder nur eine Listenzeile (`IncompleteRecipeError`);
 *   nicht gespeichert
 */
export type AppendResult =
  | { status: "created"; detail: RecipeDetail; updateError?: unknown }
  | { status: "local" }
  | { status: "failed"; error: unknown };

/**
 * Ergebnis von `deleteRecipe`. `failed`: Das Rezept bleibt in der Liste
 * (`ApiError`, `OfflineError`, Netzfehler, `LocalReadError`).
 */
export type DeleteResult =
  { status: "deleted" } | { status: "failed"; error: unknown };

// Bis die Rolle feststeht: keine Bearbeiten-Elemente (sicherer Vorgabewert)
const default_settings: Settings = {
  role: "readonly",
};

// Single-Flight für loadAll(): Anfragen während eines Laufs lösen genau einen
// weiteren Lauf aus, falls der laufende keine API-Daten geliefert hat.
let loadAllInFlight: Promise<void> | null = null;
let loadAllRerun = false;

/** Login folgt: nichts speichern, der Aufrufer meldet „Bitte neu anmelden“. */
function sessionExpired(): AppendResult {
  return { status: "failed", error: new ApiError(401, "Sitzung abgelaufen") };
}

export const useRecipeStore = defineStore("recipe", {
  state: () => ({
    recipes: [] as Recipe[],
    settings: { ...default_settings } as Settings,
    recipe_pictures: {} as RecipePictures,
    favorites: [] as string[],
    dataSource: "none" as DataSource,
    /** Ergebnis der letzten Übertragung vorgemerkter Rezepte (für Toasts) */
    transferReport: null as TransferReport | null,
    /** IDs der vorgemerkten (nur auf diesem Gerät gespeicherten) Rezepte */
    pendingIds: [] as string[],
    /** Davon vom Server abgelehnt (bis zur nächsten Bearbeitung) */
    rejectedIds: [] as string[],
    /** `sub` der Sitzung (auch abgelaufen), für Rechte in der Oberfläche */
    userSub: null as string | null,
  }),

  getters: {
    /**
     * Bearbeiten-Elemente zeigen? Allein aus der Rolle (`settings.role`, von
     * `/me/settings`, offline aus dem Cache). Regel in `auth/role.ts`.
     */
    canEdit: (state): boolean => canEdit(state.settings.role),
    /** Lösch-Knopf zeigen? Regel in `auth/role.ts` (wie im Backend). */
    canDelete:
      (state) =>
      (recipe: Recipe): boolean =>
        canDeleteRecipe({
          role: state.settings.role,
          sub: state.userSub,
          createdBy: recipe.created_by,
          pending: state.pendingIds.includes(recipe.recipe_uuid),
        }),
    /** Kennzeichnung „nur auf diesem Gerät“ bzw. „abgelehnt“ an der Karte */
    localStatus:
      (state) =>
      (uuid: string): "pending" | "rejected" | null =>
        state.rejectedIds.includes(uuid)
          ? "rejected"
          : state.pendingIds.includes(uuid)
            ? "pending"
            : null,
  },

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
      if (this.dataSource !== "api") return this.loadAll();
      // Daten aktuell, aber vielleicht noch Vorgemerktes (z. B. nach 5xx)
      if (await isAuthenticated()) await this.transferPending();
    },

    /** Vorgemerkte Rezepte übertragen (nur mit gültiger Sitzung aufrufen). */
    async transferPending(): Promise<void> {
      const report = await transferPending({
        onCreated: (detail) => this.insertCreated(detailToRecipe(detail)),
      });
      // Parallele Aufrufer teilen den Lauf und damit dasselbe Objekt: Die
      // zweite Zuweisung ändert nichts, der Toast erscheint einmal.
      if (report.transferred > 0 || report.rejected.length > 0) {
        this.transferReport = report;
      }
      // Ablehnungen kennzeichnen (die Vormerkung kennt die IDs)
      if (report.rejected.length > 0) this.notePending(await listPending());
    },

    async loadAllOnce() {
      // Vorläufige Daten, damit bei hängender Verbindung nicht bis zum
      // Timeout eine leere Liste steht. Läuft parallel zur Auth-Klärung.
      const preliminary =
        this.dataSource === "none" ? this.showCachedData() : undefined;
      const auth = await ensureAuth();
      await preliminary;
      this.userSub = await currentUserSub().catch(() => null);
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
      if (useApi && sources[1] === "api") await this.transferPending();
    },

    /** Zeigt vorhandene Cache-Daten als vorläufigen Stand. */
    async showCachedData() {
      const [settings, recipes, favorites, pending] = await Promise.all([
        readSettings(),
        readRecipes(),
        readFavorites(),
        listPending(),
      ]);
      if (!settings && !recipes && !favorites) return;
      // Nur übernehmen, solange nichts Verbindliches geladen ist
      if (this.dataSource !== "none") return;
      if (settings) this.settings = settings;
      if (recipes) this.recipes = markListRows(recipes, pending);
      if (favorites) this.favorites = favorites;
      this.dataSource = "cache";
    },

    // --- Settings ---
    async loadSettings(useApi: boolean): Promise<DataSource> {
      if (useApi) {
        try {
          // Nur die Rolle übernehmen; Altfelder der Antwort nicht cachen
          const { role } = await api.get<Settings>("/me/settings");
          const settings: Settings = { role };
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
        const pending = await listPending();
        this.recipes = this.withPendingIds(markListRows(val, pending), pending);
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

      recipes = this.withPendingIds(recipes, await listPending());
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

    /** Vorgemerkte Rezepte übernehmen und ihre IDs merken. */
    withPendingIds(
      recipes: Recipe[],
      pending: readonly { recipe: Recipe; rejected?: number }[],
    ): Recipe[] {
      this.notePending(pending);
      return withPending(recipes, pending);
    },

    /** IDs der vorgemerkten und der abgelehnten Rezepte merken. */
    notePending(pending: readonly { recipe: Recipe; rejected?: number }[]) {
      this.pendingIds = pending.map((e) => e.recipe.recipe_uuid);
      this.rejectedIds = pending
        .filter((e) => e.rejected !== undefined)
        .map((e) => e.recipe.recipe_uuid);
    },

    /**
     * Löscht ein Rezept, Ergebnis siehe `DeleteResult`. Aus der Liste
     * verschwindet es erst nach Erfolg; scheitert das Löschen, bleibt es und
     * der Aufrufer meldet den Fehler. Unbekannter Index bzw. ID: `failed`.
     * - vorgemerkt: Löschung vormerken (`markDeleted`), mit gültiger Sitzung
     *   sofort `DELETE` (eine Übertragung kann es schon angelegt haben);
     *   scheitert es, wiederholt die nächste Übertragung
     * - Vormerkung nicht lesbar: bei einem bekannt vorgemerkten Rezept
     *   Fehler, sonst wie nicht vorgemerkt
     * - sonst `DELETE` nur mit gültiger Sitzung (offline nicht möglich,
     *   12.1); 404 gilt als gelöscht
     */
    async deleteRecipe(idOrIndex: string | number): Promise<DeleteResult> {
      const uuid =
        typeof idOrIndex === "string"
          ? idOrIndex
          : this.recipes[idOrIndex]?.recipe_uuid;
      if (!uuid) {
        return { status: "failed", error: new Error("Rezept nicht gefunden") };
      }

      let wasPending: "none" | "removed" | "marked";
      try {
        wasPending = await markDeleted(uuid);
      } catch (e) {
        // Ohne lesbare Vormerkung wüsste die API nichts von dem Rezept
        if (this.pendingIds.includes(uuid)) {
          return { status: "failed", error: new LocalReadError(e) };
        }
        wasPending = "none";
      }
      if (wasPending !== "none") {
        this.forgetRecipe(uuid);
        if (wasPending === "marked" && (await isAuthenticated())) {
          await deleteOnServer(uuid);
        }
        return { status: "deleted" };
      }

      const auth = await ensureAuth();
      if (auth !== "valid")
        return { status: "failed", error: sessionError(auth) };
      try {
        await recipeApi.delete(uuid);
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) {
          console.warn("Failed to delete recipe via API", e);
          return { status: "failed", error: e };
        }
      }
      this.forgetRecipe(uuid);
      return { status: "deleted" };
    },

    /** Gelöschtes Rezept aus Liste, Vormerk-IDs und Listen-Abgleich tilgen. */
    forgetRecipe(uuid: string) {
      noteDeleted(uuid);
      this.pendingIds = this.pendingIds.filter((id) => id !== uuid);
      this.rejectedIds = this.rejectedIds.filter((id) => id !== uuid);
      const index = this.recipes.findIndex((r) => r.recipe_uuid === uuid);
      if (index >= 0) this.recipes.splice(index, 1);
      this.saveRecipes();
    },

    /**
     * Legt ein Rezept mit seiner `recipe_uuid` als Backend-ID an, Ergebnis
     * siehe `AppendResult`. Nach dem Anlegen kommt das Rezept aus der Antwort
     * direkt in die Liste (kein Neuladen). Nur Ausfälle (offline, Timeout,
     * 5xx) merken das Rezept zur Übertragung vor; eine Ablehnung (4xx) oder
     * eine abgelaufene Sitzung (Login folgt) speichert nichts.
     */
    async appendRecipe(recipe: Recipe): Promise<AppendResult> {
      // Kopie einer Listenzeile (Duplizieren, Export) wäre ein leeres Rezept
      if (recipe.listOnly) {
        return { status: "failed", error: new IncompleteRecipeError() };
      }
      const recipeCopy = deepCopyJSON(recipe);
      // Ersteller setzt das Backend (Duplikat, Import: nicht übernehmen)
      delete recipeCopy.created_by;
      const auth = await ensureAuth();
      if (loginFollows(auth)) return sessionExpired();
      if (auth === "valid") {
        try {
          const outcome = await createWithClientId(recipeCopy);
          if (outcome.status === "rejected") {
            console.warn("Recipe rejected by API, not saved", outcome.error);
            return { status: "failed", error: outcome.error };
          }
          this.insertCreated(detailToRecipe(outcome.detail));
          return outcome;
        } catch (e) {
          // 401 nach gescheiterter Erneuerung: neu anmelden statt vormerken
          if (
            e instanceof ApiError &&
            e.status === 401 &&
            loginFollows(await ensureAuth())
          ) {
            return sessionExpired();
          }
          console.warn("Failed to create recipe via API, saving locally", e);
        }
      }
      try {
        await addPending(recipeCopy);
      } catch (e) {
        // Ohne Nutzer oder IndexedDB gescheitert: nicht als „gespeichert“
        return { status: "failed", error: e };
      }
      if (!this.pendingIds.includes(recipeCopy.recipe_uuid)) {
        this.pendingIds.push(recipeCopy.recipe_uuid);
      }
      if (!this.recipes.some((r) => r.recipe_uuid === recipeCopy.recipe_uuid)) {
        this.recipes.push(recipeCopy);
      }
      this.saveRecipes();
      return { status: "local" };
    },

    /** Vom Backend angelegtes Rezept in Liste und Cache übernehmen. */
    insertCreated(recipe: Recipe) {
      this.pendingIds = this.pendingIds.filter(
        (id) => id !== recipe.recipe_uuid,
      );
      this.rejectedIds = this.rejectedIds.filter(
        (id) => id !== recipe.recipe_uuid,
      );
      void writeRecipeDetail(recipe);
      noteCreated(recipe);
      const index = this.recipes.findIndex(
        (r) => r.recipe_uuid === recipe.recipe_uuid,
      );
      // Ein übertragenes Rezept ersetzt seine lokale Fassung (gleiche ID)
      if (index < 0) this.recipes.push(recipe);
      else this.recipes.splice(index, 1, recipe);
      this.saveRecipes();
    },

    /**
     * Speichert ein geändertes Rezept, Ergebnis siehe `SaveResult`. Liste und
     * Cache übernehmen die Änderung erst nach Erfolg; `failed` lässt alles
     * beim alten Stand. Eine Listenzeile (`listOnly`) geht nie als `data`
     * raus: Das Backend ersetzt `data` vollständig, Zutaten und Schritte
     * wären weg (`failed` mit `IncompleteRecipeError`, unabhängig vom
     * Aufrufer).
     */
    async setRecipe(recipe: Recipe): Promise<SaveResult> {
      if (recipe.listOnly) {
        return { status: "failed", error: new IncompleteRecipeError() };
      }
      const copy = deepCopyJSON(recipe);
      const result = await saveChange(
        copy,
        recipeToPayload(copy),
        this.pendingIds.includes(copy.recipe_uuid),
      );
      if (result.status === "failed") return result;
      if (result.status === "saved") void writeRecipeDetail(copy);
      this.applySaved(copy.recipe_uuid, () => copy, result);
      return result;
    },

    /**
     * Speichert nur die Tags (`PUT` ohne `data`: Die Listenzeile kennt
     * Zutaten und Schritte nicht). Ergebnis wie `setRecipe`.
     */
    async setRecipeTags(uuid: string, tags: string[]): Promise<SaveResult> {
      const current = this.recipes.find((r) => r.recipe_uuid === uuid);
      if (!current) {
        return { status: "failed", error: new Error("Rezept nicht gefunden") };
      }
      // Vorgemerkt: Die Listenzeile ist das vollständige Rezept
      const changed = { ...deepCopyJSON(current), tags: [...tags] };
      const result = await saveChange(
        changed,
        { tags: [...tags] },
        this.pendingIds.includes(uuid),
      );
      if (result.status === "failed") return result;
      if (result.status === "saved" && result.detail) {
        void writeRecipeDetail(detailToRecipe(result.detail));
      }
      this.applySaved(uuid, (r) => ({ ...r, tags: [...tags] }), result);
      return result;
    },

    /** Gespeicherte Änderung in die Liste übernehmen (nicht gelöschte). */
    applySaved(
      uuid: string,
      update: (current: Recipe) => Recipe,
      result: SaveResult,
    ) {
      // Eine Bearbeitung hebt die Ablehnung auf (`updatePending`), außer bei
      // fremdem 409
      if (result.status === "local" && !result.stillRejected) {
        this.rejectedIds = this.rejectedIds.filter((id) => id !== uuid);
      }
      const index = this.recipes.findIndex((r) => r.recipe_uuid === uuid);
      if (index < 0) return;
      this.recipes.splice(index, 1, update(this.recipes[index]));
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
      const seq = startListFetch();
      const items = await recipeApi.listAll();
      const { pending, deleted } = await readPending();
      // Gelöschte Vorgemerkte, deren `DELETE` aussteht, nicht wieder zeigen
      const fromApi = items
        .map(listItemToRecipe)
        .filter((r) => !deleted.has(r.recipe_uuid));
      const merged = mergeFetched(seq, fromApi);
      if (!merged) return;
      // Vorgemerkte (noch nicht übertragene) Rezepte bleiben sichtbar.
      this.recipes = this.withPendingIds(merged, pending);
      void writeRecipes(deepCopyJSON(this.recipes));
      this.prefetchRecipeDetails(fromApi);
    },

    /**
     * Vollständige Fassung zum Bearbeiten, Duplizieren oder Exportieren:
     * Listenzeile (`listOnly`, ohne Zutaten) → Detail von der API, sonst aus
     * dem Detail-Cache. `null`, wenn eine Listenzeile nicht vervollständigt
     * werden kann; nie die Listenzeile selbst.
     */
    async loadCompleteRecipe(recipe: Recipe): Promise<Recipe | null> {
      if (!recipe.listOnly && recipe.ingredients?.length) return recipe;
      if (navigator.onLine && (await isAuthenticated())) {
        try {
          return await this.loadRecipeDetailFromApi(recipe.recipe_uuid);
        } catch {
          // API nicht erreichbar: Detail-Cache
        }
      }
      const cached = await readRecipeDetail(recipe.recipe_uuid);
      // Ein leerer Cache-Eintrag kann eine früher gespeicherte Listenzeile
      // sein (Tag-Fehler vor W.37): nicht als vollständig nehmen
      if (cached && !(recipe.listOnly && looksLikeListRow(cached))) {
        return withoutListOnly(cached);
      }
      // Vorgemerkt bzw. neu ohne Zutaten: ist bereits vollständig
      return recipe.listOnly ? null : recipe;
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
