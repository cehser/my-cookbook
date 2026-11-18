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

  it("Löschen: aus der Vormerkung, mit Sitzung DELETE (404 egal), kommt nicht zurück", async () => {
    const store = await createOfflineAndRestart();
    session("valid");
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
      index,
      recipe: { ...store.recipes[index], recipe_name: "Birnenkuchen" },
    });
    created.resolve(detail("lokal-1"));
    await loading;

    expect(recipeApi.update).toHaveBeenCalledTimes(1);
    expect(pending()).toEqual([]);
    expect(store.transferReport?.updateRejected).toHaveLength(1);
    expect(store.transferReport?.rejected).toEqual([]);
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

    await expect(
      store.setRecipe({ index, recipe: { ...store.recipes[index] } }),
    ).rejects.toBeInstanceOf(LocalReadError);
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
