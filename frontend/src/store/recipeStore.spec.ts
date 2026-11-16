import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

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
}));
vi.mock("@/api/client", () => ({
  api: { get: vi.fn(), put: vi.fn() },
  isClientError: vi.fn(() => false),
}));
vi.mock("@/api/recipes", () => ({
  recipeApi: { create: vi.fn(), listAll: vi.fn(), get: vi.fn() },
}));
vi.mock("@/api/favorites", () => ({ favoritesApi: {} }));
vi.mock("@/api/images", () => ({
  imageApi: { list: vi.fn(), upload: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/auth/session", () => ({
  ensureAuth: vi.fn(),
  isAuthenticated: vi.fn(),
  loginFollows: vi.fn(() => false),
}));

import { api, isClientError } from "@/api/client";
import {
  recipeApi,
  type RecipeDetail,
  type RecipeListItem,
} from "@/api/recipes";
import { imageApi, type ImageInfo } from "@/api/images";
import {
  readFavorites,
  readRecipes,
  readSettings,
  writeRecipes,
  writeSettings,
} from "@/js/offlineCache";
import { ensureAuth, isAuthenticated } from "@/auth/session";
import { useRecipeStore } from "@/store/recipeStore";
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

const detail = (id: string): RecipeDetail =>
  ({
    id,
    recipe_name: "Apfelkuchen",
    data: {},
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

describe("recipeStore.appendRecipe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    vi.mocked(isClientError).mockReturnValue(false);
    vi.mocked(writeRecipes).mockResolvedValue(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("angelegt: Ergebnis created, Rezept genau einmal in der Liste, ohne Neuladen", async () => {
    vi.mocked(recipeApi.create).mockResolvedValue(detail("srv-1"));
    vi.mocked(recipeApi.listAll).mockRejectedValue(new Error("Timeout"));
    const store = useRecipeStore();

    const result = await store.appendRecipe(newRecipe());

    expect(result).toEqual({ status: "created", detail: detail("srv-1") });
    expect(ids(store)).toEqual(["srv-1"]);
    expect(recipeApi.listAll).not.toHaveBeenCalled();
  });

  it("angelegt während eines laufenden Listenabrufs: bleibt, kein Duplikat", async () => {
    const store = useRecipeStore();
    const oldList = deferred<RecipeListItem[]>();
    vi.mocked(recipeApi.listAll).mockReturnValueOnce(oldList.promise);
    const loading = store.loadRecipesFromApi(); // begann vor dem Anlegen

    vi.mocked(recipeApi.create).mockResolvedValue(detail("srv-2"));
    await store.appendRecipe(newRecipe());
    oldList.resolve([listItem("alt")]);
    await loading;
    expect(ids(store)).toEqual(["alt", "srv-2"]);

    // Ein späterer Abruf enthält das Rezept: genau einmal
    vi.mocked(recipeApi.listAll).mockResolvedValueOnce([
      listItem("alt"),
      listItem("srv-2"),
    ]);
    await store.loadRecipesFromApi();
    expect(ids(store)).toEqual(["alt", "srv-2"]);
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

  it("offline: Ergebnis local, lokal gespeichert, keine Anfrage", async () => {
    vi.mocked(isAuthenticated).mockResolvedValue(false);
    const store = useRecipeStore();

    const result = await store.appendRecipe(newRecipe());

    expect(result).toEqual({ status: "local" });
    expect(recipeApi.create).not.toHaveBeenCalled();
    expect(ids(store)).toEqual(["lokal-1"]);
    expect(writeRecipes).toHaveBeenCalled();
  });

  it("Ausfall (Timeout, 5xx): Ergebnis local", async () => {
    vi.mocked(recipeApi.create).mockRejectedValue(new Error("503"));
    const store = useRecipeStore();

    expect(await store.appendRecipe(newRecipe())).toEqual({ status: "local" });
    expect(ids(store)).toEqual(["lokal-1"]);
  });

  it("4xx: Ergebnis failed, nichts lokal gespeichert", async () => {
    const error = new Error("403");
    vi.mocked(recipeApi.create).mockRejectedValue(error);
    vi.mocked(isClientError).mockReturnValue(true);
    const store = useRecipeStore();

    const result = await store.appendRecipe(newRecipe());

    expect(result).toEqual({ status: "failed", error });
    expect(store.recipes).toEqual([]);
    expect(writeRecipes).not.toHaveBeenCalled();
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
