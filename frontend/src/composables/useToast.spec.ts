import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { BApp } from "bootstrap-vue-next";
import { useToast } from "@/composables/useToast";

// Sicherheitsnetz für den Wrapper: bootstrap-vue-next 1.x zeigt einen per
// create() angelegten Toast ohne modelValue gar nicht an, ohne Fehlermeldung.

let toast: ReturnType<typeof useToast>["toast"];

const Caller = defineComponent({
  setup() {
    ({ toast } = useToast());
    return () => null;
  },
});

const wrappers: ReturnType<typeof mount>[] = [];

function mountApp() {
  const w = mount(
    defineComponent({ render: () => h(BApp, null, () => h(Caller)) }),
    {
      attachTo: document.body,
      // echte Transitions, sonst feuert BToast nie "hidden"
      global: { stubs: { transition: false, "transition-group": false } },
    },
  );
  wrappers.push(w);
  return w;
}

afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  vi.useRealTimers();
});

describe("useToast", () => {
  it("zeigt die Meldung an und blendet sie nach 5 s aus", async () => {
    vi.useFakeTimers();
    mountApp();
    toast("Gespeichert", "success");
    await flushPromises();
    const el = document.querySelector<HTMLElement>(".toast");
    expect(el?.textContent).toContain("Gespeichert");
    expect(el?.style.display).not.toBe("none");

    await vi.advanceTimersByTimeAsync(6000);
    await flushPromises();
    // ausgeblendet und aus dem Orchestrator entfernt
    expect(document.querySelector(".toast")).toBeNull();
  });
});
