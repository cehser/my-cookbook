import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { useEditHistory } from "@/composables/useEditHistory";

interface Doc {
  name: string;
}

let wrapper: VueWrapper | null = null;

function setup(onLoaded?: (api: ReturnType<typeof useEditHistory>) => void) {
  const doc = ref<Doc | null>(null);
  const isLoaded = ref(false);
  let api!: ReturnType<typeof useEditHistory<Doc | null>>;
  wrapper = mount(
    defineComponent({
      setup() {
        api = useEditHistory(doc, isLoaded, {
          onLoaded: onLoaded ? () => onLoaded(api) : undefined,
        });
        return () => h("div");
      },
    }),
  );
  return { doc, isLoaded, api };
}

/** Lädt einen Zustand wie `useRecipeHelper`: erst Daten, dann `isLoaded`. */
async function load(
  doc: ReturnType<typeof setup>["doc"],
  isLoaded: ReturnType<typeof setup>["isLoaded"],
  name = "geladen",
) {
  isLoaded.value = false;
  await nextTick();
  doc.value = { name };
  isLoaded.value = true;
  await nextTick();
  await vi.advanceTimersByTimeAsync(1000);
}

async function edit(doc: ReturnType<typeof setup>["doc"], name: string) {
  doc.value!.name = name;
  await nextTick();
  await vi.advanceTimersByTimeAsync(500);
}

function key(k: string, mods: KeyboardEventInit = {}) {
  const e = new KeyboardEvent("keydown", {
    key: k,
    cancelable: true,
    ...mods,
  });
  window.dispatchEvent(e);
  return e;
}

describe("useEditHistory", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.useRealTimers();
  });

  it("Änderung → Undo → Redo", async () => {
    const { doc, isLoaded, api } = setup();
    await load(doc, isLoaded);
    await edit(doc, "B");
    expect(api.canUndo.value).toBe(true);

    api.undo();
    expect(doc.value!.name).toBe("geladen");
    expect(api.canRedo.value).toBe(true);

    api.redo();
    expect(doc.value!.name).toBe("B");
  });

  it("fasst schnelle Änderungen innerhalb der Debounce-Zeit zu einem Schritt", async () => {
    const { doc, isLoaded, api } = setup();
    await load(doc, isLoaded);
    for (const name of ["B", "BC", "BCD"]) {
      doc.value!.name = name;
      await nextTick();
      await vi.advanceTimersByTimeAsync(200);
    }
    await vi.advanceTimersByTimeAsync(500);

    api.undo();
    expect(doc.value!.name).toBe("geladen");
    expect(api.canUndo.value).toBe(false);
  });

  it("macht Änderungen nach 500 ms Ruhe zu getrennten Schritten", async () => {
    const { doc, isLoaded, api } = setup();
    await load(doc, isLoaded);
    await edit(doc, "B");
    await edit(doc, "C");

    api.undo();
    expect(doc.value!.name).toBe("B");
    api.undo();
    expect(doc.value!.name).toBe("geladen");
  });

  it("zeichnet vor dem Laden nichts auf, der geladene Zustand ist nicht rückgängig zu machen", async () => {
    const { doc, isLoaded, api } = setup();
    doc.value = { name: "Zwischenstand" };
    await nextTick();
    await vi.advanceTimersByTimeAsync(1000);
    await load(doc, isLoaded);
    expect(api.canUndo.value).toBe(false);
  });

  it("leert den Verlauf beim erneuten Laden", async () => {
    const { doc, isLoaded, api } = setup();
    await load(doc, isLoaded);
    await edit(doc, "B");
    await load(doc, isLoaded, "neu geladen");
    expect(api.canUndo.value).toBe(false);
    expect(api.canRedo.value).toBe(false);
  });

  it("macht den in onLoaded wiederhergestellten Entwurf nicht rückgängig", async () => {
    const { doc, isLoaded, api } = setup((h) => {
      doc.value = { name: "Entwurf" };
      h.reset();
    });
    await load(doc, isLoaded);
    expect(doc.value!.name).toBe("Entwurf");
    expect(api.canUndo.value).toBe(false);

    await edit(doc, "Entwurf+");
    api.undo();
    expect(doc.value!.name).toBe("Entwurf");
    expect(api.canUndo.value).toBe(false);
  });

  it("begrenzt den Verlauf auf 50 Schritte", async () => {
    const { doc, isLoaded, api } = setup();
    await load(doc, isLoaded);
    for (let i = 1; i <= 60; i++) await edit(doc, `S${i}`);

    let steps = 0;
    while (api.canUndo.value) {
      api.undo();
      steps++;
    }
    expect(steps).toBe(50);
    expect(doc.value!.name).toBe("S10");
  });

  describe("Tastenkürzel", () => {
    it("Strg+Z macht rückgängig, Strg+Y wiederholt", async () => {
      const { doc, isLoaded } = setup();
      await load(doc, isLoaded);
      await edit(doc, "B");

      expect(key("z", { ctrlKey: true }).defaultPrevented).toBe(true);
      expect(doc.value!.name).toBe("geladen");
      expect(key("y", { ctrlKey: true }).defaultPrevented).toBe(true);
      expect(doc.value!.name).toBe("B");
    });

    it("Cmd+Umschalt+Z wiederholt, statt rückgängig zu machen", async () => {
      const { doc, isLoaded } = setup();
      await load(doc, isLoaded);
      await edit(doc, "B");
      key("z", { metaKey: true });
      expect(doc.value!.name).toBe("geladen");

      key("z", { metaKey: true, shiftKey: true });
      expect(doc.value!.name).toBe("B");
      // Kein Redo mehr übrig: Umschalt-Variante darf nicht in Undo kippen
      key("z", { metaKey: true, shiftKey: true });
      expect(doc.value!.name).toBe("B");
    });

    it("greift ohne Verlauf nicht ein", async () => {
      const { doc, isLoaded } = setup();
      await load(doc, isLoaded);
      expect(key("z", { ctrlKey: true }).defaultPrevented).toBe(false);
      expect(key("y", { ctrlKey: true }).defaultPrevented).toBe(false);
      expect(doc.value!.name).toBe("geladen");
    });

    it("reagiert nicht auf Z ohne Strg/Cmd", async () => {
      const { doc, isLoaded } = setup();
      await load(doc, isLoaded);
      await edit(doc, "B");
      key("z");
      expect(doc.value!.name).toBe("B");
    });
  });
});
