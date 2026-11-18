import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import type { Recipe } from "@/types/recipe";
import type { Settings } from "@/types/settings";

const { store, toast, discardDraft, current } = vi.hoisted(() => ({
  store: {
    settings: {
      role: "editor",
      read_only: false,
      expert_mode: false,
    } as Settings,
    recipes: [] as Recipe[],
    setRecipe: vi.fn(),
    setRecipePicture: vi.fn(),
  },
  toast: vi.fn(),
  discardDraft: vi.fn(),
  current: { value: null as Recipe | null, loadFailed: false },
}));

vi.mock("@/store/recipeStore", () => ({ useRecipeStore: () => store }));
vi.mock("@/composables/useToast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/composables/useRecipeHelper", () => ({
  useRecipeHelper: () => {
    const current_recipe = ref(current.value);
    return {
      current_recipe,
      isLoaded: ref(true),
      loadFailed: ref(current.loadFailed),
      do_recalc: ref(false),
      selected: ref(0),
      picture_src: ref(""),
      yields_unit: ref(""),
      yields_value: ref(1),
      setYieldsUnit: vi.fn(),
      setYieldsValue: vi.fn(),
      loadRecipe: vi.fn(),
    };
  },
}));
vi.mock("@/composables/useDraft", () => ({
  useDraft: () => ({
    hasDraft: ref(false),
    restoreDraft: vi.fn(),
    discardDraft,
  }),
}));
// Geladen melden, ohne Entwurf wiederherzustellen
vi.mock("@/composables/useEditHistory", () => ({
  useEditHistory: (
    _source: unknown,
    _loaded: unknown,
    opts: { onLoaded?: () => void },
  ) => {
    opts.onLoaded?.();
    return {
      undo: vi.fn(),
      redo: vi.fn(),
      canUndo: ref(false),
      canRedo: ref(false),
      reset: vi.fn(),
    };
  },
}));
vi.mock("sortablejs", () => ({
  default: { create: () => ({ destroy() {} }) },
}));
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useRoute: () => ({ query: {} }),
}));

import { ApiError, OfflineError } from "@/api/client";
import { LOCAL_PENDING_TEXT, LOCAL_REJECTED_TEXT } from "@/js/appendFeedback";
import EditView from "./Edit.vue";

function render(over: Partial<Recipe> = {}, loadFailed = false) {
  current.loadFailed = loadFailed;
  current.value = {
    recipe_uuid: "r1",
    recipe_name: "Apfelkuchen",
    ingredients: [],
    steps: [],
    sections: [],
    ...over,
  } as unknown as Recipe;
  return mount(EditView, {
    props: { id: "r1" },
    global: {
      stubs: {
        SectionCard: true,
        RecipeDisplay: true,
        SourceImages: true,
        BModal: true,
      },
    },
  });
}

/** Ändern und speichern; liefert den Editor-Zustand danach. */
async function editAndSave(w: ReturnType<typeof render>) {
  const vm = w.vm as unknown as { current_recipe: Recipe };
  vm.current_recipe.recipe_name = "Birnenkuchen";
  await flushPromises();
  await w.find("button[aria-label='Speichern']").trigger("click");
  await flushPromises();
}

const saveButton = (w: ReturnType<typeof render>) =>
  w.find("button[aria-label='Speichern']");

describe("Edit: Speichern meldet ehrlich", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Erfolg: „Gespeichert.“, Entwurf verworfen, nicht mehr geändert", async () => {
    store.setRecipe.mockResolvedValue({ status: "saved" });
    const w = render();

    await editAndSave(w);

    expect(store.setRecipe).toHaveBeenCalledWith(
      expect.objectContaining({ recipe_name: "Birnenkuchen" }),
    );
    expect(toast).toHaveBeenCalledWith("Gespeichert.", "success");
    expect(discardDraft).toHaveBeenCalled();
    expect(saveButton(w).attributes("disabled")).toBeDefined();
  });

  it.each([
    [new ApiError(403, ""), "Rezept nicht gespeichert: keine Berechtigung."],
    [
      new OfflineError(),
      "Rezept nicht gespeichert: keine Verbindung zum Server.",
    ],
    [
      new ApiError(401, "Sitzung abgelaufen"),
      "Rezept nicht gespeichert: Bitte neu anmelden.",
    ],
  ])(
    "gescheitert (%s): kein „Gespeichert“, Entwurf bleibt, weiter geändert",
    async (error, message) => {
      store.setRecipe.mockResolvedValue({ status: "failed", error });
      const w = render();

      await editAndSave(w);

      expect(toast).toHaveBeenCalledWith(message, "danger");
      expect(toast).not.toHaveBeenCalledWith("Gespeichert.", "success");
      expect(discardDraft).not.toHaveBeenCalled();
      expect(saveButton(w).attributes("disabled")).toBeUndefined();
    },
  );

  it("vorgemerktes Rezept: Hinweis „auf diesem Gerät“", async () => {
    store.setRecipe.mockResolvedValue({ status: "local" });
    const w = render();

    await editAndSave(w);

    expect(toast).toHaveBeenCalledWith(LOCAL_PENDING_TEXT, "warning");
    expect(discardDraft).toHaveBeenCalled();
  });

  it("fremd abgelehntes Rezept: „abgelehnt“, nicht „wird übertragen“", async () => {
    store.setRecipe.mockResolvedValue({ status: "local", stillRejected: true });
    const w = render();

    await editAndSave(w);

    expect(toast).toHaveBeenCalledWith(LOCAL_REJECTED_TEXT, "warning");
    expect(toast).not.toHaveBeenCalledWith(LOCAL_PENDING_TEXT, "warning");
    expect(LOCAL_REJECTED_TEXT).toContain("abgelehnt");
    expect(LOCAL_REJECTED_TEXT).toContain("Nur auf diesem Gerät");
    expect(LOCAL_REJECTED_TEXT).not.toContain("wird beim nächsten");
    expect(discardDraft).toHaveBeenCalled();
  });
});

describe("Edit: Detail nicht ladbar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Listenzeile: Meldung statt Editor, Speichern gesperrt, kein setRecipe", async () => {
    const w = render({ listOnly: true }, true);
    await flushPromises();

    expect(w.text()).toContain("Rezept konnte nicht geladen werden");
    expect(w.find("input").exists()).toBe(false);
    expect(saveButton(w).attributes("disabled")).toBeDefined();

    // Strg+S umgeht den Knopf: auch dann kein Speichern
    (w.vm as unknown as { saveRecipe: () => void }).saveRecipe();
    await flushPromises();
    expect(store.setRecipe).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining("Rezept konnte nicht geladen werden"),
      "danger",
    );
  });
});
