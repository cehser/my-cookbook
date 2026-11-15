import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Router } from "vue-router";

/**
 * applyUpdate: Ein wartender SW wird bei der nächsten erfolgreichen
 * Navigation aktiviert, aber nicht offline und nicht bei laufender
 * schreibender Anfrage.
 */

interface SwOptions {
  onNeedRefresh(): void;
  onNeedReload(): void;
  onRegisteredSW(url: string, reg: unknown): void;
}

const pwa = vi.hoisted(() => ({
  options: undefined as SwOptions | undefined,
  updateSW: vi.fn(),
}));
const reloadOnce = vi.hoisted(() => vi.fn());

vi.mock("virtual:pwa-register", () => ({
  registerSW: (options: SwOptions) => {
    pwa.options = options;
    return pwa.updateSW;
  },
}));
vi.mock("./reload", () => ({ reloadOnce }));

type AfterEach = (
  to: { name?: string; fullPath: string },
  from: unknown,
  failure?: unknown,
) => void;

let afterEachHook: AfterEach;
let onErrorHook: (error: unknown, to: { fullPath: string }) => void;
const originalFetch = window.fetch;
let pendingResponse: { resolve: (r: Response) => void } | undefined;

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    get: () => online,
  });
}

/** Erste Navigation (zählt nie), danach eine erfolgreiche Navigation. */
function navigate(name = "Recipe") {
  afterEachHook({ name, fullPath: "/x" }, {});
}

beforeEach(async () => {
  vi.resetAllMocks();
  setOnline(true);
  window.fetch = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        pendingResponse = { resolve };
      }),
  ) as typeof fetch;
  vi.resetModules();
  const { setupSwUpdate } = await import("./swUpdate");
  const router = {
    afterEach: (hook: AfterEach) => (afterEachHook = hook),
    onError: (hook: typeof onErrorHook) => (onErrorHook = hook),
  } as unknown as Router;
  setupSwUpdate(router);
  afterEachHook({ name: "Gallery", fullPath: "/" }, {}); // Initialnavigation
  pwa.options!.onNeedRefresh();
});

afterEach(() => {
  window.fetch = originalFetch;
});

describe("applyUpdate", () => {
  it("aktiviert das wartende Update bei der nächsten Navigation", () => {
    navigate();
    expect(pwa.updateSW).toHaveBeenCalledWith(true);
  });

  it("aktiviert nicht offline", () => {
    setOnline(false);
    navigate();
    expect(pwa.updateSW).not.toHaveBeenCalled();
    setOnline(true);
    navigate();
    expect(pwa.updateSW).toHaveBeenCalledTimes(1);
  });

  it("aktiviert nicht bei laufender schreibender Anfrage", async () => {
    const write = window.fetch("/api/v1/recipes", { method: "POST" });
    navigate();
    expect(pwa.updateSW).not.toHaveBeenCalled();
    pendingResponse!.resolve(new Response(null, { status: 204 }));
    await write;
    navigate();
    expect(pwa.updateSW).toHaveBeenCalledTimes(1);
  });

  it("lesende Anfragen blockieren nicht", () => {
    void window.fetch("/api/v1/recipes");
    navigate();
    expect(pwa.updateSW).toHaveBeenCalledTimes(1);
  });

  it("nicht auf /callback und nicht bei gescheiterter Navigation", () => {
    navigate("Callback");
    afterEachHook({ name: "Recipe", fullPath: "/x" }, {}, new Error("abort"));
    expect(pwa.updateSW).not.toHaveBeenCalled();
  });

  it("anderer Tab hat aktiviert: Neuladen statt updateSW, nicht offline", () => {
    pwa.options!.onNeedReload();
    setOnline(false);
    navigate();
    expect(reloadOnce).not.toHaveBeenCalled();
    setOnline(true);
    navigate();
    expect(reloadOnce).toHaveBeenCalledTimes(1);
    expect(pwa.updateSW).not.toHaveBeenCalled();
  });

  it("Navigationsfehler bei reloadPending lädt auf das Ziel, nicht bei Schreibzugriff", () => {
    pwa.options!.onNeedReload();
    void window.fetch("/api/v1/recipes/1", { method: "PUT" });
    onErrorHook(new Error("chunk"), { fullPath: "/recipe/1" });
    expect(reloadOnce).not.toHaveBeenCalled();
    pendingResponse!.resolve(new Response(null, { status: 204 }));
  });
});
