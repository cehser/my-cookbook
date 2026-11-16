import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";

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
const hint = ref<string | null>(null);
vi.mock("@/auth/session", () => ({
  onResume: vi.fn(),
  onOnline: vi.fn(),
  get sessionHint() {
    return hint;
  },
}));

import { restoreSession } from "@/router";
import { onOnline, onResume } from "@/auth/session";
import App from "@/App.vue";

const mounted: ReturnType<typeof mount>[] = [];

function mountApp() {
  const w = mount(App, {
    global: {
      stubs: {
        BApp: { template: "<div><slot /></div>" },
        BottomNav: true,
        TransferNotice: true,
        RouterView: true,
      },
    },
  });
  mounted.push(w);
  return w;
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    get: () => online,
  });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
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
    hint.value = null;
    window.history.replaceState({}, "", "/");
    setVisibility("visible");
    setOnline(true);
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
    vi.mocked(onResume).mockResolvedValue("valid");
    mountApp();
    await flushPromises();
    setVisibility("hidden");
    await flushPromises();
    expect(onResume).not.toHaveBeenCalled();
    setVisibility("visible");
    await flushPromises();
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(store.reloadIfStale).toHaveBeenCalledTimes(1);
  });

  it("lädt bei abgelehnter Sitzung nicht nach", async () => {
    vi.mocked(onResume).mockResolvedValue("rejected");
    mountApp();
    await flushPromises();
    setVisibility("hidden");
    setVisibility("visible");
    await flushPromises();
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(store.reloadIfStale).not.toHaveBeenCalled();
  });

  it("klärt bei wieder online die Sitzung und lädt nach", async () => {
    vi.mocked(onOnline).mockResolvedValue("valid");
    setOnline(false);
    mountApp();
    await flushPromises();
    setOnline(true);
    await flushPromises();
    expect(onOnline).toHaveBeenCalledTimes(1);
    expect(store.reloadIfStale).toHaveBeenCalledTimes(1);
  });

  it("lädt bei wieder online ohne Sitzung nicht nach (Login folgt)", async () => {
    vi.mocked(onOnline).mockResolvedValue("rejected");
    setOnline(false);
    mountApp();
    await flushPromises();
    setOnline(true);
    await flushPromises();
    expect(onOnline).toHaveBeenCalledTimes(1);
    expect(store.reloadIfStale).not.toHaveBeenCalled();
  });

  it("zeigt den Hinweis der Sitzung im Banner", async () => {
    const w = mountApp();
    await flushPromises();
    expect(w.find(".session-hint").exists()).toBe(false);
    hint.value = "no-data";
    await flushPromises();
    expect(w.find(".session-hint").text()).toContain(
      "Keine Verbindung, noch keine Daten",
    );
  });
});
