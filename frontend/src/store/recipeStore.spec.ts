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

import { api, ApiError } from "@/api/client";
import {
  recipeApi,
  type RecipeDetail,
  type RecipeListItem,
} from "@/api/recipes";
import { imageApi, type ImageInfo } from "@/api/images";
import {
  readFavorites,
  readRecipes,
  readPendingCreates,
  readSettings,
  writePendingCreates,
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
    expect(store.transferReport).toEqual({ transferred: 1, rejected: [] });

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
    await store.setRecipe({
      index,
      recipe: { ...store.recipes[index], recipe_name: "Neu" },
    });
    expect(pending()[0].rejected).toBeUndefined();
  });

  it("Bearbeiten: aktualisiert die Vormerkung, kein PUT", async () => {
    const store = await createOfflineAndRestart();
    session("valid");
    store.recipes = [newRecipe()];

    await store.setRecipe({
      index: 0,
      recipe: { ...newRecipe(), recipe_name: "Birnenkuchen" },
    });

    expect(recipeApi.update).not.toHaveBeenCalled();
    expect(pending()).toEqual([
      { uuid: "lokal-1", name: "Birnenkuchen", rejected: undefined },
    ]);
    expect(store.recipes[0].recipe_name).toBe("Birnenkuchen");
  });

  it("Löschen: aus der Vormerkung, kein API-Aufruf, kommt nicht zurück", async () => {
    const store = await createOfflineAndRestart();
    session("valid");
    store.recipes = [newRecipe()];
    const running = deferred<RecipeListItem[]>();
    vi.mocked(recipeApi.listAll).mockReturnValueOnce(running.promise);
    const loading = store.loadRecipesFromApi(); // läuft schon

    await store.deleteRecipe("lokal-1");
    running.resolve([listItem("alt")]);
    await loading;

    expect(recipeApi.delete).not.toHaveBeenCalled();
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
    await store.setRecipe({
      index,
      recipe: { ...store.recipes[index], ...change },
    });
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
    expect(store.transferReport).toEqual({ transferred: 1, rejected: [] });
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
    await store.setRecipe({
      index,
      recipe: { ...store.recipes[index], subtitle: "neu" },
    });
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
    await store.deleteRecipe("lokal-1");
    expect(recipeApi.delete).not.toHaveBeenCalled(); // vorgemerkt: lokal
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
    await store.setRecipe({ index: 0, recipe: store.recipes[0] });
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
      index,
      recipe: { ...store.recipes[index], recipe_name: "Birnenkuchen" },
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
      index,
      recipe: { ...store.recipes[index], recipe_name: "Birnenkuchen" },
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
