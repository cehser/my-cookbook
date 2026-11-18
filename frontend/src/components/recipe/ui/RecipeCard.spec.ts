import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { LocalReadError } from "@/store/pendingCreates";
import type { Settings } from "@/types/settings";
import type { Recipe } from "@/types/recipe";

const store = vi.hoisted(() => ({
  settings: {} as Settings,
  favorites: [] as string[],
  recipes: [] as Recipe[],
  canDelete: (() => false) as (r: Recipe) => boolean,
  localStatus: (() => null) as (uuid: string) => "pending" | "rejected" | null,
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  setRecipeTags: vi.fn(),
}));

vi.mock("@/store/recipeStore", () => ({ useRecipeStore: () => store }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/composables/useToast", () => ({ useToast: () => ({ toast }) }));

import RecipeCard from "./RecipeCard.vue";

const recipe = {
  recipe_uuid: "r1",
  recipe_name: "Apfelkuchen",
  ingredients: [],
  steps: [],
  sections: [],
  tags: ["Herbst"],
} as unknown as Recipe;

function render(
  settings: Settings,
  {
    readOnly = settings.read_only,
    canDelete = false,
    local = null as "pending" | "rejected" | null,
    compact = false,
  } = {},
) {
  store.settings = settings;
  store.canDelete = () => canDelete;
  store.localStatus = () => local;
  return mount(RecipeCard, {
    props: {
      recipe: structuredClone(recipe),
      picture_src: "",
      index: 0,
      read_only: readOnly,
      compact,
    },
    global: { stubs: { RouterLink: { template: "<a><slot /></a>" } } },
  });
}

const star = (w: ReturnType<typeof render>) => w.find(".favorite-star");
const deleteButton = (w: ReturnType<typeof render>) =>
  w.findAll("button").find((b) => b.text().includes("Löschen"));

async function openMenu(w: ReturnType<typeof render>) {
  await w.find("button[aria-label='Aktionen']").trigger("click");
}

describe("RecipeCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Stern für readonly mit „Nur lesen“, ohne Aktionsmenü", () => {
    const w = render({ role: "readonly", read_only: true, expert_mode: false });
    expect(star(w).exists()).toBe(true);
    expect(w.find("button[aria-label='Aktionen']").exists()).toBe(false);
  });

  it("kein Stern für pending", () => {
    const w = render({ role: "pending", read_only: true, expert_mode: false });
    expect(star(w).exists()).toBe(false);
  });

  it("Stern setzt den Favoriten", async () => {
    const w = render({ role: "readonly", read_only: true, expert_mode: false });
    await star(w).trigger("click");
    expect(store.addFavorite).toHaveBeenCalledWith("r1");
  });

  it("Löschen nur mit Recht", async () => {
    const editor: Settings = {
      role: "editor",
      read_only: false,
      expert_mode: false,
    };
    const without = render(editor, { canDelete: false });
    await openMenu(without);
    expect(without.text()).toContain("Bearbeiten");
    expect(deleteButton(without)).toBeUndefined();

    const allowed = render(editor, { canDelete: true });
    await openMenu(allowed);
    expect(deleteButton(allowed)).toBeDefined();
  });

  it("Tag nicht gespeichert: Toast mit Grund, Tag in der Anzeige zurück", async () => {
    const answer = deferredResult();
    store.setRecipeTags.mockReturnValueOnce(answer.promise);
    const w = render({ role: "editor", read_only: false, expert_mode: false });
    await openTagEditor(w);
    await w.find("input").setValue("Kuchen");
    await w.find("input").trigger("keyup.enter");

    // Sofort angezeigt, gesendet werden alle Tags
    expect(store.setRecipeTags).toHaveBeenCalledWith("r1", [
      "Herbst",
      "Kuchen",
    ]);
    expect(chips(w)).toEqual(["Herbst", "Kuchen"]);

    answer.resolve({
      status: "failed",
      error: new LocalReadError(new Error("idb")),
    });
    await flushPromises();
    expect(toast).toHaveBeenCalledWith(
      "Rezept nicht gespeichert: auf diesem Gerät nicht lesbar.",
      "danger",
    );
    expect(chips(w)).toEqual(["Herbst"]);
  });

  it("Tag entfernen gelingt: kein Toast", async () => {
    store.setRecipeTags.mockResolvedValueOnce({ status: "saved" });
    const w = render({ role: "editor", read_only: false, expert_mode: false });
    await openTagEditor(w);
    await w.find(".tag-editor .badge.bg-primary").trigger("click");
    await flushPromises();
    expect(store.setRecipeTags).toHaveBeenCalledWith("r1", []);
    expect(toast).not.toHaveBeenCalled();
  });

  it.each([
    ["pending", "Nur auf diesem Gerät"],
    ["rejected", "Vom Server abgelehnt"],
  ] as const)(
    "Kennzeichnung %s: Text an der Karte, auch kompakt",
    (local, text) => {
      const settings: Settings = {
        role: "editor",
        read_only: false,
        expert_mode: false,
      };
      expect(render(settings, { local }).find(".local-badge").text()).toBe(
        text,
      );
      expect(
        render(settings, { local, compact: true }).find(".local-badge").text(),
      ).toBe(text);
      expect(render(settings).find(".local-badge").exists()).toBe(false);
    },
  );
});

function deferredResult() {
  let resolve!: (v: unknown) => void;
  const promise = new Promise((res) => (resolve = res));
  return { promise, resolve };
}

async function openTagEditor(w: ReturnType<typeof render>) {
  await openMenu(w);
  const tagsButton = w.findAll("button").find((b) => b.text() === "Tags");
  await tagsButton!.trigger("click");
}

const chips = (w: ReturnType<typeof render>) =>
  w.findAll(".tag-editor .badge.bg-primary").map((c) => c.text());
