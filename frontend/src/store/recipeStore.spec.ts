import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

// IndexedDB der Vormerkung als Speicher, der einen „Neustart“ übersteht
const idb = vi.hoisted(() => ({ pending: undefined as unknown }));

vi.mock("idb-keyval", () => ({ get: vi.fn(), set: vi.fn() }));
vi.mock("@/js/offlineCache", () => ({
  readFavorites: vi.fn(),
  readRecipeDetail: vi.fn(),
  readRecipes: vi.fn(),
  readSettings: vi.fn(),
  writeFavorites: vi.fn(),
  writeRecipeDetail: vi.fn(),
  writeRecipes: vi.fn(),
  writeSettings: vi.fn(),
  readPendingCreates: vi.fn(async () => structuredClone(idb.pending ?? [])),
  writePendingCreates: vi.fn(async (v: unknown) => {
    idb.pending = structuredClone(v);
  }),
}));
vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/client")>()),
  api: { get: vi.fn(), put: vi.fn() },
}));
vi.mock("@/api/recipes", () => ({
  recipeApi: {
    create: vi.fn(),
    listAll: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock("@/api/favorites", () => ({
  favoritesApi: { list: vi.fn(async () => []) },
}));
vi.mock("@/api/images", () => ({
  imageApi: { list: vi.fn(), upload: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/auth/session", () => ({
  ensureAuth: vi.fn(),
  isAuthenticated: vi.fn(),
  loginFollows: vi.fn(() => false),
  currentUserSub: vi.fn(async () => "user-a"),
}));

import { api, ApiError, OfflineError } from "@/api/client";
import { LocalReadError } from "@/store/pendingCreates";
import { IncompleteRecipeError, listItemToRecipe } from "@/js/recipeMapping";
import {
  recipeApi,
  type RecipeDetail,
  type RecipeListItem,
} from "@/api/recipes";
import { imageApi, type ImageInfo } from "@/api/images";
import {
  readFavorites,
  readRecipeDetail,
  readRecipes,
  readPendingCreates,
  readSettings,
  writePendingCreates,
  writeRecipeDetail,
  writeRecipes,
  writeSettings,
} from "@/js/offlineCache";
import {
  currentUserSub,
  ensureAuth,
  isAuthenticated,
  loginFollows,
} from "@/auth/session";
import type { PendingCreate } from "@/js/offlineCache";
import { useRecipeStore } from "@/store/recipeStore";
import { appendFailedMessage } from "@/js/appendFeedback";
import type { Settings } from "@/types/settings";
import type { Recipe } from "@/types/recipe";

describe("recipeStore.saveSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  it("speichert eine Kopie, nicht das übergebene Objekt (offline)", async () => {
    vi.mocked(isAuthenticated).mockResolvedValue(false);
    const store = useRecipeStore();
    const input: Settings = {
      read_only: false,
      expert_mode: false,
      role: "editor",
    };
    await store.saveSettings(input);

    expect(store.settings).toEqual(input);
    expect(store.settings).not.toBe(input);

    input.expert_mode = true;
    input.role = "admin";
    expect(store.settings).toEqual({
      read_only: false,
      expert_mode: false,
      role: "editor",
    });
    const written = vi.mocked(writeSettings).mock.calls[0][0];
    expect(written).not.toBe(input);
    expect(written.expert_mode).toBe(false);
  });

  it("übernimmt bei Erfolg die Antwort der API", async () => {
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    const updated: Settings = {
      read_only: false,
      expert_mode: true,
      role: "editor",
    };
    vi.mocked(api.put).mockResolvedValue(updated);
    const store = useRecipeStore();
    const input: Settings = {
      read_only: false,
      expert_mode: true,
      role: "editor",
    };
    await store.saveSettings(input);

    expect(api.put).toHaveBeenCalledWith("/me/settings", {
      read_only: false,
      expert_mode: true,
    });
    expect(store.settings).toEqual(updated);
    expect(writeSettings).toHaveBeenCalledWith(updated);
  });

  it("behält bei API-Fehler die Kopie und schreibt den Cache", async () => {
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    vi.mocked(api.put).mockRejectedValue(new Error("netz"));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = useRecipeStore();
    const input: Settings = {
      read_only: true,
      expert_mode: false,
      role: "readonly",
    };
    await store.saveSettings(input);

    input.read_only = false;
    expect(store.settings.read_only).toBe(true);
    expect(writeSettings).toHaveBeenCalledTimes(1);
  });
});

describe("recipeStore.setRecipePicture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    vi.mocked(isAuthenticated).mockResolvedValue(true);
  });

  it("ersetzt nur Fotos, Vorlagen bleiben", async () => {
    vi.mocked(imageApi.list).mockResolvedValue([
      { id: "foto-alt" } as ImageInfo,
    ]);
    vi.mocked(imageApi.upload).mockResolvedValue({
      id: "foto-neu",
    } as ImageInfo);
    const store = useRecipeStore();
    store.recipes = [
      { recipe_uuid: "r1", first_image_id: "foto-alt" } as Recipe,
    ];

    const picture = new File(["x"], "foto.jpg", { type: "image/jpeg" });
    await store.setRecipePicture({ uuid: "r1", picture });

    expect(imageApi.list).toHaveBeenCalledWith("r1", "photo");
    expect(imageApi.delete).toHaveBeenCalledWith("r1", "foto-alt");
    expect(imageApi.upload).toHaveBeenCalledWith("r1", picture);
    expect(store.recipes[0].first_image_id).toBe("foto-neu");
  });

  it("entfernt beim Löschen nur Fotos", async () => {
    vi.mocked(imageApi.list).mockResolvedValue([
      { id: "foto-alt" } as ImageInfo,
    ]);
    const store = useRecipeStore();
    store.recipes = [
      { recipe_uuid: "r1", first_image_id: "foto-alt" } as Recipe,
    ];

    await store.setRecipePicture({ uuid: "r1", picture: null });

    expect(imageApi.list).toHaveBeenCalledWith("r1", "photo");
    expect(imageApi.delete).toHaveBeenCalledTimes(1);
    expect(store.recipes[0].first_image_id).toBeUndefined();
  });
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => (resolve = res));
  return { promise, resolve };
}

const detail = (
  id: string,
  recipe_name = "Apfelkuchen",
  created_by = "USER-A", // Groß-/Kleinschreibung zählt nicht
  data: Record<string, unknown> = {},
): RecipeDetail =>
  ({
    id,
    recipe_name,
    data,
    created_by,
    tags: [],
    first_image_id: null,
    updated_at: "2026-11-16T12:00:00Z",
  }) as unknown as RecipeDetail;
const listItem = (id: string): RecipeListItem =>
  ({
    id,
    recipe_name: id,
    tags: [],
    updated_at: "2026-11-16T12:00:00Z",
  }) as unknown as RecipeListItem;
const newRecipe = () =>
  ({
    recipe_uuid: "lokal-1",
    recipe_name: "Apfelkuchen",
    ingredients: [],
    steps: [],
    sections: [],
  }) as unknown as Recipe;
const ids = (store: ReturnType<typeof useRecipeStore>) =>
  store.recipes.map((r) => r.recipe_uuid);
const pending = () =>
  ((idb.pending ?? []) as PendingCreate[]).map((e) => ({
    uuid: e.recipe.recipe_uuid,
    name: e.recipe.recipe_name,
    rejected: e.rejected,
  }));
/** Gültige Sitzung (`valid`) bzw. ohne Verbindung (`offline`). */
function session(state: "valid" | "offline" | "rejected") {
  vi.mocked(ensureAuth).mockResolvedValue(state);
  vi.mocked(isAuthenticated).mockResolvedValue(state === "valid");
  vi.mocked(loginFollows).mockReturnValue(state === "rejected");
}

describe("recipeStore.appendRecipe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    idb.pending = undefined;
    session("valid");
    vi.mocked(writeRecipes).mockResolvedValue(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("angelegt: Ergebnis created, Rezept genau einmal in der Liste, ohne Neuladen", async () => {
    vi.mocked(recipeApi.create).mockResolvedValue(detail("lokal-1"));
    vi.mocked(recipeApi.listAll).mockRejectedValue(new Error("Timeout"));
    const store = useRecipeStore();

    const result = await store.appendRecipe(newRecipe());

    expect(result).toEqual({ status: "created", detail: detail("lokal-1") });
    // Die UUID des Clients ist die Backend-ID
    expect(recipeApi.create).toHaveBeenCalledWith(
      "lokal-1",
      expect.objectContaining({ recipe_name: "Apfelkuchen" }),
    );
    expect(ids(store)).toEqual(["lokal-1"]);
    expect(recipeApi.listAll).not.toHaveBeenCalled();
    expect(pending()).toEqual([]);
  });

  it("409, eigenes Rezept, gleicher Stand: Wiederholung, created ohne PUT", async () => {
    vi.mocked(recipeApi.create).mockRejectedValue(new ApiError(409, "da"));
    vi.mocked(recipeApi.get).mockResolvedValue(detail("lokal-1"));
    const store = useRecipeStore();

    const result = await store.appendRecipe(newRecipe());

    expect(recipeApi.get).toHaveBeenCalledWith("lokal-1");
    expect(result).toEqual({ status: "created", detail: detail("lokal-1") });
    expect(recipeApi.update).not.toHaveBeenCalled();
    expect(ids(store)).toEqual(["lokal-1"]);
  });

  it("409 mit fremdem Rezept: failed, nichts übernommen", async () => {
    const conflict = new ApiError(409, "da");
    vi.mocked(recipeApi.create).mockRejectedValue(conflict);
    vi.mocked(recipeApi.get).mockResolvedValue(
      detail("lokal-1", "Apfelkuchen", "user-b"),
    );
    const store = useRecipeStore();

    const result = await store.appendRecipe(newRecipe());

    expect(result).toEqual({ status: "failed", error: conflict });
    expect(store.recipes).toEqual([]);
    expect(pending()).toEqual([]);
  });

  it("angelegt während eines laufenden Listenabrufs: bleibt, kein Duplikat", async () => {
    const store = useRecipeStore();
    const oldList = deferred<RecipeListItem[]>();
    vi.mocked(recipeApi.listAll).mockReturnValueOnce(oldList.promise);
    const loading = store.loadRecipesFromApi(); // begann vor dem Anlegen

    vi.mocked(recipeApi.create).mockResolvedValue(detail("lokal-1"));
    await store.appendRecipe(newRecipe());
    oldList.resolve([listItem("alt")]);
    await loading;
    expect(ids(store)).toEqual(["alt", "lokal-1"]);

    // Ein späterer Abruf enthält das Rezept: genau einmal
    vi.mocked(recipeApi.listAll).mockResolvedValueOnce([
      listItem("alt"),
      listItem("lokal-1"),
    ]);
    await store.loadRecipesFromApi();
    expect(ids(store)).toEqual(["alt", "lokal-1"]);
  });

  it("veraltete Listenantwort nach einer neueren wird verworfen", async () => {
    const store = useRecipeStore();
    const first = deferred<RecipeListItem[]>();
    vi.mocked(recipeApi.listAll)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce([listItem("neu")]);
    const older = store.loadRecipesFromApi();
    await store.loadRecipesFromApi();
    first.resolve([listItem("alt")]);
    await older;
    expect(ids(store)).toEqual(["neu"]);
  });

  it("offline: Ergebnis local, vorgemerkt, keine Anfrage", async () => {
    session("offline");
    const store = useRecipeStore();

    const result = await store.appendRecipe(newRecipe());

    expect(result).toEqual({ status: "local" });
    expect(recipeApi.create).not.toHaveBeenCalled();
    expect(ids(store)).toEqual(["lokal-1"]);
    expect(writeRecipes).toHaveBeenCalled();
    expect(pending()).toEqual([
      { uuid: "lokal-1", name: "Apfelkuchen", rejected: undefined },
    ]);
  });

  it("Ausfall (Timeout, 5xx): Ergebnis local, vorgemerkt", async () => {
    vi.mocked(recipeApi.create).mockRejectedValue(new ApiError(503, ""));
    const store = useRecipeStore();

    expect(await store.appendRecipe(newRecipe())).toEqual({ status: "local" });
    expect(ids(store)).toEqual(["lokal-1"]);
    expect(pending().map((p) => p.uuid)).toEqual(["lokal-1"]);
  });

  it("fetch ohne Netz (TypeError): Ergebnis local", async () => {
    vi.mocked(recipeApi.create).mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    const store = useRecipeStore();

    expect(await store.appendRecipe(newRecipe())).toEqual({ status: "local" });
    expect(pending().map((p) => p.uuid)).toEqual(["lokal-1"]);
  });

  it("4xx: Ergebnis failed, nichts lokal gespeichert", async () => {
    const error = new ApiError(403, "Rolle");
    vi.mocked(recipeApi.create).mockRejectedValue(error);
    const store = useRecipeStore();

    const result = await store.appendRecipe(newRecipe());

    expect(result).toEqual({ status: "failed", error });
    expect(store.recipes).toEqual([]);
    expect(writeRecipes).not.toHaveBeenCalled();
    expect(pending()).toEqual([]);
  });

  it("Sitzung abgelehnt mit Netz: failed (neu anmelden), nichts gespeichert", async () => {
    session("rejected");
    const store = useRecipeStore();

    const result = await store.appendRecipe(newRecipe());

    expect(result.status).toBe("failed");
    expect(
      result.status === "failed" && (result.error as ApiError).status,
    ).toBe(401);
    expect(recipeApi.create).not.toHaveBeenCalled();
    expect(store.recipes).toEqual([]);
    expect(pending()).toEqual([]);
  });

  it("401 nach gescheiterter Erneuerung: failed statt local", async () => {
    vi.mocked(recipeApi.create).mockImplementation(async () => {
      session("rejected"); // Erneuerung abgelehnt, Sitzung verworfen
      throw new ApiError(401, "abgelaufen");
    });
    const store = useRecipeStore();

    const result = await store.appendRecipe(newRecipe());

    expect(result.status).toBe("failed");
    expect(pending()).toEqual([]);
  });
});

describe("recipeStore: vorgemerkte Rezepte", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    idb.pending = undefined;
    localStorage.clear();
    vi.mocked(api.get).mockResolvedValue({
      read_only: false,
      expert_mode: false,
      role: "editor",
    });
    vi.mocked(readSettings).mockResolvedValue(undefined);
    vi.mocked(readFavorites).mockResolvedValue(undefined);
    vi.mocked(readRecipes).mockResolvedValue(undefined);
    vi.mocked(writeRecipes).mockResolvedValue(undefined);
    vi.mocked(recipeApi.listAll).mockResolvedValue([listItem("alt")]);
    vi.mocked(currentUserSub).mockResolvedValue("user-a");
    vi.mocked(readPendingCreates).mockImplementation(async () =>
      structuredClone((idb.pending ?? []) as PendingCreate[]),
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  /** Offline anlegen, danach „App neu starten“ (neuer Store, gleiche IDB). */
  async function createOfflineAndRestart() {
    session("offline");
    await useRecipeStore().appendRecipe(newRecipe());
    const cached = useRecipeStore().recipes.map((r) => ({ ...r }));
    setActivePinia(createPinia());
    vi.mocked(readRecipes).mockResolvedValue(cached);
    vi.clearAllMocks();
    return useRecipeStore();
  }

  it("offline angelegt, Neustart, online: genau einmal übertragen", async () => {
    const store = await createOfflineAndRestart();
    session("valid");
    vi.mocked(recipeApi.create).mockResolvedValue(detail("lokal-1"));

    await store.loadAll();

    expect(recipeApi.create).toHaveBeenCalledTimes(1);
    expect(recipeApi.create).toHaveBeenCalledWith(
      "lokal-1",
      expect.objectContaining({ recipe_name: "Apfelkuchen" }),
    );
    expect(ids(store)).toEqual(["alt", "lokal-1"]);
    expect(pending()).toEqual([]);
    expect(store.transferReport).toEqual({
      transferred: 1,
      rejected: [],
      updateRejected: [],
    });

    // Nächstes Laden: Server liefert es, kein zweites Senden, kein Duplikat
    vi.mocked(recipeApi.listAll).mockResolvedValue([
      listItem("alt"),
      listItem("lokal-1"),
    ]);
    await store.loadAll();
    expect(recipeApi.create).toHaveBeenCalledTimes(1);
    expect(ids(store)).toEqual(["alt", "lokal-1"]);
  });

  it("Laden vom Server während der Vormerkung verliert nichts", async () => {
    const store = await createOfflineAndRestart();
    session("valid");
    vi.mocked(recipeApi.create).mockRejectedValue(new ApiError(503, ""));

    await store.loadAll();

    // Ausfall beim Übertragen: bleibt vorgemerkt und sichtbar
    expect(ids(store)).toEqual(["alt", "lokal-1"]);
    expect(pending().map((p) => p.uuid)).toEqual(["lokal-1"]);
    expect(store.transferReport).toBeNull();
    const written = vi.mocked(writeRecipes).mock.lastCall?.[0];
    expect(written?.map((r) => r.recipe_uuid)).toEqual(["alt", "lokal-1"]);

    // Offline ohne Listen-Cache: Vorgemerktes trotzdem da
    setActivePinia(createPinia());
    session("offline");
    vi.mocked(readRecipes).mockResolvedValue([]);
    const offline = useRecipeStore();
    await offline.loadAll();
    expect(ids(offline)).toEqual(["lokal-1"]);
  });

  it("4xx beim Übertragen: bleibt vorgemerkt, Hinweis, keine Schleife", async () => {
    const store = await createOfflineAndRestart();
    session("valid");
    vi.mocked(recipeApi.create).mockRejectedValue(new ApiError(403, "Rolle"));

    await store.loadAll();

    expect(pending()).toEqual([
      { uuid: "lokal-1", name: "Apfelkuchen", rejected: 403 },
    ]);
    expect(ids(store)).toEqual(["alt", "lokal-1"]);
    expect(store.transferReport?.rejected).toHaveLength(1);

    // Erneutes Laden sendet nicht noch einmal
    store.dataSource = "none";
    await store.loadAll();
    await store.reloadIfStale();
    expect(recipeApi.create).toHaveBeenCalledTimes(1);
    expect(ids(store)).toEqual(["alt", "lokal-1"]);

    // Nach einer Bearbeitung wird es wieder versucht
    const index = store.recipes.findIndex((r) => r.recipe_uuid === "lokal-1");
    await store.setRecipe({ ...store.recipes[index], recipe_name: "Neu" });
    expect(pending()[0].rejected).toBeUndefined();
  });

  it("Bearbeiten: aktualisiert die Vormerkung, kein PUT", async () => {
    const store = await createOfflineAndRestart();
    session("valid");
    store.recipes = [newRecipe()];

    await store.setRecipe({ ...newRecipe(), recipe_name: "Birnenkuchen" });

    expect(recipeApi.update).not.toHaveBeenCalled();
    expect(pending()).toEqual([
      { uuid: "lokal-1", name: "Birnenkuchen", rejected: undefined },
    ]);
    expect(store.recipes[0].recipe_name).toBe("Birnenkuchen");
  });

  it("Löschen: aus der Vormerkung, mit Sitzung DELETE (404 egal), kommt nicht zurück", async () => {
    const store = await createOfflineAndRestart();
    session("valid");
    // Ersteller-Abgleich vor dem DELETE: eigenes Rezept (verlorene Antwort)
    vi.mocked(recipeApi.get).mockResolvedValue(detail("lokal-1"));
    vi.mocked(recipeApi.delete).mockRejectedValue(new ApiError(404, "weg"));
    store.recipes = [newRecipe()];
    const running = deferred<RecipeListItem[]>();
    vi.mocked(recipeApi.listAll).mockReturnValueOnce(running.promise);
    const loading = store.loadRecipesFromApi(); // läuft schon

    await store.deleteRecipe("lokal-1");
    running.resolve([listItem("alt")]);
    await loading;

    // Vorgemerkt, aber womöglich schon übertragen: DELETE trotzdem
    expect(recipeApi.delete).toHaveBeenCalledWith("lokal-1");
    expect(pending()).toEqual([]);
    expect(ids(store)).toEqual(["alt"]);
  });

  it("Löschen, während ein Abruf die Vormerkung liest: kommt nicht zurück", async () => {
    const store = await createOfflineAndRestart();
    session("valid");
    store.recipes = [newRecipe()];
    const stored = structuredClone(idb.pending) as PendingCreate[];
    const slowRead = deferred<PendingCreate[]>();
    vi.mocked(readPendingCreates).mockReturnValueOnce(slowRead.promise);
    const loading = store.loadRecipesFromApi();
    await vi.waitFor(() => expect(readPendingCreates).toHaveBeenCalled());

    const deleting = store.deleteRecipe("lokal-1");
    slowRead.resolve(stored); // Lesung von vor dem Löschen
    await Promise.all([loading, deleting]);

    expect(ids(store)).toEqual(["alt"]);
    expect(pending()).toEqual([]);
  });

  it("Löschen eines gerade angelegten Rezepts während eines Abrufs", async () => {
    session("valid");
    const store = useRecipeStore();
    const running = deferred<RecipeListItem[]>();
    vi.mocked(recipeApi.listAll).mockReturnValueOnce(running.promise);
    const loading = store.loadRecipesFromApi();
    vi.mocked(recipeApi.create).mockResolvedValue(detail("lokal-1"));
    await store.appendRecipe(newRecipe());

    await store.deleteRecipe("lokal-1");
    running.resolve([listItem("alt")]);
    await loading;

    expect(recipeApi.delete).toHaveBeenCalledWith("lokal-1");
    expect(ids(store)).toEqual(["alt"]);
  });

  it("kein doppeltes Senden bei parallelem Laden", async () => {
    const store = await createOfflineAndRestart();
    session("valid");
    const created = deferred<RecipeDetail>();
    vi.mocked(recipeApi.create).mockReturnValue(created.promise);

    const first = store.loadAll();
    await vi.waitFor(() => expect(recipeApi.create).toHaveBeenCalled());
    // Ab jetzt kennt der Server das Rezept
    vi.mocked(recipeApi.listAll).mockResolvedValue([
      listItem("alt"),
      listItem("lokal-1"),
    ]);
    const second = store.reloadIfStale(); // Daten aktuell: nur Übertragung
    const third = store.loadAll();
    created.resolve(detail("lokal-1"));
    await Promise.all([first, second, third]);

    expect(recipeApi.create).toHaveBeenCalledTimes(1);
    expect(ids(store)).toEqual(["alt", "lokal-1"]);
    expect(pending()).toEqual([]);
  });

  /** Vorgemerktes Rezept offline bearbeiten (nach dem Neustart). */
  async function editOffline(
    store: ReturnType<typeof useRecipeStore>,
    change: Partial<Recipe>,
  ) {
    session("offline");
    await store.loadAll();
    const index = store.recipes.findIndex((r) => r.recipe_uuid === "lokal-1");
    await store.setRecipe({ ...store.recipes[index], ...change });
  }

  it("B1: Bearbeitung nach verlorener Antwort bleibt erhalten (PUT)", async () => {
    const store = await createOfflineAndRestart();
    await editOffline(store, { subtitle: "mit Zimt" });
    // Der erste POST hat angelegt, die Antwort ging verloren: alter Stand
    session("valid");
    vi.mocked(recipeApi.create).mockRejectedValue(new ApiError(409, "da"));
    vi.mocked(recipeApi.get).mockResolvedValue(detail("lokal-1"));
    vi.mocked(recipeApi.update).mockResolvedValue(
      detail("lokal-1", "Apfelkuchen", "user-a", { subtitle: "mit Zimt" }),
    );

    await store.loadAll();

    expect(recipeApi.update).toHaveBeenCalledWith(
      "lokal-1",
      expect.objectContaining({
        data: expect.objectContaining({ subtitle: "mit Zimt" }),
      }),
    );
    expect(pending()).toEqual([]);
    expect(
      store.recipes.find((r) => r.recipe_uuid === "lokal-1")?.subtitle,
    ).toBe("mit Zimt");
    expect(store.transferReport).toEqual({
      transferred: 1,
      rejected: [],
      updateRejected: [],
    });
  });

  it("B2: Umbenennung nach verlorener Antwort: eigenes Rezept, bearbeit- und löschbar", async () => {
    const store = await createOfflineAndRestart();
    await editOffline(store, { recipe_name: "Birnenkuchen" });
    session("valid");
    vi.mocked(recipeApi.create).mockRejectedValue(new ApiError(409, "da"));
    vi.mocked(recipeApi.get).mockResolvedValue(detail("lokal-1"));
    vi.mocked(recipeApi.update).mockResolvedValue(
      detail("lokal-1", "Birnenkuchen"),
    );

    await store.loadAll();

    expect(pending()).toEqual([]);
    expect(store.transferReport?.rejected).toEqual([]);
    const index = store.recipes.findIndex((r) => r.recipe_uuid === "lokal-1");
    expect(store.recipes[index].recipe_name).toBe("Birnenkuchen");

    // Jetzt ein gewöhnliches Rezept: PUT und DELETE gehen zum Backend
    vi.mocked(recipeApi.update).mockClear();
    await store.setRecipe({ ...store.recipes[index], subtitle: "neu" });
    expect(recipeApi.update).toHaveBeenCalledTimes(1);
    await store.deleteRecipe("lokal-1");
    expect(recipeApi.delete).toHaveBeenCalledWith("lokal-1");
  });

  it("B3: während des POST gelöscht: DELETE gesendet, kommt nicht zurück", async () => {
    const store = await createOfflineAndRestart();
    session("valid");
    const created = deferred<RecipeDetail>();
    vi.mocked(recipeApi.create).mockReturnValue(created.promise);

    const loading = store.loadAll();
    await vi.waitFor(() => expect(recipeApi.create).toHaveBeenCalled());
    expect(await store.deleteRecipe("lokal-1")).toEqual({ status: "deleted" });
    expect(ids(store)).toEqual(["alt"]); // vorgemerkt: sofort weg
    created.resolve(detail("lokal-1"));
    await loading;

    expect(recipeApi.delete).toHaveBeenCalledWith("lokal-1");
    expect(ids(store)).toEqual(["alt"]);
    expect(pending()).toEqual([]);
  });

  it("B4: Einträge von Nutzer A werden mit Sitzung B weder übertragen noch angezeigt", async () => {
    const storeA = await createOfflineAndRestart(); // als user-a
    expect(storeA).toBeDefined();
    vi.mocked(currentUserSub).mockResolvedValue("user-b");
    vi.mocked(readRecipes).mockResolvedValue([]);
    session("valid");

    await useRecipeStore().loadAll();

    expect(recipeApi.create).not.toHaveBeenCalled();
    expect(ids(useRecipeStore())).toEqual(["alt"]);
    expect(pending()).toEqual([
      { uuid: "lokal-1", name: "Apfelkuchen", rejected: undefined },
    ]);
    expect(writePendingCreates).not.toHaveBeenCalled();

    // Wieder Nutzer A: wird übertragen
    vi.mocked(currentUserSub).mockResolvedValue("user-a");
    vi.mocked(recipeApi.create).mockResolvedValue(detail("lokal-1"));
    setActivePinia(createPinia());
    await useRecipeStore().loadAll();
    expect(recipeApi.create).toHaveBeenCalledTimes(1);
    expect(pending()).toEqual([]);
  });

  it("B5: Schreibfehler der Vormerkung: failed statt local", async () => {
    session("offline");
    vi.mocked(writePendingCreates).mockRejectedValueOnce(new Error("quota"));
    const store = useRecipeStore();

    const result = await store.appendRecipe(newRecipe());

    expect(result.status).toBe("failed");
    expect(
      appendFailedMessage(result.status === "failed" && result.error),
    ).toBe(
      "Rezept nicht angelegt: konnte auf diesem Gerät nicht gespeichert werden.",
    );
    expect(store.recipes).toEqual([]);
  });

  it("B5: Lesefehler der Vormerkung: kein Überschreiben, Anlegen failed", async () => {
    await createOfflineAndRestart();
    const before = structuredClone(idb.pending);
    vi.mocked(readPendingCreates).mockRejectedValue(new Error("gesperrt"));
    session("valid");
    const store = useRecipeStore();

    await store.loadAll(); // Liste ohne Vorgemerktes, kein Absturz
    expect(ids(store)).toEqual(["alt"]);
    session("offline");
    const other = { ...newRecipe(), recipe_uuid: "lokal-2" };
    expect((await store.appendRecipe(other)).status).toBe("failed");
    await store.setRecipe(store.recipes[0]);
    await store.deleteRecipe("alt");

    expect(writePendingCreates).not.toHaveBeenCalled();
    expect(idb.pending).toEqual(before);
  });

  it("B6: PUT nach Bearbeitung scheitert: Eintrag bleibt, nächstes Laden schiebt nach", async () => {
    const store = await createOfflineAndRestart();
    session("valid");
    const created = deferred<RecipeDetail>();
    vi.mocked(recipeApi.create).mockReturnValueOnce(created.promise);
    vi.mocked(recipeApi.update).mockRejectedValueOnce(new ApiError(503, ""));

    const loading = store.loadAll();
    await vi.waitFor(() => expect(recipeApi.create).toHaveBeenCalled());
    const index = store.recipes.findIndex((r) => r.recipe_uuid === "lokal-1");
    await store.setRecipe({
      ...store.recipes[index],
      recipe_name: "Birnenkuchen",
    });
    created.resolve(detail("lokal-1"));
    await loading;

    expect(pending()).toEqual([
      { uuid: "lokal-1", name: "Birnenkuchen", rejected: undefined },
    ]);
    expect(store.transferReport).toBeNull();

    // Nächstes Laden: 409, eigenes Rezept mit altem Stand → PUT
    vi.mocked(recipeApi.create).mockRejectedValue(new ApiError(409, "da"));
    vi.mocked(recipeApi.get).mockResolvedValue(detail("lokal-1"));
    vi.mocked(recipeApi.update).mockResolvedValue(
      detail("lokal-1", "Birnenkuchen"),
    );
    store.dataSource = "none";
    await store.loadAll();
    expect(pending()).toEqual([]);
    expect(store.transferReport?.transferred).toBe(1);
  });

  it("während der Übertragung bearbeitet: neuerer Stand per PUT", async () => {
    const store = await createOfflineAndRestart();
    session("valid");
    const created = deferred<RecipeDetail>();
    vi.mocked(recipeApi.create).mockReturnValue(created.promise);
    vi.mocked(recipeApi.update).mockResolvedValue(
      detail("lokal-1", "Birnenkuchen"),
    );

    const loading = store.loadAll();
    await vi.waitFor(() => expect(recipeApi.create).toHaveBeenCalled());
    const index = store.recipes.findIndex((r) => r.recipe_uuid === "lokal-1");
    await store.setRecipe({
      ...store.recipes[index],
      recipe_name: "Birnenkuchen",
    });
    created.resolve(detail("lokal-1"));
    await loading;

    expect(recipeApi.update).toHaveBeenCalledWith(
      "lokal-1",
      expect.objectContaining({ recipe_name: "Birnenkuchen" }),
    );
    expect(pending()).toEqual([]);
    expect(
      store.recipes.find((r) => r.recipe_uuid === "lokal-1")?.recipe_name,
    ).toBe("Birnenkuchen");
  });

  // --- W.35: Randfälle der Vormerkung ---

  it("ohne sub nicht vormerken: failed „Bitte anmelden“", async () => {
    session("offline");
    vi.mocked(currentUserSub).mockResolvedValue(null);
    const store = useRecipeStore();

    const result = await store.appendRecipe(newRecipe());

    expect(result.status).toBe("failed");
    expect(
      appendFailedMessage(result.status === "failed" && result.error),
    ).toBe("Rezept nicht angelegt: Bitte anmelden.");
    expect(writePendingCreates).not.toHaveBeenCalled();
    expect(store.recipes).toEqual([]);
  });

  it("currentUserSub wirft: Liste ohne Vorgemerktes, Anlegen LocalSaveError", async () => {
    await createOfflineAndRestart();
    vi.mocked(currentUserSub).mockRejectedValue(new Error("storage"));
    vi.mocked(readRecipes).mockResolvedValue([]);
    session("offline");
    const store = useRecipeStore();

    await store.loadAll();
    expect(ids(store)).toEqual([]);
    expect(store.userSub).toBeNull();

    const other = { ...newRecipe(), recipe_uuid: "lokal-2" };
    const result = await store.appendRecipe(other);
    expect(result.status).toBe("failed");
    expect(
      appendFailedMessage(result.status === "failed" && result.error),
    ).toBe(
      "Rezept nicht angelegt: konnte auf diesem Gerät nicht gespeichert werden.",
    );
    expect(pending()).toEqual([
      { uuid: "lokal-1", name: "Apfelkuchen", rejected: undefined },
    ]);
  });

  it("PUT nach erfolgter Anlage abgelehnt: angelegt, Änderung gemeldet, nicht vorgemerkt", async () => {
    const store = await createOfflineAndRestart();
    await editOffline(store, { subtitle: "mit Zimt" });
    session("valid");
    vi.mocked(recipeApi.create).mockRejectedValue(new ApiError(409, "da"));
    vi.mocked(recipeApi.get).mockResolvedValue(detail("lokal-1"));
    vi.mocked(recipeApi.update).mockRejectedValue(new ApiError(422, "x"));

    await store.loadAll();

    expect(pending()).toEqual([]);
    expect(store.transferReport?.transferred).toBe(1);
    expect(store.transferReport?.rejected).toEqual([]);
    expect(store.transferReport?.updateRejected).toEqual([
      { recipe_name: "Apfelkuchen", error: new ApiError(422, "x") },
    ]);
    // Serverstand in der Liste, kein vorgemerktes Rezept mehr
    expect(
      store.recipes.find((r) => r.recipe_uuid === "lokal-1")?.subtitle,
    ).toBeUndefined();
    expect(store.pendingIds).toEqual([]);
  });

  it("während der Übertragung bearbeitet, PUT abgelehnt: angelegt, nicht vorgemerkt", async () => {
    const store = await createOfflineAndRestart();
    session("valid");
    const created = deferred<RecipeDetail>();
    vi.mocked(recipeApi.create).mockReturnValue(created.promise);
    vi.mocked(recipeApi.update).mockRejectedValue(new ApiError(403, ""));

    const loading = store.loadAll();
    await vi.waitFor(() => expect(recipeApi.create).toHaveBeenCalled());
    const index = store.recipes.findIndex((r) => r.recipe_uuid === "lokal-1");
    await store.setRecipe({
      ...store.recipes[index],
      recipe_name: "Birnenkuchen",
    });
    created.resolve(detail("lokal-1"));
    await loading;

    expect(recipeApi.update).toHaveBeenCalledTimes(1);
    expect(pending()).toEqual([]);
    expect(store.transferReport?.updateRejected).toHaveLength(1);
    expect(store.transferReport?.rejected).toEqual([]);
  });

  it("PUT abgelehnt, erneut bearbeitet, nächster PUT gelingt: normal übertragen", async () => {
    const store = await createOfflineAndRestart();
    session("valid");
    const created = deferred<RecipeDetail>();
    let rejectFirstPut!: (e: unknown) => void;
    const firstPut = new Promise<RecipeDetail>((_, reject) => {
      rejectFirstPut = reject;
    });
    vi.mocked(recipeApi.create).mockReturnValue(created.promise);
    vi.mocked(recipeApi.update)
      .mockReturnValueOnce(firstPut)
      .mockResolvedValueOnce(detail("lokal-1", "Quittenkuchen"));
    const edit = async (recipe_name: string) => {
      const index = store.recipes.findIndex((r) => r.recipe_uuid === "lokal-1");
      await store.setRecipe({ ...store.recipes[index], recipe_name });
    };

    const loading = store.loadAll();
    await vi.waitFor(() => expect(recipeApi.create).toHaveBeenCalled());
    await edit("Birnenkuchen");
    created.resolve(detail("lokal-1"));
    await vi.waitFor(() => expect(recipeApi.update).toHaveBeenCalled());
    await edit("Quittenkuchen");
    rejectFirstPut(new ApiError(422, "x"));
    await loading;

    expect(recipeApi.update).toHaveBeenCalledTimes(2);
    expect(pending()).toEqual([]);
    expect(store.transferReport).toEqual({
      transferred: 1,
      rejected: [],
      updateRejected: [],
    });
  });

  it("appendRecipe: eigenes 409, PUT abgelehnt → created mit updateError", async () => {
    session("valid");
    vi.mocked(recipeApi.create).mockRejectedValue(new ApiError(409, "da"));
    vi.mocked(recipeApi.get).mockResolvedValue(detail("lokal-1"));
    vi.mocked(recipeApi.update).mockRejectedValue(new ApiError(422, "x"));
    const store = useRecipeStore();

    const result = await store.appendRecipe({
      ...newRecipe(),
      subtitle: "neuer",
    });

    expect(result).toEqual({
      status: "created",
      detail: detail("lokal-1"),
      updateError: new ApiError(422, "x"),
    });
    expect(ids(store)).toEqual(["lokal-1"]);
  });

  it("IDB-Lesefehler bei vorgemerktem Rezept: Bearbeiten und Löschen melden Fehler, keine API", async () => {
    const store = await createOfflineAndRestart();
    session("offline");
    await store.loadAll();
    expect(store.pendingIds).toEqual(["lokal-1"]);
    vi.mocked(readPendingCreates).mockRejectedValue(new Error("gesperrt"));
    session("valid");
    const index = store.recipes.findIndex((r) => r.recipe_uuid === "lokal-1");

    const saved = await store.setRecipe({
      ...store.recipes[index],
      recipe_name: "Birnenkuchen",
    });
    expect(saved.status === "failed" && saved.error).toBeInstanceOf(
      LocalReadError,
    );
    // Liste unverändert
    expect(store.recipes[index].recipe_name).toBe("Apfelkuchen");
    const result = await store.deleteRecipe("lokal-1");

    expect(result.status).toBe("failed");
    expect(result.status === "failed" && result.error).toBeInstanceOf(
      LocalReadError,
    );
    expect(recipeApi.update).not.toHaveBeenCalled();
    expect(recipeApi.delete).not.toHaveBeenCalled();
    expect(ids(store)).toContain("lokal-1");
  });

  it("Löschen während settle: kein Geist, auch nicht aus einem älteren Abruf", async () => {
    const store = await createOfflineAndRestart();
    session("valid");
    const created = deferred<RecipeDetail>();
    vi.mocked(recipeApi.create).mockReturnValue(created.promise);

    const loading = store.loadAll();
    await vi.waitFor(() => expect(recipeApi.create).toHaveBeenCalled());
    // settle hält die Vormerkung, während gelöscht wird
    const stored = structuredClone(idb.pending) as PendingCreate[];
    const slowRead = deferred<PendingCreate[]>();
    vi.mocked(readPendingCreates).mockReturnValueOnce(slowRead.promise);
    const reads = vi.mocked(readPendingCreates).mock.calls.length;
    created.resolve(detail("lokal-1"));
    await vi.waitFor(() =>
      expect(vi.mocked(readPendingCreates).mock.calls.length).toBe(reads + 1),
    );
    // Ein Abruf von vor dem Löschen liefert das Rezept noch
    const stale = deferred<RecipeListItem[]>();
    vi.mocked(recipeApi.listAll).mockReturnValueOnce(stale.promise);
    const staleLoad = store.loadRecipesFromApi();

    const deleting = store.deleteRecipe("lokal-1");
    slowRead.resolve(stored);
    await loading;
    expect(await deleting).toEqual({ status: "deleted" });
    stale.resolve([listItem("alt"), listItem("lokal-1")]);
    await staleLoad;

    expect(recipeApi.delete).toHaveBeenCalledWith("lokal-1");
    expect(ids(store)).toEqual(["alt"]);
    expect(pending()).toEqual([]);
  });
});

describe("recipeStore.deleteRecipe: Ergebnis und Rechte", () => {
  const SUB = "3f2b8c1e-0a4d-4e5f-9b6a-7c8d9e0f1a2b";
  const own = (id: string, created_by?: string) =>
    ({ ...newRecipe(), recipe_uuid: id, created_by }) as Recipe;

  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    idb.pending = undefined;
    session("valid");
    vi.mocked(writeRecipes).mockResolvedValue(undefined);
    vi.mocked(readPendingCreates).mockImplementation(async () =>
      structuredClone((idb.pending ?? []) as PendingCreate[]),
    );
    vi.mocked(recipeApi.delete).mockResolvedValue(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("403: Fehler, Rezept bleibt in der Liste", async () => {
    vi.mocked(recipeApi.delete).mockRejectedValue(new ApiError(403, "nein"));
    const store = useRecipeStore();
    store.recipes = [own("r1"), own("r2")];

    const result = await store.deleteRecipe("r1");

    expect(result).toEqual({
      status: "failed",
      error: new ApiError(403, "nein"),
    });
    expect(ids(store)).toEqual(["r1", "r2"]);
  });

  it("offline: kein API-Aufruf, Fehler, Rezept bleibt", async () => {
    session("offline");
    const store = useRecipeStore();
    store.recipes = [own("r1")];

    const result = await store.deleteRecipe("r1");

    expect(result.status === "failed" && result.error).toBeInstanceOf(
      OfflineError,
    );
    expect(recipeApi.delete).not.toHaveBeenCalled();
    expect(ids(store)).toEqual(["r1"]);
  });

  it("Sitzung abgelehnt: 401 „Bitte neu anmelden“, kein API-Aufruf", async () => {
    session("rejected");
    const store = useRecipeStore();
    store.recipes = [own("r1")];

    const result = await store.deleteRecipe(0);

    expect(result).toEqual({
      status: "failed",
      error: new ApiError(401, "Sitzung abgelaufen"),
    });
    expect(recipeApi.delete).not.toHaveBeenCalled();
  });

  it("Erfolg und 404: aus der Liste, auch per Index", async () => {
    const store = useRecipeStore();
    store.recipes = [own("r1"), own("r2")];

    expect(await store.deleteRecipe(1)).toEqual({ status: "deleted" });
    vi.mocked(recipeApi.delete).mockRejectedValue(new ApiError(404, "weg"));
    expect(await store.deleteRecipe("r1")).toEqual({ status: "deleted" });

    expect(recipeApi.delete).toHaveBeenNthCalledWith(1, "r2");
    expect(ids(store)).toEqual([]);
  });

  it("bis zur Antwort sichtbar, danach kein Geist aus einem älteren Abruf", async () => {
    const store = useRecipeStore();
    store.recipes = [own("r1"), own("r2")];
    const answer = deferred<void>();
    vi.mocked(recipeApi.delete).mockReturnValue(answer.promise);
    const stale = deferred<RecipeListItem[]>();
    vi.mocked(recipeApi.listAll).mockReturnValueOnce(stale.promise);
    const staleLoad = store.loadRecipesFromApi();

    const deleting = store.deleteRecipe("r1");
    await vi.waitFor(() => expect(recipeApi.delete).toHaveBeenCalled());
    expect(ids(store)).toEqual(["r1", "r2"]);
    answer.resolve();
    await deleting;
    stale.resolve([listItem("r1"), listItem("r2")]);
    await staleLoad;
    expect(ids(store)).toEqual(["r2"]);

    // Ein danach begonnener Abruf gilt wieder
    vi.mocked(recipeApi.listAll).mockResolvedValue([
      listItem("r1"),
      listItem("r2"),
    ]);
    await store.loadRecipesFromApi();
    expect(ids(store)).toEqual(["r1", "r2"]);
  });

  it("canDelete: Admin alle, Editor eigene (normalisiert), readonly nur Vorgemerktes", async () => {
    const store = useRecipeStore();
    store.userSub = `{${SUB.toUpperCase()}}`;
    const mine = own("r1", SUB);
    const foreign = own("r2", "11111111-2222-3333-4444-555555555555");
    const legacy = own("r3");

    store.settings = { read_only: false, expert_mode: false, role: "editor" };
    expect([mine, foreign, legacy].map((r) => store.canDelete(r))).toEqual([
      true,
      false,
      false,
    ]);
    store.settings = { read_only: false, expert_mode: false, role: "admin" };
    expect([mine, foreign, legacy].map((r) => store.canDelete(r))).toEqual([
      true,
      true,
      true,
    ]);
    store.settings = { read_only: true, expert_mode: false, role: "readonly" };
    expect(store.canDelete(mine)).toBe(false);
    session("offline");
    vi.mocked(currentUserSub).mockResolvedValue(SUB);
    await store.appendRecipe(own("lokal-9"));
    expect(store.canDelete(own("lokal-9"))).toBe(true);
    vi.mocked(currentUserSub).mockResolvedValue("user-a");
    idb.pending = undefined;
  });
});

describe("recipeStore.loadAll: dataSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    localStorage.clear();
    vi.mocked(ensureAuth).mockResolvedValue("offline");
    vi.mocked(writeRecipes).mockResolvedValue(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("offline mit leerem Cache bleibt none (kein „Offline-Daten“ ohne Daten)", async () => {
    vi.mocked(readSettings).mockResolvedValue(undefined);
    vi.mocked(readRecipes).mockResolvedValue(undefined);
    vi.mocked(readFavorites).mockResolvedValue(undefined);
    const store = useRecipeStore();

    await store.loadAll();

    expect(store.dataSource).toBe("none");
  });

  it("offline mit Cache-Daten → cache", async () => {
    vi.mocked(readSettings).mockResolvedValue(undefined);
    vi.mocked(readRecipes).mockResolvedValue([newRecipe()]);
    vi.mocked(readFavorites).mockResolvedValue(undefined);
    const store = useRecipeStore();

    await store.loadAll();

    expect(store.dataSource).toBe("cache");
    expect(ids(store)).toEqual(["lokal-1"]);
  });
});

describe("recipeStore.setRecipe: ehrliches Ergebnis", () => {
  const saved = (id = "r1", name = "Apfelkuchen") =>
    ({
      ...newRecipe(),
      recipe_uuid: id,
      recipe_name: name,
      ingredients: [{ name: "Mehl", amounts: [] }],
      tags: ["Kuchen"],
    }) as unknown as Recipe;

  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    idb.pending = undefined;
    session("valid");
    vi.mocked(writeRecipes).mockResolvedValue(undefined);
    vi.mocked(readPendingCreates).mockImplementation(async () =>
      structuredClone((idb.pending ?? []) as PendingCreate[]),
    );
    vi.mocked(recipeApi.update).mockResolvedValue(detail("r1", "Neu"));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("Erfolg: saved, Liste und Detail-Cache erst danach", async () => {
    const store = useRecipeStore();
    store.recipes = [saved()];
    const answer = deferred<RecipeDetail>();
    vi.mocked(recipeApi.update).mockReturnValueOnce(answer.promise);

    const saving = store.setRecipe({ ...saved(), recipe_name: "Neu" });
    await vi.waitFor(() => expect(recipeApi.update).toHaveBeenCalled());
    expect(store.recipes[0].recipe_name).toBe("Apfelkuchen");
    answer.resolve(detail("r1", "Neu"));

    expect((await saving).status).toBe("saved");
    expect(store.recipes[0].recipe_name).toBe("Neu");
    expect(writeRecipeDetail).toHaveBeenCalledWith(
      expect.objectContaining({ recipe_name: "Neu" }),
    );
    expect(writeRecipes).toHaveBeenCalled();
  });

  it.each([403, 422, 500])(
    "PUT %i: failed mit Fehler, Liste und Caches unverändert",
    async (status) => {
      vi.mocked(recipeApi.update).mockRejectedValue(new ApiError(status, ""));
      const store = useRecipeStore();
      store.recipes = [saved()];

      const result = await store.setRecipe({ ...saved(), recipe_name: "Neu" });

      expect(result).toEqual({
        status: "failed",
        error: new ApiError(status, ""),
      });
      expect(store.recipes[0].recipe_name).toBe("Apfelkuchen");
      expect(writeRecipeDetail).not.toHaveBeenCalled();
      expect(writeRecipes).not.toHaveBeenCalled();
    },
  );

  it("offline: failed „keine Verbindung“, kein PUT, nichts lokal", async () => {
    session("offline");
    const store = useRecipeStore();
    store.recipes = [saved()];

    const result = await store.setRecipe({ ...saved(), recipe_name: "Neu" });

    expect(result.status === "failed" && result.error).toBeInstanceOf(
      OfflineError,
    );
    expect(recipeApi.update).not.toHaveBeenCalled();
    expect(store.recipes[0].recipe_name).toBe("Apfelkuchen");
    expect(writeRecipes).not.toHaveBeenCalled();
  });

  it("Sitzung abgelehnt: failed 401 „Bitte neu anmelden“, kein PUT", async () => {
    session("rejected");
    const store = useRecipeStore();
    store.recipes = [saved()];

    const result = await store.setRecipe({ ...saved(), recipe_name: "Neu" });

    expect(result).toEqual({
      status: "failed",
      error: new ApiError(401, "Sitzung abgelaufen"),
    });
    expect(recipeApi.update).not.toHaveBeenCalled();
  });

  it("während des Speicherns gelöscht: kommt nicht zurück", async () => {
    const store = useRecipeStore();
    store.recipes = [saved(), saved("r2")];
    const answer = deferred<RecipeDetail>();
    vi.mocked(recipeApi.update).mockReturnValueOnce(answer.promise);
    vi.mocked(recipeApi.delete).mockResolvedValue(undefined);

    const saving = store.setRecipe({ ...saved(), recipe_name: "Neu" });
    await store.deleteRecipe("r1");
    answer.resolve(detail("r1", "Neu"));
    await saving;

    expect(ids(store)).toEqual(["r2"]);
  });

  it("vorgemerkt: local, nur die Vormerkung", async () => {
    const store = useRecipeStore();
    idb.pending = [{ recipe: newRecipe(), sub: "user-a" }];
    store.recipes = [newRecipe()];
    store.pendingIds = ["lokal-1"];

    const result = await store.setRecipe({
      ...newRecipe(),
      recipe_name: "Birnenkuchen",
    });

    expect(result).toEqual({ status: "local" });
    expect(recipeApi.update).not.toHaveBeenCalled();
    expect(pending()[0].name).toBe("Birnenkuchen");
    expect(store.recipes[0].recipe_name).toBe("Birnenkuchen");
  });

  it("Tags: PUT nur mit Tags (Listenzeile ohne Zutaten), Liste danach", async () => {
    const store = useRecipeStore();
    const row = { ...saved(), ingredients: [] } as Recipe; // Listenzeile
    store.recipes = [row];

    const result = await store.setRecipeTags("r1", ["Kuchen", "Herbst"]);

    expect(result.status).toBe("saved");
    expect(recipeApi.update).toHaveBeenCalledWith("r1", {
      tags: ["Kuchen", "Herbst"],
    });
    expect(store.recipes[0].tags).toEqual(["Kuchen", "Herbst"]);
    // Detail-Cache aus der Serverantwort, nicht aus der Listenzeile
    expect(writeRecipeDetail).toHaveBeenCalledWith(
      expect.objectContaining({ recipe_uuid: "r1", recipe_name: "Neu" }),
    );
  });

  it("Tags gescheitert: Liste unverändert", async () => {
    vi.mocked(recipeApi.update).mockRejectedValue(new ApiError(403, ""));
    const store = useRecipeStore();
    store.recipes = [saved()];

    const result = await store.setRecipeTags("r1", ["Kuchen", "Herbst"]);

    expect(result.status).toBe("failed");
    expect(store.recipes[0].tags).toEqual(["Kuchen"]);
  });

  it("Tags eines vorgemerkten Rezepts: vollständiges Rezept in der Vormerkung", async () => {
    const store = useRecipeStore();
    const full = {
      ...newRecipe(),
      ingredients: [{ name: "Mehl" }],
    } as unknown as Recipe;
    idb.pending = [{ recipe: full, sub: "user-a" }];
    store.recipes = [full];
    store.pendingIds = ["lokal-1"];

    expect(await store.setRecipeTags("lokal-1", ["Kuchen"])).toEqual({
      status: "local",
    });

    const entry = (idb.pending as PendingCreate[])[0].recipe;
    expect(entry.tags).toEqual(["Kuchen"]);
    expect(entry.ingredients).toHaveLength(1);
  });
});

describe("recipeStore: gelöschte vorgemerkte Rezepte kehren nicht zurück", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    session("valid");
    idb.pending = [{ recipe: newRecipe(), sub: "user-a" }];
    vi.mocked(writeRecipes).mockResolvedValue(undefined);
    vi.mocked(currentUserSub).mockResolvedValue("user-a");
    vi.mocked(readPendingCreates).mockImplementation(async () =>
      structuredClone((idb.pending ?? []) as PendingCreate[]),
    );
    vi.mocked(recipeApi.delete).mockResolvedValue(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  function storeWithPending() {
    const store = useRecipeStore();
    store.recipes = [newRecipe()];
    store.pendingIds = ["lokal-1"];
    return store;
  }
  const entries = () => (idb.pending ?? []) as PendingCreate[];

  it("Abruf zwischen Ausblenden und DELETE: kein Geist", async () => {
    const store = storeWithPending();
    const answer = deferred<void>();
    vi.mocked(recipeApi.delete).mockReturnValueOnce(answer.promise);

    const deleting = store.deleteRecipe("lokal-1");
    await vi.waitFor(() => expect(recipeApi.delete).toHaveBeenCalled());
    // Der Server hat es schon (Übertragung); der Abruf beginnt nach dem
    // Ausblenden und endet vor der Antwort auf das DELETE
    vi.mocked(recipeApi.listAll).mockResolvedValueOnce([
      listItem("alt"),
      listItem("lokal-1"),
    ]);
    await store.loadRecipesFromApi();
    expect(ids(store)).toEqual(["alt"]);

    // Ein Abruf, der vor der Antwort beginnt und danach endet
    const late = deferred<RecipeListItem[]>();
    vi.mocked(recipeApi.listAll).mockReturnValueOnce(late.promise);
    const lateLoad = store.loadRecipesFromApi();
    answer.resolve();
    expect(await deleting).toEqual({ status: "deleted" });
    late.resolve([listItem("alt"), listItem("lokal-1")]);
    await lateLoad;

    expect(ids(store)).toEqual(["alt"]);
    expect(entries()).toEqual([]);
  });

  it("DELETE scheitert: bleibt als Löschung vorgemerkt, nächste Übertragung wiederholt", async () => {
    const store = storeWithPending();
    vi.mocked(recipeApi.delete).mockRejectedValueOnce(new ApiError(503, ""));

    expect(await store.deleteRecipe("lokal-1")).toEqual({ status: "deleted" });
    expect(entries()).toHaveLength(1);
    expect(entries()[0].deleted).toBe(true);

    // Abruf: Der Server liefert es, die Liste zeigt es nicht
    vi.mocked(recipeApi.listAll).mockResolvedValue([
      listItem("alt"),
      listItem("lokal-1"),
    ]);
    await store.loadRecipesFromApi();
    expect(ids(store)).toEqual(["alt"]);
    expect(store.pendingIds).toEqual([]);

    // Übertragung: DELETE erneut, kein POST, Markierung weg
    await store.transferPending();
    expect(recipeApi.delete).toHaveBeenCalledTimes(2);
    expect(recipeApi.create).not.toHaveBeenCalled();
    expect(entries()).toEqual([]);
  });

  it("offline gelöscht: DELETE beim nächsten Online-Laden, 404 erledigt", async () => {
    session("offline");
    const store = storeWithPending();

    expect(await store.deleteRecipe("lokal-1")).toEqual({ status: "deleted" });
    expect(recipeApi.delete).not.toHaveBeenCalled();
    expect(ids(store)).toEqual([]);

    session("valid");
    vi.mocked(recipeApi.delete).mockRejectedValue(new ApiError(404, "weg"));
    await store.transferPending();
    expect(recipeApi.delete).toHaveBeenCalledWith("lokal-1");
    expect(recipeApi.create).not.toHaveBeenCalled();
    expect(entries()).toEqual([]);
  });

  it("abgelehntes Rezept: sofort entfernt, kein DELETE", async () => {
    idb.pending = [{ recipe: newRecipe(), sub: "user-a", rejected: 409 }];
    const store = storeWithPending();

    expect(await store.deleteRecipe("lokal-1")).toEqual({ status: "deleted" });

    expect(recipeApi.delete).not.toHaveBeenCalled();
    expect(entries()).toEqual([]);
  });

  it("während der eigenen Übertragung gelöscht: erst die Übertragung sendet DELETE", async () => {
    const store = storeWithPending();
    const created = deferred<RecipeDetail>();
    vi.mocked(recipeApi.create).mockReturnValueOnce(created.promise);

    const transfer = store.transferPending();
    await vi.waitFor(() => expect(recipeApi.create).toHaveBeenCalled());
    expect(await store.deleteRecipe("lokal-1")).toEqual({ status: "deleted" });
    // Kein DELETE, solange offen ist, ob die ID eigen oder fremd ist
    expect(recipeApi.delete).not.toHaveBeenCalled();
    expect(entries()[0]?.deleted).toBe(true);
    created.resolve(detail("lokal-1"));
    await transfer;

    expect(recipeApi.delete).toHaveBeenCalledTimes(1);
    expect(entries()).toEqual([]);
    expect(ids(store)).toEqual([]);
  });

  it("ungültiger Index: failed, keine Anfrage", async () => {
    const store = storeWithPending();

    const result = await store.deleteRecipe(5);

    expect(result.status).toBe("failed");
    expect(recipeApi.delete).not.toHaveBeenCalled();
    expect(ids(store)).toEqual(["lokal-1"]);
  });
});

describe("recipeStore.localStatus: Kennzeichnung", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    idb.pending = undefined;
    vi.mocked(writeRecipes).mockResolvedValue(undefined);
    vi.mocked(currentUserSub).mockResolvedValue("user-a");
    vi.mocked(readPendingCreates).mockImplementation(async () =>
      structuredClone((idb.pending ?? []) as PendingCreate[]),
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("vorgemerkt → abgelehnt → bearbeitet → übertragen, ohne Neuladen", async () => {
    session("offline");
    const store = useRecipeStore();
    await store.appendRecipe(newRecipe());
    expect(store.localStatus("lokal-1")).toBe("pending");
    expect(store.localStatus("anderes")).toBeNull();

    session("valid");
    vi.mocked(recipeApi.create).mockRejectedValueOnce(new ApiError(403, ""));
    await store.transferPending();
    expect(store.localStatus("lokal-1")).toBe("rejected");

    await store.setRecipe({ ...newRecipe(), recipe_name: "Birnenkuchen" });
    expect(store.localStatus("lokal-1")).toBe("pending");

    vi.mocked(recipeApi.create).mockResolvedValueOnce(
      detail("lokal-1", "Birnenkuchen"),
    );
    await store.transferPending();
    expect(store.localStatus("lokal-1")).toBeNull();
  });

  it("abgelehnt aus der Vormerkung nach Neustart", async () => {
    idb.pending = [{ recipe: newRecipe(), sub: "user-a", rejected: 403 }];
    session("offline");
    vi.mocked(readRecipes).mockResolvedValue([]);
    vi.mocked(readSettings).mockResolvedValue(undefined);
    vi.mocked(readFavorites).mockResolvedValue(undefined);
    const store = useRecipeStore();

    await store.loadAll();

    expect(store.localStatus("lokal-1")).toBe("rejected");
  });
});

describe("W.38: Listenzeile nie als data speichern", () => {
  const full = (id = "r1") =>
    ({
      ...newRecipe(),
      recipe_uuid: id,
      ingredients: [{ name: "Mehl", amounts: [], section: "" }],
      steps: [{ step: "Backen", section: "" }],
    }) as unknown as Recipe;

  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    idb.pending = undefined;
    session("valid");
    vi.mocked(writeRecipes).mockResolvedValue(undefined);
    vi.mocked(readSettings).mockResolvedValue(undefined);
    vi.mocked(readFavorites).mockResolvedValue(undefined);
    vi.mocked(readRecipeDetail).mockResolvedValue(undefined);
    vi.mocked(currentUserSub).mockResolvedValue("user-a");
    vi.mocked(readPendingCreates).mockImplementation(async () =>
      structuredClone((idb.pending ?? []) as PendingCreate[]),
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("setRecipe lehnt eine Listenzeile ab: failed, kein PUT, Liste unverändert", async () => {
    const store = useRecipeStore();
    const row = listItemToRecipe(listItem("r1"));
    store.recipes = [row];

    const result = await store.setRecipe({ ...row, recipe_name: "Neu" });

    expect(result.status).toBe("failed");
    expect(result.status === "failed" && result.error).toBeInstanceOf(
      IncompleteRecipeError,
    );
    expect(recipeApi.update).not.toHaveBeenCalled();
    expect(writeRecipeDetail).not.toHaveBeenCalled();
    expect(store.recipes[0].recipe_name).toBe("r1");
  });

  it("appendRecipe lehnt eine Listenzeile ab (Duplikat wäre leer)", async () => {
    const store = useRecipeStore();
    const copy = { ...listItemToRecipe(listItem("r1")), recipe_uuid: "neu" };

    const result = await store.appendRecipe(copy);

    expect(result.status).toBe("failed");
    expect(result.status === "failed" && result.error).toBeInstanceOf(
      IncompleteRecipeError,
    );
    expect(appendFailedMessage(new IncompleteRecipeError())).toBe(
      "Rezept nicht angelegt: Rezept nicht vollständig geladen.",
    );
    expect(recipeApi.create).not.toHaveBeenCalled();
    expect(idb.pending).toBeUndefined();
  });

  it("Listen-Cache nach Neustart: Listenzeilen gesperrt, Vorgemerktes nicht", async () => {
    // Im Cache ohne Kennzeichen; das Vorgemerkte hat hier keine Zutaten
    idb.pending = [{ recipe: newRecipe(), sub: "user-a" }];
    const { listOnly: _lo, ...row } = listItemToRecipe(listItem("r1"));
    vi.mocked(readRecipes).mockResolvedValue([row, full("voll"), newRecipe()]);
    session("offline");
    const store = useRecipeStore();

    await store.loadAll();

    const flag = (id: string) =>
      store.recipes.find((r) => r.recipe_uuid === id)?.listOnly;
    expect(flag("r1")).toBe(true);
    expect(flag("voll")).toBeUndefined();
    expect(flag("lokal-1")).toBeUndefined();

    session("valid");
    const cachedRow = store.recipes.find((r) => r.recipe_uuid === "r1")!;
    expect((await store.setRecipe(cachedRow)).status).toBe("failed");
    expect(recipeApi.update).not.toHaveBeenCalled();
    // Vorgemerktes bleibt bearbeitbar
    const local = store.recipes.find((r) => r.recipe_uuid === "lokal-1")!;
    expect((await store.setRecipe({ ...local, recipe_name: "X" })).status).toBe(
      "local",
    );
  });

  it("vorläufige Cache-Daten beim Start sind ebenfalls gekennzeichnet", async () => {
    const { listOnly: _lo, ...row } = listItemToRecipe(listItem("r1"));
    vi.mocked(readRecipes).mockResolvedValue([row]);
    const store = useRecipeStore();

    await store.showCachedData();

    expect(store.recipes[0].listOnly).toBe(true);
  });

  it("loadCompleteRecipe: API, sonst Detail-Cache, nie die Listenzeile", async () => {
    const store = useRecipeStore();
    const row = listItemToRecipe(listItem("r1"));

    vi.mocked(recipeApi.get).mockResolvedValueOnce(
      detail("r1", "Voll", "USER-A", { ingredients: [{ name: "Mehl" }] }),
    );
    const fromApi = await store.loadCompleteRecipe(row);
    expect(fromApi?.listOnly).toBeUndefined();
    expect(fromApi?.ingredients).toHaveLength(1);

    vi.mocked(recipeApi.get).mockRejectedValue(new ApiError(503, ""));
    vi.mocked(readRecipeDetail).mockResolvedValueOnce(full());
    expect((await store.loadCompleteRecipe(row))?.steps).toHaveLength(1);

    // Kein Cache bzw. ein leerer (früher gespeicherte Listenzeile): null
    expect(await store.loadCompleteRecipe(row)).toBeNull();
    vi.mocked(readRecipeDetail).mockResolvedValueOnce(newRecipe());
    expect(await store.loadCompleteRecipe(row)).toBeNull();

    // Vollständig bzw. vorgemerkt ohne Zutaten: unverändert
    const complete = full();
    expect(await store.loadCompleteRecipe(complete)).toBe(complete);
    const local = newRecipe();
    expect(await store.loadCompleteRecipe(local)).toBe(local);
  });
});

describe("W.38: Löschen während der Übertragung", () => {
  const entries = () => (idb.pending ?? []) as PendingCreate[];
  const other = () => ({ ...newRecipe(), recipe_uuid: "lokal-0" });

  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    session("valid");
    vi.mocked(writeRecipes).mockResolvedValue(undefined);
    vi.mocked(currentUserSub).mockResolvedValue("user-a");
    vi.mocked(readPendingCreates).mockImplementation(async () =>
      structuredClone((idb.pending ?? []) as PendingCreate[]),
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("vor seiner Anlage gelöscht (GET 404): kein DELETE, kein POST, kommt nicht zurück", async () => {
    idb.pending = [
      { recipe: other(), sub: "user-a" },
      { recipe: newRecipe(), sub: "user-a" },
    ];
    const store = useRecipeStore();
    store.recipes = [other(), newRecipe()];
    store.pendingIds = ["lokal-0", "lokal-1"];
    const first = deferred<RecipeDetail>();
    vi.mocked(recipeApi.create).mockReturnValueOnce(first.promise);
    vi.mocked(recipeApi.get).mockRejectedValue(new ApiError(404, ""));
    vi.mocked(recipeApi.delete).mockRejectedValue(new ApiError(404, ""));

    // Der Lauf hängt am ersten Rezept; das zweite wird gelöscht (GET 404,
    // entfernt, ohne DELETE)
    const transfer = store.transferPending();
    await vi.waitFor(() => expect(recipeApi.create).toHaveBeenCalledTimes(1));
    expect(await store.deleteRecipe("lokal-1")).toEqual({ status: "deleted" });
    expect(entries().map((e) => e.recipe.recipe_uuid)).toEqual(["lokal-0"]);
    // Ein nachgesendetes DELETE würde jetzt scheitern
    vi.mocked(recipeApi.delete).mockRejectedValue(new ApiError(503, ""));
    first.resolve(detail("lokal-0"));
    await transfer;

    expect(recipeApi.delete).not.toHaveBeenCalled();
    expect(recipeApi.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(recipeApi.create).mock.calls[0][0]).toBe("lokal-0");
    vi.mocked(recipeApi.listAll).mockResolvedValue([listItem("lokal-0")]);
    await store.loadRecipesFromApi();
    expect(ids(store)).toEqual(["lokal-0"]);
  });

  it("während seiner Anlage gelöscht, DELETE der Übertragung scheitert: bleibt vorgemerkt", async () => {
    idb.pending = [{ recipe: newRecipe(), sub: "user-a" }];
    const store = useRecipeStore();
    store.recipes = [newRecipe()];
    store.pendingIds = ["lokal-1"];
    const created = deferred<RecipeDetail>();
    vi.mocked(recipeApi.create).mockReturnValueOnce(created.promise);
    vi.mocked(recipeApi.delete).mockRejectedValue(new ApiError(503, ""));

    const transfer = store.transferPending();
    await vi.waitFor(() => expect(recipeApi.create).toHaveBeenCalled());
    await store.deleteRecipe("lokal-1");
    created.resolve(detail("lokal-1"));
    await transfer;

    expect(recipeApi.delete).toHaveBeenCalledTimes(1);
    expect(entries()).toHaveLength(1);
    expect(entries()[0].deleted).toBe(true);
    // Der Server hat es; die Liste zeigt es trotzdem nicht
    vi.mocked(recipeApi.listAll).mockResolvedValue([listItem("lokal-1")]);
    await store.loadRecipesFromApi();
    expect(ids(store)).toEqual([]);
    // Die Übertragung wusste, dass es eigen ist: kein GET
    expect(recipeApi.get).not.toHaveBeenCalled();
    // Nächste Übertragung: Ersteller-Abgleich, DELETE erneut, erledigt
    vi.mocked(recipeApi.get).mockResolvedValue(detail("lokal-1"));
    vi.mocked(recipeApi.delete).mockResolvedValue(undefined);
    await store.transferPending();
    expect(recipeApi.delete).toHaveBeenCalledTimes(2);
    expect(entries()).toEqual([]);
  });
});

describe("W.38: fremdes 409", () => {
  const entries = () => (idb.pending ?? []) as PendingCreate[];

  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    session("valid");
    idb.pending = [{ recipe: newRecipe(), sub: "user-a" }];
    vi.mocked(writeRecipes).mockResolvedValue(undefined);
    vi.mocked(currentUserSub).mockResolvedValue("user-a");
    vi.mocked(readPendingCreates).mockImplementation(async () =>
      structuredClone((idb.pending ?? []) as PendingCreate[]),
    );
    vi.mocked(recipeApi.create).mockRejectedValue(new ApiError(409, ""));
    vi.mocked(recipeApi.get).mockResolvedValue(
      detail("lokal-1", "Fremd", "user-b"),
    );
    vi.mocked(recipeApi.delete).mockResolvedValue(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("Admin: nach Bearbeitung weiter abgelehnt, keine neue Übertragung, Löschen ohne DELETE", async () => {
    const store = useRecipeStore();
    store.settings = { role: "admin", read_only: false, expert_mode: false };
    store.userSub = "user-a";
    store.recipes = [newRecipe()];
    store.pendingIds = ["lokal-1"];

    await store.transferPending();
    expect(entries()[0]).toMatchObject({ rejected: 409, foreign: true });
    expect(store.localStatus("lokal-1")).toBe("rejected");

    const saved = await store.setRecipe({ ...newRecipe(), recipe_name: "Neu" });
    expect(saved).toEqual({ status: "local", stillRejected: true });
    expect(entries()[0]).toMatchObject({ rejected: 409, foreign: true });
    expect(entries()[0].recipe.recipe_name).toBe("Neu");
    expect(store.localStatus("lokal-1")).toBe("rejected");

    await store.transferPending();
    expect(recipeApi.create).toHaveBeenCalledTimes(1);

    expect(store.canDelete(store.recipes[0])).toBe(true);
    expect(await store.deleteRecipe("lokal-1")).toEqual({ status: "deleted" });
    expect(recipeApi.delete).not.toHaveBeenCalled();
    expect(entries()).toEqual([]);
  });

  it("Altbestand rejected 409 ohne Feld: Bearbeitung hebt nicht auf, kein DELETE", async () => {
    idb.pending = [{ recipe: newRecipe(), sub: "user-a", rejected: 409 }];
    const store = useRecipeStore();
    store.recipes = [newRecipe()];
    store.pendingIds = ["lokal-1"];
    store.rejectedIds = ["lokal-1"];

    await store.setRecipe({ ...newRecipe(), recipe_name: "Neu" });
    expect(entries()[0].rejected).toBe(409);
    expect(store.localStatus("lokal-1")).toBe("rejected");

    await store.deleteRecipe("lokal-1");
    expect(recipeApi.delete).not.toHaveBeenCalled();
  });

  it("Admin löscht während der Übertragung, Server meldet fremdes 409: nie DELETE", async () => {
    const store = useRecipeStore();
    store.settings = { role: "admin", read_only: false, expert_mode: false };
    store.recipes = [newRecipe()];
    store.pendingIds = ["lokal-1"];
    const conflict = deferred<RecipeDetail>();
    vi.mocked(recipeApi.create).mockReturnValueOnce(
      conflict.promise.then(() => Promise.reject(new ApiError(409, ""))),
    );

    const transfer = store.transferPending();
    await vi.waitFor(() => expect(recipeApi.create).toHaveBeenCalled());
    await store.deleteRecipe("lokal-1");
    conflict.resolve(detail("lokal-1"));
    await transfer;
    // Nächste Übertragung räumt die Löschung ohne DELETE ab
    await store.transferPending();

    expect(recipeApi.delete).not.toHaveBeenCalled();
    expect(entries()).toEqual([]);
  });
});

describe("W.41: Ersteller-Abgleich vor dem DELETE", () => {
  const entries = () => (idb.pending ?? []) as PendingCreate[];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(recipeApi.get).mockReset();
    vi.mocked(recipeApi.delete).mockReset();
    vi.mocked(recipeApi.delete).mockResolvedValue(undefined);
    setActivePinia(createPinia());
    session("valid");
    idb.pending = [{ recipe: newRecipe(), sub: "user-a" }];
    vi.mocked(writeRecipes).mockResolvedValue(undefined);
    vi.mocked(currentUserSub).mockResolvedValue("user-a");
    vi.mocked(readPendingCreates).mockImplementation(async () =>
      structuredClone((idb.pending ?? []) as PendingCreate[]),
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  function pendingStore(role: "editor" | "admin" = "editor") {
    const store = useRecipeStore();
    store.settings = { role, read_only: false, expert_mode: false };
    store.userSub = "user-a";
    store.recipes = [newRecipe()];
    store.pendingIds = ["lokal-1"];
    return store;
  }

  it("404: Eintrag entfernt, kein DELETE", async () => {
    const store = pendingStore();
    vi.mocked(recipeApi.get).mockRejectedValue(new ApiError(404, ""));

    expect(await store.deleteRecipe("lokal-1")).toEqual({ status: "deleted" });

    expect(recipeApi.get).toHaveBeenCalledWith("lokal-1");
    expect(recipeApi.delete).not.toHaveBeenCalled();
    expect(entries()).toEqual([]);
  });

  it("eigener Ersteller (verlorene Antwort): DELETE", async () => {
    const store = pendingStore();
    vi.mocked(recipeApi.get).mockResolvedValue(detail("lokal-1"));

    await store.deleteRecipe("lokal-1");

    expect(recipeApi.delete).toHaveBeenCalledWith("lokal-1");
    expect(entries()).toEqual([]);
  });

  it("Admin, fremder Ersteller ohne Markierung: Eintrag entfernt, nie DELETE, fremdes Rezept bleibt sichtbar", async () => {
    const store = pendingStore("admin");
    vi.mocked(recipeApi.get).mockResolvedValue(
      detail("lokal-1", "Fremd", "user-b"),
    );

    expect(await store.deleteRecipe("lokal-1")).toEqual({ status: "deleted" });

    expect(recipeApi.delete).not.toHaveBeenCalled();
    expect(entries()).toEqual([]);
    // Das Serverrezept gehört einem anderen; ein neuer Abruf zeigt es
    vi.mocked(recipeApi.listAll).mockResolvedValue([listItem("lokal-1")]);
    await store.loadRecipesFromApi();
    expect(ids(store)).toEqual(["lokal-1"]);
  });

  it("Ausfall beim GET: Markierung bleibt, kein DELETE; nächste Übertragung prüft erneut", async () => {
    const store = pendingStore("admin");
    vi.mocked(recipeApi.get).mockRejectedValue(new ApiError(503, ""));

    await store.deleteRecipe("lokal-1");

    expect(recipeApi.delete).not.toHaveBeenCalled();
    expect(entries()).toHaveLength(1);
    expect(entries()[0].deleted).toBe(true);

    // Nächste Übertragung: Server erreichbar, ID fremd → nie DELETE
    vi.mocked(recipeApi.get).mockResolvedValue(
      detail("lokal-1", "Fremd", "user-b"),
    );
    await store.transferPending();
    expect(recipeApi.delete).not.toHaveBeenCalled();
    expect(recipeApi.create).not.toHaveBeenCalled();
    expect(entries()).toEqual([]);
  });

  it("ohne angemeldeten Nutzer nicht entscheidbar: Markierung bleibt", async () => {
    const store = pendingStore();
    vi.mocked(currentUserSub).mockResolvedValue(null);

    await store.deleteRecipe("lokal-1");

    expect(recipeApi.delete).not.toHaveBeenCalled();
    expect(entries()[0].deleted).toBe(true);
  });
});
