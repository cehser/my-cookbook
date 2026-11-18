import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import type { Recipe } from "@/types/recipe";
import { canEdit } from "@/auth/role";
import type { Settings } from "@/types/settings";

const { store, push, toast, current } = vi.hoisted(() => ({
  store: {
    settings: {} as Settings,
    favorites: [] as string[],
    recipes: [] as Recipe[],
    canEdit: false,
    canDelete: (() => false) as (r: Recipe) => boolean,
    localStatus: (() => null) as (id: string) => "pending" | "rejected" | null,
    deleteRecipe: vi.fn(),
    addFavorite: vi.fn(),
    removeFavorite: vi.fn(),
  },
  push: vi.fn(),
  toast: vi.fn(),
  current: {
    recipe_uuid: "r1",
    recipe_name: "Apfelkuchen",
  } as Recipe,
}));

vi.mock("@/store/recipeStore", () => ({ useRecipeStore: () => store }));
vi.mock("@/store/uiStore", () => ({
  useUIStore: () => ({
    restoreUIState: vi.fn(),
    recipe: { keepAwake: true },
    setRecipeKeepAwake: vi.fn(),
  }),
}));
vi.mock("@/composables/useToast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/composables/useRecentRecipes", () => ({
  useRecentRecipes: () => ({ trackRecipe: vi.fn() }),
}));
vi.mock("@/composables/useRecipeHelper", () => ({
  useRecipeHelper: () => ({
    current_recipe: ref(current),
    picture_src: ref(""),
  }),
}));
vi.mock("vue-router", () => ({ useRouter: () => ({ push, back: vi.fn() }) }));

import { ApiError } from "@/api/client";
import RecipeView from "./Recipe.vue";

function render(settings: Settings, canDelete = false) {
  store.settings = settings;
  store.canEdit = canEdit(settings.role);
  store.canDelete = () => canDelete;
  return mount(RecipeView, {
    props: { id: "r1" },
    global: {
      stubs: {
        RecipeDisplay: { template: "<div />" },
        ShareManager: true,
        SourceImages: true,
      },
    },
  });
}

const starButton = (w: ReturnType<typeof render>) =>
  w.find("button[title='Zu Favoriten hinzufügen']");
const button = (w: ReturnType<typeof render>, text: string) =>
  w.findAll("button").find((b) => b.text().includes(text));

async function openMenu(w: ReturnType<typeof render>) {
  await w.find("button[title='Menü']").trigger("click");
}

describe("Recipe: Stern und Löschen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", () => true);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("readonly: Stern ja, Menü mit „Bildschirm anlassen“ ohne Bearbeiten", async () => {
    const w = render({ role: "readonly" });
    expect(starButton(w).exists()).toBe(true);
    await starButton(w).trigger("click");
    expect(store.addFavorite).toHaveBeenCalledWith("r1");

    await openMenu(w);
    expect(w.text()).toContain("Bildschirm anlassen");
    for (const text of [
      "Bearbeiten",
      "Duplizieren",
      "Teilen",
      "Als Datei exportieren",
      "Löschen",
    ]) {
      expect(button(w, text), text).toBeUndefined();
    }
  });

  it("Editor: Bearbeiten-Einträge samt Datei-Export ohne Schalter", async () => {
    const w = render({ role: "editor" });
    await openMenu(w);
    for (const text of [
      "Bearbeiten",
      "Duplizieren",
      "Teilen",
      "Als Datei exportieren",
    ]) {
      expect(button(w, text), text).toBeDefined();
    }
  });

  it("Editor ohne Löschrecht: Menü ohne „Löschen“", async () => {
    const w = render({ role: "editor" });
    await openMenu(w);
    expect(button(w, "Bearbeiten")).toBeDefined();
    expect(button(w, "Löschen")).toBeUndefined();
  });

  it("Löschen gescheitert: Meldung, bleibt auf der Seite", async () => {
    store.deleteRecipe.mockResolvedValue({
      status: "failed",
      error: new ApiError(403, ""),
    });
    const w = render({ role: "editor" }, true);
    await openMenu(w);
    await button(w, "Löschen")!.trigger("click");
    await flushPromises();

    expect(store.deleteRecipe).toHaveBeenCalledWith("r1");
    expect(toast).toHaveBeenCalledWith(
      "Rezept nicht gelöscht: keine Berechtigung.",
      "danger",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("Löschen erfolgreich: zurück zur Übersicht", async () => {
    store.deleteRecipe.mockResolvedValue({ status: "deleted" });
    const w = render({ role: "admin" }, true);
    await openMenu(w);
    await button(w, "Löschen")!.trigger("click");
    await flushPromises();

    expect(push).toHaveBeenCalledWith("/");
    expect(toast).not.toHaveBeenCalled();
  });
});

describe("Recipe: Kennzeichnung und Listenzeile", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    store.localStatus = () => null;
    delete current.listOnly;
  });

  it("gibt store.localStatus an die Rezeptansicht", () => {
    store.localStatus = (id) => (id === "r1" ? "rejected" : null);
    store.settings = { role: "editor" };
    const w = mount(RecipeView, {
      props: { id: "r1" },
      global: {
        stubs: {
          RecipeDisplay: {
            name: "RecipeDisplay",
            props: ["recipe", "imageSrc", "localStatus"],
            template: "<div />",
          },
          ShareManager: true,
          SourceImages: true,
        },
      },
    });
    expect(
      w.findComponent({ name: "RecipeDisplay" }).props("localStatus"),
    ).toBe("rejected");
  });

  it("Datei-Export einer Listenzeile: Meldung, keine Datei", async () => {
    current.listOnly = true;
    const w = render({ role: "editor" });
    await openMenu(w);
    await button(w, "Als Datei exportieren")!.trigger("click");

    expect(toast).toHaveBeenCalledWith(
      "Rezept nicht exportiert: nicht vollständig geladen.",
      "danger",
    );
  });
});
