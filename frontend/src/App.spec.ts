import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const replace = vi.fn();
const store = {
  dataSource: "api",
  loadAll: vi.fn(),
  loadRecipePictures: vi.fn(),
  reloadIfStale: vi.fn(),
};

vi.mock("vue-router", () => ({
  useRoute: () => ({ meta: {} }),
  useRouter: () => ({ replace }),
}));
vi.mock("@/store/recipeStore", () => ({ useRecipeStore: () => store }));
vi.mock("@/router", () => ({ restoreSession: vi.fn() }));
vi.mock("@/auth/oidc", () => ({ onUserLoaded: vi.fn(() => vi.fn()) }));
vi.mock("@/auth/session", () => ({ checkSessionOnResume: vi.fn() }));

import { restoreSession } from "@/router";
import { checkSessionOnResume } from "@/auth/session";
import App from "@/App.vue";

const mounted: ReturnType<typeof mount>[] = [];

function mountApp() {
  const w = mount(App, {
    global: {
      stubs: {
        BApp: { template: "<div><slot /></div>" },
        BottomNav: true,
        RouterView: true,
      },
    },
  });
  mounted.push(w);
  return w;
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("App.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.dataSource = "api";
    window.history.replaceState({}, "", "/");
    setVisibility("visible");
  });

  afterEach(() => {
    mounted.splice(0).forEach((w) => w.unmount());
  });

  it("lädt beim Start Daten und Bilder", async () => {
    mountApp();
    await flushPromises();
    expect(store.loadAll).toHaveBeenCalledTimes(1);
    expect(store.loadRecipePictures).toHaveBeenCalledTimes(1);
  });

  it("springt beim Kaltstart auf / zur gespeicherten Route", async () => {
    vi.mocked(restoreSession).mockReturnValue("/recipe/abc");
    mountApp();
    await flushPromises();
    expect(replace).toHaveBeenCalledWith("/recipe/abc");
  });

  it("bleibt ohne gespeicherte Route auf der Startseite", async () => {
    vi.mocked(restoreSession).mockReturnValue(null);
    mountApp();
    await flushPromises();
    expect(replace).not.toHaveBeenCalled();
  });

  it("stellt die Route auf anderen Pfaden nicht wieder her", async () => {
    window.history.replaceState({}, "", "/favorites");
    vi.mocked(restoreSession).mockReturnValue("/recipe/abc");
    mountApp();
    await flushPromises();
    expect(restoreSession).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("prüft beim Wechsel in den Vordergrund die Sitzung und lädt nach", async () => {
    vi.mocked(checkSessionOnResume).mockResolvedValue("valid");
    mountApp();
    await flushPromises();
    setVisibility("hidden");
    await flushPromises();
    expect(checkSessionOnResume).not.toHaveBeenCalled();
    setVisibility("visible");
    await flushPromises();
    expect(checkSessionOnResume).toHaveBeenCalledTimes(1);
    expect(store.reloadIfStale).toHaveBeenCalledTimes(1);
  });

  it("lädt bei abgelehnter Sitzung nicht nach", async () => {
    vi.mocked(checkSessionOnResume).mockResolvedValue("rejected");
    mountApp();
    await flushPromises();
    setVisibility("hidden");
    setVisibility("visible");
    await flushPromises();
    expect(checkSessionOnResume).toHaveBeenCalledTimes(1);
    expect(store.reloadIfStale).not.toHaveBeenCalled();
  });
});
