import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";

/**
 * Zustandstabelle aus docs/tasks/W.23-auth-feinschliff.md gegen die Einstiege
 * in session.ts. `userManager`, `navigator.onLine` und `hasCachedRecipes` sind
 * gemockt; „Login“ heißt: `userManager.signinRedirect()` wurde aufgerufen.
 */

interface FakeUser {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  profile: { sub: string };
}

const um = vi.hoisted(() => ({
  getUser: vi.fn(),
  signinSilent: vi.fn(),
  signinRedirect: vi.fn(),
  signinRedirectCallback: vi.fn(),
  removeUser: vi.fn(),
  events: { addAccessTokenExpiring: vi.fn() },
}));
const cache = vi.hoisted(() => ({ has: vi.fn() }));

vi.mock("@/auth/userManager", () => ({ userManager: um }));
vi.mock("@/js/offlineCache", () => ({
  hasCachedRecipes: () => cache.has(),
}));

type Session = typeof import("@/auth/session");

let stored: FakeUser | null;
let session: Session;
let expiringTimer: () => void;

const fresh = (n = 1): FakeUser => ({
  access_token: `a${n}`,
  refresh_token: `r${n}`,
  expires_in: 300,
  profile: { sub: "u1" },
});
const expired = (): FakeUser => ({ ...fresh(), expires_in: 0 });
const rejectedError = () =>
  Object.assign(new Error("invalid_grant"), {
    name: "ErrorResponse",
    error: "invalid_grant",
  });
const timeoutError = () => new Error("Timeout");

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    get: () => online,
  });
}

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Exklusiver Fake-LockManager (happy-dom hat keinen): Warteschlange je Name,
 * `signal` bricht das Warten ab, Freigabe auch bei Exception.
 */
function installLocks() {
  type Entry = {
    fn: () => Promise<unknown>;
    done: (p: Promise<unknown>) => void;
  };
  const queue: Entry[] = [];
  let holding = false;
  const names: string[] = [];
  const next = () => {
    if (holding) return;
    const entry = queue.shift();
    if (!entry) return;
    holding = true;
    const run = Promise.resolve().then(entry.fn);
    entry.done(run);
    void run
      .catch(() => undefined)
      .finally(() => {
        holding = false;
        next();
      });
  };
  const locks = {
    names,
    held: () => holding,
    queued: () => queue.length,
    request(
      name: string,
      optsOrFn: { signal?: AbortSignal } | (() => Promise<unknown>),
      maybeFn?: () => Promise<unknown>,
    ): Promise<unknown> {
      names.push(name);
      const fn = typeof optsOrFn === "function" ? optsOrFn : maybeFn!;
      const signal =
        typeof optsOrFn === "function" ? undefined : optsOrFn.signal;
      return new Promise((resolve, reject) => {
        const entry: Entry = { fn, done: (p) => p.then(resolve, reject) };
        signal?.addEventListener("abort", () => {
          const i = queue.indexOf(entry);
          if (i < 0) return; // schon gewährt: Abbruch wirkungslos
          queue.splice(i, 1);
          reject(new DOMException("aborted", "AbortError"));
        });
        queue.push(entry);
        next();
      });
    },
  };
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: locks,
  });
  return locks;
}

const loginCalls = () => um.signinRedirect.mock.calls.length;
const loginTarget = () => sessionStorage.getItem("oidc-return-url");

async function loadSession(): Promise<Session> {
  vi.resetModules();
  const s = await import("@/auth/session");
  s.setLoginTargetResolver(() => "/aktuell");
  const calls = um.events.addAccessTokenExpiring.mock.calls;
  expiringTimer = calls[calls.length - 1][0];
  return s;
}

beforeEach(async () => {
  vi.resetAllMocks();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  setOnline(true);
  stored = fresh();
  um.getUser.mockImplementation(async () => stored);
  um.removeUser.mockImplementation(async () => {
    stored = null;
  });
  um.signinSilent.mockImplementation(async () => {
    stored = fresh(2);
  });
  // Echter Redirect: Promise löst nicht auf (Seite wird verlassen).
  um.signinRedirect.mockReturnValue(new Promise(() => undefined));
  cache.has.mockResolvedValue(true);
  session = await loadSession();
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, "locks");
});

describe("Zustandstabelle: Navigation", () => {
  it("valid → durchlassen, kein Login", async () => {
    expect(await session.onNavigation({ fullPath: "/favorites" })).toBe(true);
    expect(loginCalls()).toBe(0);
    expect(um.signinSilent).not.toHaveBeenCalled();
  });

  it("offline mit Cache → durchlassen, ohne auf die Erneuerung zu warten", async () => {
    stored = expired();
    const renewal = deferred();
    um.signinSilent.mockReturnValue(renewal.promise);
    const result = session.onNavigation({ fullPath: "/favorites" });
    expect(await result).toBe(true);
    expect(session.currentRenewal()).not.toBeNull(); // läuft noch
    await flushPromises();
    expect(um.signinSilent).toHaveBeenCalledTimes(1);
    renewal.reject(timeoutError());
    await flushPromises();
    expect(loginCalls()).toBe(0);
    expect(session.sessionHint.value).toBeNull();
  });

  it("offline ohne Cache → durchlassen mit Hinweis „keine Daten“", async () => {
    cache.has.mockResolvedValue(false);
    stored = expired();
    setOnline(false);
    expect(await session.onNavigation({ fullPath: "/" })).toBe(true);
    expect(session.sessionHint.value).toBe("no-data");
    expect(loginCalls()).toBe(0);
  });

  it("rejected, Netz, Cache → durchlassen, danach Login auf das Ziel", async () => {
    stored = null;
    expect(await session.onNavigation({ fullPath: "/recipe/1" })).toBe(true);
    await flushPromises();
    expect(loginCalls()).toBe(1);
    expect(loginTarget()).toBe("/recipe/1");
  });

  it("rejected, Netz, ohne Cache → abbrechen, Login auf das Ziel", async () => {
    cache.has.mockResolvedValue(false);
    stored = null;
    const result = session.onNavigation({ fullPath: "/recipe/1" });
    await flushPromises();
    expect(loginCalls()).toBe(1);
    expect(loginTarget()).toBe("/recipe/1");
    // Ein zweiter Guard-Lauf (Kaltstart: App.vue ersetzt die Initialnavigation)
    // bricht ebenfalls ab und startet keinen zweiten Redirect.
    expect(await session.onNavigation({ fullPath: "/recipe/2" })).toBe(false);
    expect(loginCalls()).toBe(1);
    void result;
  });

  it.each([true, false])(
    "rejected ohne Netz (Cache %s) → durchlassen, Login vorgemerkt",
    async (hasCache) => {
      cache.has.mockResolvedValue(hasCache);
      stored = null;
      setOnline(false);
      expect(await session.onNavigation({ fullPath: "/recipe/1" })).toBe(true);
      await flushPromises();
      expect(loginCalls()).toBe(0);
      expect(session.sessionHint.value).toBe(hasCache ? null : "no-data");
      setOnline(true);
      await session.onOnline();
      expect(loginCalls()).toBe(1);
      expect(loginTarget()).toBe("/aktuell");
    },
  );
});

describe("Zustandstabelle: Resume", () => {
  it("valid, Token nicht abgelaufen → nichts", async () => {
    expect(await session.onResume()).toBe("valid");
    expect(um.signinSilent).not.toHaveBeenCalled();
    expect(loginCalls()).toBe(0);
  });

  it("Token abgelaufen, Netz → genau eine Erneuerung (auch mit Timer und Store)", async () => {
    stored = expired();
    const renewal = deferred();
    um.signinSilent.mockImplementation(async () => {
      await renewal.promise;
      stored = fresh(2);
    });
    const resume = session.onResume();
    expiringTimer(); // Ablauf-Timer feuert nach dem Aufwecken
    const store = session.ensureAuth(); // Store lädt nach
    renewal.resolve();
    expect(await resume).toBe("valid");
    expect(await store).toBe("valid");
    // Danach erneuert weder ein später Timer noch ein weiterer Aufruf.
    await session.onResume();
    expect(um.signinSilent).toHaveBeenCalledTimes(1);
    expect(um.signinSilent).toHaveBeenCalledWith({
      silentRequestTimeoutInSeconds: 10,
    });
  });

  it("rejected, Netz → Login für die aktuelle Route", async () => {
    stored = null;
    expect(await session.onResume()).toBe("rejected");
    expect(loginCalls()).toBe(1);
    expect(loginTarget()).toBe("/aktuell");
  });

  it("rejected ohne Netz → Login vormerken", async () => {
    stored = null;
    setOnline(false);
    await session.onResume();
    expect(loginCalls()).toBe(0);
    setOnline(true);
    await session.onResume(); // nächster Auslöser mit Netz
    expect(loginCalls()).toBe(1);
  });

  it("offline ohne Netz → nichts, auch kein vorgemerkter Login", async () => {
    stored = expired();
    setOnline(false);
    expect(await session.onResume()).toBe("offline");
    expect(um.signinSilent).not.toHaveBeenCalled();
    setOnline(true);
    expect(await session.onOnline()).toBe("valid");
    expect(loginCalls()).toBe(0);
  });

  it("iOS: online und visible in beliebiger Reihenfolge → ein Redirect", async () => {
    stored = null;
    await Promise.all([session.onOnline(), session.onResume()]);
    await Promise.all([session.onResume(), session.onOnline()]);
    expect(loginCalls()).toBe(1);
  });
});

describe("Zustandstabelle: online-Ereignis", () => {
  it("keine Sitzung → Login für die aktuelle Route", async () => {
    stored = null;
    expect(await session.onOnline()).toBe("rejected");
    expect(loginCalls()).toBe(1);
    expect(loginTarget()).toBe("/aktuell");
  });

  it("Login vorgemerkt → Login, auch wenn der IdP nicht antwortet", async () => {
    stored = null;
    setOnline(false);
    session.onRejected();
    setOnline(true);
    stored = expired(); // z. B. Sitzung aus anderem Tab, IdP hängt
    um.signinSilent.mockRejectedValue(timeoutError());
    expect(await session.onOnline()).toBe("offline");
    expect(loginCalls()).toBe(1);
  });

  it("sonst → ensureAuth (erneuert bei Bedarf), kein Login", async () => {
    stored = expired();
    expect(await session.onOnline()).toBe("valid");
    expect(um.signinSilent).toHaveBeenCalledTimes(1);
    expect(loginCalls()).toBe(0);
  });
});

describe("Zustandstabelle: Sitzung abgelehnt", () => {
  it("Ablauf-Timer, Netz → Sitzung verworfen, Login für die aktuelle Route", async () => {
    um.signinSilent.mockRejectedValue(rejectedError());
    expiringTimer();
    await flushPromises();
    expect(um.removeUser).toHaveBeenCalledTimes(1);
    expect(loginCalls()).toBe(1);
    expect(loginTarget()).toBe("/aktuell");
  });

  it("401-Pfad, Netz → Login", async () => {
    um.signinSilent.mockRejectedValue(rejectedError());
    expect(await session.renewAfterUnauthorized("a1")).toBeNull();
    expect(loginCalls()).toBe(1);
  });

  it("ohne Netz → vorgemerkt, Login bei online", async () => {
    stored = { ...expired(), refresh_token: undefined };
    setOnline(false);
    expect(await session.ensureAuth()).toBe("rejected"); // Store
    expect(loginCalls()).toBe(0);
    setOnline(true);
    stored = null;
    await session.onOnline();
    expect(loginCalls()).toBe(1);
  });

  it("öffentliche Route → kein Login", async () => {
    session.setLoginTargetResolver(() => null);
    um.signinSilent.mockRejectedValue(rejectedError());
    expiringTimer();
    await flushPromises();
    stored = null;
    await session.onOnline();
    await session.onResume();
    expect(loginCalls()).toBe(0);
  });

  it("während des Logouts → kein Login, keine Erneuerung", async () => {
    session.setLogoutInProgress(true);
    stored = expired();
    expect(await session.renewToken()).toBe("offline");
    stored = null;
    await session.onResume();
    expect(await session.onNavigation({ fullPath: "/" })).toBe(true);
    await flushPromises();
    expect(um.signinSilent).not.toHaveBeenCalled();
    expect(loginCalls()).toBe(0);
  });
});

describe("Zustandstabelle: IdP hängt", () => {
  it("Erneuerung läuft in den Timeout → offline, ohne Cache Hinweis", async () => {
    cache.has.mockResolvedValue(false);
    stored = expired();
    um.signinSilent.mockRejectedValue(timeoutError());
    expect(await session.onNavigation({ fullPath: "/" })).toBe(true);
    expect(session.sessionHint.value).toBe("no-data");
    expect(loginCalls()).toBe(0);
  });

  it("Login-Redirect scheitert (Discovery-Timeout) → wie offline, Hinweis", async () => {
    cache.has.mockResolvedValue(false);
    stored = null;
    um.signinRedirect.mockRejectedValue(timeoutError());
    expect(await session.onNavigation({ fullPath: "/" })).toBe(true);
    expect(session.sessionHint.value).toBe("no-data");
  });

  it("Hinweis verschwindet bei gültiger Sitzung", async () => {
    cache.has.mockResolvedValue(false);
    stored = expired();
    um.signinSilent.mockRejectedValueOnce(timeoutError());
    await session.onNavigation({ fullPath: "/" });
    expect(session.sessionHint.value).toBe("no-data");
    await session.onOnline();
    expect(session.sessionHint.value).toBeNull();
  });
});

describe("Erneuerung: Single-Flight, Web Lock, Backoff", () => {
  it("parallele Aufrufer teilen sich eine Erneuerung", async () => {
    stored = expired();
    const results = await Promise.all([
      session.renewToken(),
      session.getAccessToken(),
      session.ensureAuth(),
    ]);
    expect(results).toEqual(["valid", "a2", "valid"]);
    expect(um.signinSilent).toHaveBeenCalledTimes(1);
  });

  it("erneuert unter navigator.locks", async () => {
    const locks = installLocks();
    stored = expired();
    expect(await session.renewToken()).toBe("valid");
    expect(locks.names).toEqual(["my-cookbook-token-renewal"]);
    expect(um.signinSilent).toHaveBeenCalledTimes(1);
  });

  it("nach dem Lock: anderer Tab hat schon erneuert → keine zweite Erneuerung", async () => {
    const locks = installLocks();
    const otherTab = deferred();
    void locks.request("my-cookbook-token-renewal", async () => {
      await otherTab.promise;
      stored = fresh(3); // der andere Tab hielt den Lock und erneuerte
    });
    stored = expired();
    const renewal = session.renewToken();
    await flushPromises();
    expect(um.signinSilent).not.toHaveBeenCalled(); // wartet auf den Lock
    otherTab.resolve();
    expect(await renewal).toBe("valid");
    expect(um.signinSilent).not.toHaveBeenCalled();
  });

  it("nach dem Lock: anderer Tab hat die Sitzung verworfen → rejected", async () => {
    const locks = installLocks();
    void locks.request("my-cookbook-token-renewal", async () => {
      stored = null;
    });
    stored = expired();
    expect(await session.renewToken()).toBe("rejected");
    expect(um.signinSilent).not.toHaveBeenCalled();
  });

  it("Lock-Wartezeit begrenzt (15 s): offline, kein Hängen von getAccessToken und logout", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const locks = installLocks();
    void locks.request(
      "my-cookbook-token-renewal",
      () => new Promise(() => undefined),
    ); // Tab hängt
    stored = expired();
    const token = session.getAccessToken();
    await vi.advanceTimersByTimeAsync(14_900);
    expect(session.currentRenewal()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(200);
    expect(await token).toBeNull();
    expect(session.currentRenewal()).toBeNull(); // logout() wartet nicht mehr
    expect(um.signinSilent).not.toHaveBeenCalled();
    expect(locks.queued()).toBe(0); // abgebrochene Anfrage ist aus der Schlange
  });

  it("Timeout gilt nur fürs Warten, nicht für die Erneuerung selbst", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    installLocks();
    stored = expired();
    const slow = deferred();
    um.signinSilent.mockImplementation(async () => {
      await slow.promise;
      stored = fresh(2);
    });
    const renewal = session.renewToken();
    await vi.advanceTimersByTimeAsync(20_000);
    slow.resolve();
    expect(await renewal).toBe("valid");
  });

  it("Exception unter dem Lock gibt ihn frei", async () => {
    const locks = installLocks();
    stored = expired();
    um.getUser
      .mockImplementationOnce(async () => stored) // vor dem Lock
      .mockRejectedValueOnce(new Error("Storage gesperrt")); // unter dem Lock
    await expect(session.renewToken()).rejects.toThrow("Storage gesperrt");
    expect(locks.held()).toBe(false);
    expect(await session.renewToken()).toBe("valid");
    expect(um.signinSilent).toHaveBeenCalledTimes(1);
  });

  it("ohne navigator.locks wie bisher direkt", async () => {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: undefined,
    });
    stored = expired();
    expect(await session.renewToken()).toBe("valid");
    expect(um.signinSilent).toHaveBeenCalledTimes(1);
  });

  it("Backoff: nach offline mit Netz 30 s kein neuer Versuch, danach normal", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
    stored = expired();
    um.signinSilent.mockRejectedValueOnce(timeoutError());
    expect(await session.renewToken()).toBe("offline");
    vi.setSystemTime(new Date("2026-11-15T12:00:29Z"));
    expect(await session.getAccessToken()).toBeNull(); // API-Aufruf teilt das Ergebnis
    expect(await session.renewToken()).toBe("offline");
    expect(um.signinSilent).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date("2026-11-15T12:00:31Z"));
    expect(await session.renewToken()).toBe("valid");
    expect(um.signinSilent).toHaveBeenCalledTimes(2);
  });

  it("Backoff: online-Ereignis beendet ihn", async () => {
    stored = expired();
    um.signinSilent.mockRejectedValueOnce(timeoutError());
    expect(await session.renewToken()).toBe("offline");
    expect(await session.onOnline()).toBe("valid");
    expect(um.signinSilent).toHaveBeenCalledTimes(2);
  });

  it("Backoff nicht, wenn der Browser kein Netz meldet", async () => {
    stored = expired();
    setOnline(false);
    expect(await session.renewToken()).toBe("offline");
    setOnline(true);
    expect(await session.renewToken()).toBe("valid");
  });
});

describe("Zustandstabelle: Callback", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/callback?code=c1&state=s1");
    // Im Test kehrt der Redirect zurück, damit der Fehlerpfad endet.
    um.signinRedirect.mockResolvedValue(undefined);
  });

  it("verarbeitet den Code bei zweitem Mount nur einmal", async () => {
    const first = session.onCallback("/recipe/1");
    const second = session.onCallback("/recipe/1");
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(um.signinRedirectCallback).toHaveBeenCalledTimes(1);
  });

  it("Reload derselben Callback-URL löst den Code nicht erneut ein", async () => {
    expect(await session.onCallback("/")).toBe(true);
    session = await loadSession(); // Reload: Modulzustand weg, sessionStorage bleibt
    expect(await session.onCallback("/")).toBe(true);
    expect(um.signinRedirectCallback).toHaveBeenCalledTimes(1);
  });

  it("Reload mitten im Abruf ohne Sitzung → Fehler mit begrenztem Neuversuch", async () => {
    um.signinRedirectCallback.mockReturnValue(new Promise(() => undefined));
    stored = null;
    void session.onCallback("/recipe/1"); // Seite wird währenddessen neu geladen
    session = await loadSession();
    expect(await session.onCallback("/recipe/1")).toBe(false);
    expect(um.signinRedirectCallback).toHaveBeenCalledTimes(1);
    expect(loginCalls()).toBe(1);
    expect(loginTarget()).toBe("/recipe/1");
  });

  it("Fehler → genau ein automatischer Neuversuch, dann Meldung", async () => {
    um.signinRedirectCallback.mockRejectedValue(new Error("state"));
    expect(await session.onCallback("/x")).toBe(false);
    expect(loginCalls()).toBe(1);
    // Rückkehr vom IdP mit neuem state, wieder Fehler: kein weiterer Redirect
    window.history.replaceState({}, "", "/callback?code=c2&state=s2");
    session = await loadSession();
    expect(await session.onCallback("/x")).toBe(false);
    expect(loginCalls()).toBe(1);
    // Manueller Neuversuch setzt das Limit zurück
    await session.retryLoginFromCallback("/x");
    expect(loginCalls()).toBe(2);
  });

  it("Erfolg setzt die Versuche zurück", async () => {
    sessionStorage.setItem("oidc-login-attempts", "1");
    expect(await session.onCallback("/")).toBe(true);
    expect(sessionStorage.getItem("oidc-login-attempts")).toBeNull();
  });
});

describe("Hilfen", () => {
  it("classifyRenewError: nur abweisende OAuth-Codes sind rejected", () => {
    expect(session.classifyRenewError(rejectedError())).toBe("rejected");
    expect(
      session.classifyRenewError(
        Object.assign(new Error("x"), {
          name: "ErrorResponse",
          error: "server_error",
        }),
      ),
    ).toBe("offline");
    expect(session.classifyRenewError(new TypeError("fetch"))).toBe("offline");
  });

  it("anderer Tab rotiert während einer abgelehnten Erneuerung → valid", async () => {
    stored = expired();
    um.signinSilent.mockImplementation(async () => {
      stored = fresh(4);
      throw rejectedError();
    });
    expect(await session.renewToken()).toBe("valid");
    expect(um.removeUser).not.toHaveBeenCalled();
    expect(loginCalls()).toBe(0);
  });
});
