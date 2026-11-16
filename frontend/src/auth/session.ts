/**
 * Sitzung: Token-Erneuerung, Auth-Zustand und die **einzige** Entscheidung,
 * ob und wann die App zum Login leitet.
 *
 * Einstiege je Auslöser (Zustandstabelle in docs/tasks/W.23-auth-feinschliff.md):
 * `onNavigation` (Guards), `onResume` und `onOnline` (App.vue),
 * `onRejected` (abgelehnte Erneuerung: Ablauf-Timer, 401, Store, Guard),
 * `onCallback`/`retryLoginFromCallback` (Callback.vue). Nur diese Einstiege
 * prüfen „Netz“ (`navigator.onLine`) für die Login-Entscheidung.
 *
 * Erneuerung: Alle Aufrufer (Guard, API-Client, Store, Ablauf-Timer) teilen
 * sich einen Versuch (Single-Flight); über Tabs hinweg sperrt Web Locks.
 * oidc-client-ts fasst parallele `signinSilent()`-Aufrufe nicht zusammen; mit
 * Refresh-Token geht `signinSilent()` direkt an den Token-Endpunkt (kein iframe).
 *
 * Importiert von den Auth-Modulen nur `userManager.ts` (kein Zyklus).
 */

import { readonly, shallowRef } from "vue";
import { ErrorResponse, type User } from "oidc-client-ts";
import { userManager } from "@/auth/userManager";
import { hasCachedRecipes } from "@/js/offlineCache";

/**
 * Ergebnis der Auth-Prüfung:
 * - `valid`: gültiger Access-Token liegt vor (ggf. gerade erneuert)
 * - `offline`: Erneuerung nicht möglich (kein Netz, Timeout, IdP nicht
 *   erreichbar) → Offline-Cache verwenden
 * - `rejected`: keine Sitzung, kein Refresh-Token oder vom IdP abgelehnt
 *   (`invalid_grant`, `invalid_client`, `unauthorized_client`) → neu anmelden
 */
export type AuthState = "valid" | "offline" | "rejected";

/** Token gilt als abgelaufen, wenn er in weniger als so vielen Sekunden abläuft. */
const RENEW_MARGIN_SECONDS = 10;

/**
 * Timeout der Erneuerung am Token-Endpunkt. Muss bei jedem `signinSilent()`
 * übergeben werden: oidc-client-ts 3.5 überschreibt den Settings-Default
 * per Spread mit `undefined` (`signinSilent` → `_useRefreshToken`), dann
 * liefe der Abruf ohne Timeout.
 */
export const RENEW_TIMEOUT_SECONDS = 10;

/** Nach einer als `offline` gewerteten Erneuerung mit Netz: so lange kein neuer Versuch. */
const RENEW_BACKOFF_MS = 30 * 1000;

/** Web-Lock-Name: eine Erneuerung zur Zeit über alle Tabs. */
const RENEW_LOCK = "my-cookbook-token-renewal";

/** So lange wird höchstens auf den Lock gewartet (Erneuerung selbst: 10 s). */
const RENEW_LOCK_TIMEOUT_MS = 15 * 1000;

// --- Hinweise für die Oberfläche ---

/**
 * Hinweis statt leerem Bildschirm (App.vue zeigt ihn an):
 * - `no-data`: keine Verbindung (bzw. IdP nicht erreichbar) und noch keine Daten
 * - `role-unavailable`: Seite braucht eine Rolle, die ohne Verbindung nicht bekannt ist
 * Verschwindet, sobald die Sitzung gültig ist.
 */
export type SessionHint = "no-data" | "role-unavailable" | null;
const hint = shallowRef<SessionHint>(null);
export const sessionHint = readonly(hint);

/**
 * Rollen-Guard ohne bekannte Rolle: Hinweis nur, wenn die Verbindung fehlt
 * (kein Netz oder Sitzung `offline`). Bei `rejected` mit Netz startet der
 * Login, ein Hinweis wäre irreführend.
 */
export function onRoleUnavailable(state: AuthState): void {
  if (state === "offline" || (state === "rejected" && !navigator.onLine)) {
    hint.value = "role-unavailable";
  }
}

// --- Token renewal (single flight, Web Lock, Backoff) ---

let renewInFlight: Promise<AuthState> | null = null;
let backoffUntil = 0;

function needsRenewal(user: User): boolean {
  const expiresIn = user.expires_in;
  return expiresIn !== undefined && expiresIn <= RENEW_MARGIN_SECONDS;
}

/** OAuth-Fehlercodes, bei denen eine Wiederholung nichts bringt. */
const REJECTING_ERRORS = new Set([
  "invalid_grant",
  "invalid_client",
  "unauthorized_client",
]);

/**
 * Bewertet einen Fehler von `signinSilent()` mit Refresh-Token.
 * oidc-client-ts erzeugt `ErrorResponse` bei jeder Nicht-2xx-Antwort mit
 * OAuth-JSON, also auch bei 5xx/429 (`server_error`,
 * `temporarily_unavailable`). „Abgelehnt“ gilt daher nur für die Codes in
 * REJECTING_ERRORS; alles andere (auch Netzwerkfehler, Timeout, 5xx ohne
 * JSON) gilt als „offline“.
 */
export function classifyRenewError(e: unknown): "offline" | "rejected" {
  const isErrorResponse =
    e instanceof ErrorResponse ||
    (e instanceof Error && e.name === "ErrorResponse");
  if (!isErrorResponse) return "offline";
  const code = (e as { error?: unknown }).error;
  return typeof code === "string" && REJECTING_ERRORS.has(code)
    ? "rejected"
    : "offline";
}

/**
 * Führt `fn` unter dem Web Lock aus (ein Tab erneuert zur Zeit). Ohne
 * `navigator.locks` (iOS < 15.4, unsicherer Kontext) direkt.
 * Das Warten auf den Lock ist begrenzt: Hängt ein anderer Tab (eingefroren,
 * Debugger), gilt die Erneuerung als `offline`, statt `getAccessToken`, Guard
 * und `logout()` zu blockieren. Eine Exception in `fn` gibt den Lock frei
 * (Web-Locks-Semantik) und wird weitergereicht.
 */
async function withRenewLock(fn: () => Promise<AuthState>): Promise<AuthState> {
  const locks = (navigator as Navigator & { locks?: LockManager | null }).locks;
  if (!locks?.request) return fn();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RENEW_LOCK_TIMEOUT_MS);
  try {
    return await locks.request(
      RENEW_LOCK,
      { signal: controller.signal },
      () => {
        clearTimeout(timer); // begrenzt nur das Warten, nicht die Erneuerung
        return fn();
      },
    );
  } catch (e) {
    if (!controller.signal.aborted) throw e;
    console.warn("[Auth] Kein Lock für die Token-Erneuerung (Timeout)");
    return "offline";
  } finally {
    clearTimeout(timer);
  }
}

async function doRenew(): Promise<AuthState> {
  // Während des Logouts keine neue Erneuerung (Rennen mit dem Widerruf).
  if (logoutInProgress) return "offline";
  const state = await renewOnce();
  if (state === "rejected" && !logoutInProgress) onRejected();
  return state;
}

async function renewOnce(): Promise<AuthState> {
  const before = await userManager.getUser();
  if (!before?.refresh_token) return "rejected";
  if (!navigator.onLine) return "offline";
  if (Date.now() < backoffUntil) return "offline";

  return withRenewLock(async () => {
    // Unter dem Lock neu lesen: Ein anderer Tab kann inzwischen erneuert
    // (Token ersetzt) oder die Sitzung verworfen haben.
    const user = await userManager.getUser();
    if (!user?.refresh_token) return "rejected";
    if (user.access_token !== before.access_token && !needsRenewal(user)) {
      return "valid";
    }

    console.warn("[Auth] Token-Erneuerung per Refresh-Token");
    try {
      await userManager.signinSilent({
        silentRequestTimeoutInSeconds: RENEW_TIMEOUT_SECONDS,
      });
      backoffUntil = 0;
      return "valid";
    } catch (e) {
      const state = classifyRenewError(e);
      if (state === "offline") {
        console.warn("[Auth] Token-Erneuerung nicht möglich (offline):", e);
        // Mit Netz (IdP hängt, 5xx): nicht bei jedem API-Aufruf neu versuchen.
        if (navigator.onLine) backoffUntil = Date.now() + RENEW_BACKOFF_MS;
        return state;
      }
      // Hat ein anderer Tab den Refresh-Token inzwischen rotiert (ohne Lock
      // oder außerhalb davon), gilt dessen Ergebnis.
      const current = await userManager.getUser();
      if (
        current &&
        current.refresh_token !== user.refresh_token &&
        !needsRenewal(current)
      ) {
        return "valid";
      }
      console.warn("[Auth] Anmeldung abgelehnt, Sitzung wird verworfen:", e);
      await userManager.removeUser();
      return state;
    }
  });
}

/** Erneuert den Access-Token; parallele Aufrufer teilen sich einen Versuch. */
export function renewToken(): Promise<AuthState> {
  renewInFlight ??= doRenew().finally(() => {
    renewInFlight = null;
  });
  return renewInFlight;
}

/** Laufende Erneuerung oder `null` (logout() wartet darauf). */
export function currentRenewal(): Promise<AuthState> | null {
  return renewInFlight;
}

// Proaktive Erneuerung kurz vor Ablauf (Single-Flight wie alle anderen).
userManager.events.addAccessTokenExpiring(() => {
  void renewToken();
});

/** Klärt den Auth-Zustand; erneuert den Token, falls er abgelaufen ist. */
export async function ensureAuth(): Promise<AuthState> {
  const user = await userManager.getUser();
  if (!user) return "rejected";
  if (!needsRenewal(user)) return "valid";
  return renewToken();
}

/** Gültiger Access-Token (bei Ablauf erneuert) oder `null`. */
export async function getAccessToken(): Promise<string | null> {
  if ((await ensureAuth()) !== "valid") return null;
  const user = await userManager.getUser();
  return user?.access_token ?? null;
}

/**
 * Nach einer 401-Antwort: Token erneuern, außer ein anderer Aufrufer hat den
 * verwendeten Token bereits ersetzt. Liefert den neuen Token oder `null`.
 */
export async function renewAfterUnauthorized(
  usedToken: string,
): Promise<string | null> {
  const user = await userManager.getUser();
  if (user && user.access_token !== usedToken && !needsRenewal(user)) {
    return user.access_token;
  }
  if ((await renewToken()) !== "valid") return null;
  return (await userManager.getUser())?.access_token ?? null;
}

/** Gültige Anmeldung vorhanden (abgelaufene Tokens werden erneuert). */
export async function isAuthenticated(): Promise<boolean> {
  return (await ensureAuth()) === "valid";
}

/** `sub` der gespeicherten Sitzung (auch abgelaufen) oder `null`. */
export async function currentUserSub(): Promise<string | null> {
  return (await userManager.getUser())?.profile.sub ?? null;
}

// --- Login-Redirect ---

let loginStarted = false;
let logoutInProgress = false;
/** Login wurde ohne Netz verlangt; beim nächsten Auslöser mit Netz ausführen. */
let loginPending = false;

/** Logout läuft: keine neue Erneuerung, kein Login-Redirect. */
export function isLogoutInProgress(): boolean {
  return logoutInProgress;
}

/** Logout beginnt bzw. ist gescheitert (oidc.logout). */
export function setLogoutInProgress(value: boolean): void {
  logoutInProgress = value;
  if (value) loginPending = false;
}

// Rückkehr per Zurück aus dem bfcache (z. B. vom IdP): Die Seite lebt mit
// altem Modulzustand weiter, ein neuer Login bzw. Logout muss möglich sein.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    loginStarted = false;
    logoutInProgress = false;
  }
});

/**
 * Einzige Stelle, die zum IdP-Login umleitet. Wirkt höchstens einmal pro
 * Seite, nur online und nicht während des Logouts. Ein Rücksprung auf
 * /callback wird durch "/" ersetzt (keine Schleife über den Callback).
 * Liefert `true`, wenn der Redirect gestartet wurde; bei Erfolg löst das
 * Promise erst bei Rückkehr per Zurück (bfcache) auf.
 */
async function requestLogin(returnUrl: string): Promise<boolean> {
  if (loginStarted || logoutInProgress || !navigator.onLine) return false;
  const target = returnUrl.startsWith("/callback") ? "/" : returnUrl;
  loginStarted = true;
  sessionStorage.setItem("oidc-return-url", target);
  try {
    await userManager.signinRedirect();
    // Der Redirect lief (Rückkehr per Zurück): Vormerkung erledigt. Scheitert
    // er (Discovery-Timeout), bleibt sie für den nächsten Auslöser mit Netz.
    loginPending = false;
    return true;
  } catch (e) {
    loginStarted = false;
    console.warn("[Auth] Login-Redirect fehlgeschlagen:", e);
    return false;
  }
}

let loginTarget: () => string | null = () => null;

/**
 * Der Router meldet, wohin nach dem Login zurückgesprungen wird: aktuelle
 * bzw. gerade angesteuerte Route, `null` für öffentliche Routen.
 */
export function setLoginTargetResolver(resolve: () => string | null): void {
  loginTarget = resolve;
}

/**
 * Login für `target` (Standard: aktuelle Route); ohne Netz vormerken.
 * Öffentliche Routen (`null`) und Logout lösen nichts aus.
 */
function loginOrDefer(target: string | null = loginTarget()): void {
  if (!target || logoutInProgress) return;
  if (!navigator.onLine) {
    loginPending = true;
    return;
  }
  void requestLogin(target);
}

function sessionValid(): void {
  loginPending = false;
  hint.value = null;
}

// --- Einstiege je Auslöser ---

/**
 * Navigation auf eine geschützte Route (Guard). `true` = durchlassen.
 * Mit Offline-Daten wartet der Guard nicht auf die Erneuerung; stellt sich
 * die Sitzung danach als abgelehnt heraus, folgt der Login (bzw. vorgemerkt).
 * Ohne Daten wartet er (höchstens bis zum Timeout der Erneuerung) und zeigt
 * statt eines leeren Bildschirms einen Hinweis, wenn er nicht zum Login leiten
 * kann.
 */
export async function onNavigation(to: { fullPath: string }): Promise<boolean> {
  const auth = ensureAuth();
  if (await hasCachedRecipes()) {
    void auth.then((state) => {
      if (state === "valid") sessionValid();
      else if (state === "rejected") loginOrDefer(to.fullPath);
    });
    return true;
  }
  const state = await auth;
  if (state === "valid") {
    sessionValid();
    return true;
  }
  if (state === "rejected") {
    if (navigator.onLine) {
      // Redirect gestartet bzw. schon unterwegs: Navigation abbrechen.
      if ((await requestLogin(to.fullPath)) || loginStarted) return false;
      // Redirect nicht möglich (IdP hängt, Logout): wie offline.
    } else {
      loginOrDefer(to.fullPath);
    }
  }
  hint.value = "no-data";
  return true;
}

/** App wieder im Vordergrund: Zustand klären (erneuert abgelaufene Tokens). */
export async function onResume(): Promise<AuthState> {
  const state = await ensureAuth();
  if (state === "valid") sessionValid();
  else if (state === "rejected" || (loginPending && navigator.onLine)) {
    loginOrDefer();
  }
  return state;
}

/**
 * Wieder online: vorgemerkten Login ausführen bzw. ohne Sitzung zum Login,
 * sonst Zustand klären. Ein laufendes Backoff endet (Netz hat gewechselt).
 */
export async function onOnline(): Promise<AuthState> {
  backoffUntil = 0;
  const state = await ensureAuth();
  if (state === "valid") sessionValid();
  else if (state === "rejected" || loginPending) loginOrDefer();
  return state;
}

/** Erneuerung abgelehnt (Ablauf-Timer, 401, Store, Guard): Login für die aktuelle Route. */
export function onRejected(): void {
  loginOrDefer();
}

// --- Login-Callback ---

const LOGIN_ATTEMPTS_KEY = "oidc-login-attempts";
/** Automatische Login-Wiederholungen nach einem Callback-Fehler. */
const MAX_AUTO_LOGIN_ATTEMPTS = 1;
/** `state` des zuletzt verarbeiteten Callbacks (überlebt Reload). */
const CALLBACK_HANDLED_KEY = "oidc-callback-handled";

/**
 * Verbraucht eine automatische Login-Wiederholung (sessionStorage, überlebt
 * den Redirect). `false`, wenn das Limit erreicht ist.
 */
function takeAutoLoginAttempt(): boolean {
  const used = Number(sessionStorage.getItem(LOGIN_ATTEMPTS_KEY) ?? 0);
  if (used >= MAX_AUTO_LOGIN_ATTEMPTS) return false;
  sessionStorage.setItem(LOGIN_ATTEMPTS_KEY, String(used + 1));
  return true;
}

function resetLoginAttempts(): void {
  sessionStorage.removeItem(LOGIN_ATTEMPTS_KEY);
}

let callbackRun: { key: string; result: Promise<boolean> } | null = null;

/**
 * Verarbeitet die Antwort des IdP auf /callback genau einmal: Ein zweiter
 * Mount teilt das laufende Ergebnis, ein Reload derselben URL ruft den Token-
 * Endpunkt nicht erneut auf (der Code ist nur einmal gültig), sondern prüft
 * nur, ob die Sitzung schon da ist. Bei Fehler einmal automatisch neu
 * anmelden (z. B. veralteter state nach Zurück), danach `false`: Callback.vue
 * zeigt eine Meldung statt Spinner oder Schleife.
 */
export function onCallback(returnUrl: string): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const key = params.get("state") ?? window.location.search;
  if (callbackRun?.key !== key) {
    callbackRun = { key, result: processCallback(key, returnUrl) };
  }
  return callbackRun.result;
}

async function processCallback(
  key: string,
  returnUrl: string,
): Promise<boolean> {
  try {
    if (sessionStorage.getItem(CALLBACK_HANDLED_KEY) === key) {
      if (!(await userManager.getUser())) {
        throw new Error("Callback bereits verarbeitet, keine Sitzung");
      }
    } else {
      // Vor dem Abruf merken: Ein Reload mitten im Abruf darf den Code nicht
      // ein zweites Mal einlösen.
      sessionStorage.setItem(CALLBACK_HANDLED_KEY, key);
      await userManager.signinRedirectCallback();
    }
    resetLoginAttempts();
    sessionValid();
    return true;
  } catch (e) {
    console.error("[Auth] Login-Callback fehlgeschlagen:", e);
    if (takeAutoLoginAttempt()) await requestLogin(returnUrl);
    return false;
  }
}

/** Manueller Neuversuch nach gescheitertem Callback (setzt das Limit zurück). */
export async function retryLoginFromCallback(returnUrl: string): Promise<void> {
  resetLoginAttempts();
  await requestLogin(returnUrl);
}
