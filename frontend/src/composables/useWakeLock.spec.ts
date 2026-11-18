import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref, type Ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { useWakeLock } from "./useWakeLock";

/** Nachgebauter WakeLockSentinel mit auslösbarem „release“. */
class FakeSentinel extends EventTarget {
  released = false;
  type = "screen" as const;
  onrelease = null;
  release = vi.fn(async () => {
    this.systemRelease();
  });
  /** Wie der Browser beim Verbergen der Seite */
  systemRelease() {
    if (this.released) return;
    this.released = true;
    this.dispatchEvent(new Event("release"));
  }
}

let sentinels: FakeSentinel[];
let request: ReturnType<typeof vi.fn>;
let visibility: DocumentVisibilityState;

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
}

function host(enabled: Ref<boolean>) {
  let api!: ReturnType<typeof useWakeLock>;
  const Comp = defineComponent({
    setup() {
      api = useWakeLock(enabled);
      return () => h("div");
    },
  });
  const wrapper = mount(Comp);
  return { wrapper, api: () => api };
}

beforeEach(() => {
  sentinels = [];
  visibility = "visible";
  request = vi.fn(async () => {
    const s = new FakeSentinel();
    sentinels.push(s);
    return s;
  });
  Object.defineProperty(navigator, "wakeLock", {
    value: { request },
    configurable: true,
  });
  vi.spyOn(document, "visibilityState", "get").mockImplementation(
    () => visibility,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "wakeLock");
});

describe("useWakeLock", () => {
  it("fordert beim Einhängen an", async () => {
    const { api } = host(ref(true));
    await flushPromises();
    expect(request).toHaveBeenCalledWith("screen");
    expect(api().isSupported).toBe(true);
    expect(api().isActive.value).toBe(true);
  });

  it("fordert nach Rückkehr in den Vordergrund erneut an", async () => {
    const { api } = host(ref(true));
    await flushPromises();

    setVisibility("hidden");
    sentinels[0].systemRelease();
    expect(api().isActive.value).toBe(false);
    await flushPromises();
    expect(request).toHaveBeenCalledTimes(1);

    setVisibility("visible");
    await flushPromises();
    expect(request).toHaveBeenCalledTimes(2);
    expect(api().isActive.value).toBe(true);
  });

  it("fordert nicht doppelt an, solange die Sperre besteht", async () => {
    host(ref(true));
    await flushPromises();
    setVisibility("visible");
    await flushPromises();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("gibt beim Verlassen frei", async () => {
    const { wrapper } = host(ref(true));
    await flushPromises();
    wrapper.unmount();
    await flushPromises();
    expect(sentinels[0].release).toHaveBeenCalled();

    setVisibility("visible");
    await flushPromises();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("folgt dem Schalter", async () => {
    const enabled = ref(false);
    const { api } = host(enabled);
    await flushPromises();
    expect(request).not.toHaveBeenCalled();

    enabled.value = true;
    await flushPromises();
    expect(api().isActive.value).toBe(true);

    enabled.value = false;
    await flushPromises();
    expect(sentinels[0].release).toHaveBeenCalled();
    expect(api().isActive.value).toBe(false);

    setVisibility("visible");
    await flushPromises();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("gibt sofort frei, wenn während der Anforderung verlassen wird", async () => {
    let resolve!: (s: FakeSentinel) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const { wrapper } = host(ref(true));
    await nextTick();
    wrapper.unmount();
    const s = new FakeSentinel();
    resolve(s);
    await flushPromises();
    expect(s.release).toHaveBeenCalled();
  });

  it("schluckt eine Ablehnung", async () => {
    request.mockRejectedValueOnce(
      new DOMException("denied", "NotAllowedError"),
    );
    const { api } = host(ref(true));
    await flushPromises();
    expect(api().isActive.value).toBe(false);
  });

  it("tut ohne API nichts", async () => {
    Reflect.deleteProperty(navigator, "wakeLock");
    const { api, wrapper } = host(ref(true));
    await flushPromises();
    expect(api().isSupported).toBe(false);
    expect(api().isActive.value).toBe(false);
    setVisibility("visible");
    wrapper.unmount();
    expect(request).not.toHaveBeenCalled();
  });
});
