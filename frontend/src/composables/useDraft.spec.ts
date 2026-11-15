import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { useDraft } from "@/composables/useDraft";
import type { Recipe } from "@/types/recipe";

function recipe(name = "A"): Recipe {
  return {
    recipe_uuid: "r1",
    recipe_name: name,
    lastUpdated: "",
    ingredients: [],
    steps: [],
    sections: [],
  };
}

function setup(initial: Recipe | null = recipe(), dirty = true) {
  const uuid = ref("r1");
  const rec = ref<Recipe | null>(initial);
  const isDirty = ref(dirty);
  let api!: ReturnType<typeof useDraft>;
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useDraft(uuid, rec, isDirty);
        return () => h("div");
      },
    }),
  );
  return { uuid, rec, isDirty, api, wrapper };
}

describe("useDraft", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("erkennt einen vorhandenen Entwurf beim Start", () => {
    localStorage.setItem("draft:r1", JSON.stringify(recipe("alt")));
    expect(setup().api.hasDraft.value).toBe(true);
  });

  it("hat ohne Entwurf hasDraft = false", () => {
    expect(setup().api.hasDraft.value).toBe(false);
  });

  it("sichert nach der Verzögerung, wenn geändert", async () => {
    const { rec } = setup();
    rec.value!.recipe_name = "B";
    await nextTick();
    expect(localStorage.getItem("draft:r1")).toBeNull();
    await vi.advanceTimersByTimeAsync(2000);
    const stored = JSON.parse(localStorage.getItem("draft:r1")!) as Recipe;
    expect(stored.recipe_name).toBe("B");
  });

  it("sichert nichts, solange das Rezept nicht geändert ist", async () => {
    const { rec } = setup(recipe(), false);
    rec.value!.recipe_name = "B";
    await vi.advanceTimersByTimeAsync(3000);
    expect(localStorage.getItem("draft:r1")).toBeNull();
  });

  it("sichert beim Entfernen der Komponente, wenn geändert", () => {
    const { wrapper } = setup();
    wrapper.unmount();
    expect(localStorage.getItem("draft:r1")).not.toBeNull();
  });

  it("sichert beim Entfernen nicht, wenn nicht geändert", () => {
    const { wrapper } = setup(recipe(), false);
    wrapper.unmount();
    expect(localStorage.getItem("draft:r1")).toBeNull();
  });

  it("sichert bei beforeunload", () => {
    setup();
    window.dispatchEvent(new Event("beforeunload"));
    expect(localStorage.getItem("draft:r1")).not.toBeNull();
  });

  it("stellt den Entwurf wieder her", () => {
    localStorage.setItem("draft:r1", JSON.stringify(recipe("Entwurf")));
    const { rec, api } = setup(recipe("Original"), false);
    api.restoreDraft();
    expect(rec.value!.recipe_name).toBe("Entwurf");
  });

  it("stellt ohne Entwurf nichts her", () => {
    const { rec, api } = setup(recipe("Original"), false);
    api.restoreDraft();
    expect(rec.value!.recipe_name).toBe("Original");
  });

  it("verwirft einen defekten Entwurf beim Wiederherstellen", () => {
    localStorage.setItem("draft:r1", "{kaputt");
    const { rec, api } = setup(recipe("Original"), false);
    expect(api.hasDraft.value).toBe(true);
    api.restoreDraft();
    expect(rec.value!.recipe_name).toBe("Original");
    expect(api.hasDraft.value).toBe(false);
    expect(localStorage.getItem("draft:r1")).toBeNull();
  });

  it("verwirft den Entwurf", () => {
    localStorage.setItem("draft:r1", JSON.stringify(recipe()));
    const { api } = setup();
    api.discardDraft();
    expect(api.hasDraft.value).toBe(false);
    expect(localStorage.getItem("draft:r1")).toBeNull();
  });

  it("aktualisiert hasDraft beim Wechsel der UUID", async () => {
    localStorage.setItem("draft:r2", JSON.stringify(recipe()));
    const { uuid, api } = setup();
    expect(api.hasDraft.value).toBe(false);
    uuid.value = "r2";
    await nextTick();
    expect(api.hasDraft.value).toBe(true);
  });
});
