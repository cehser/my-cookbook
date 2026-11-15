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
vi.mock("@/api/recipes", () => ({ recipeApi: {} }));
vi.mock("@/api/favorites", () => ({ favoritesApi: {} }));
vi.mock("@/api/images", () => ({ imageApi: {} }));
vi.mock("@/auth/session", () => ({
  ensureAuth: vi.fn(),
  isAuthenticated: vi.fn(),
}));

import { api } from "@/api/client";
import { writeSettings } from "@/js/offlineCache";
import { isAuthenticated } from "@/auth/session";
import { useRecipeStore } from "@/store/recipeStore";
import type { Settings } from "@/types/settings";

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
