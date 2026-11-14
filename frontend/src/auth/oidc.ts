/**
 * OIDC Authentication via oidc-client-ts (IdP-agnostic).
 *
 * Config is injected at runtime via /config.js → window.__CONFIG__
 * (no compile-time env vars needed).
 *
 * Token-Erneuerung: Alle Aufrufer (Guard, API-Client, Store, Ablauf-Timer)
 * teilen sich eine laufende Erneuerung (Single-Flight). oidc-client-ts fasst
 * parallele `signinSilent()`-Aufrufe nicht zusammen; mit Refresh-Token geht
 * `signinSilent()` direkt an den Token-Endpunkt (kein iframe).
 */

import {
  ErrorResponse,
  UserManager,
  WebStorageStateStore,
  type User,
} from "oidc-client-ts";

const cfg =
  (window as unknown as Record<string, Record<string, string>>).__CONFIG__ ||
  {};
const authority =
  cfg.OIDC_AUTHORITY || (import.meta.env.VITE_OIDC_AUTHORITY as string);
const clientId =
  cfg.OIDC_CLIENT_ID || (import.meta.env.VITE_OIDC_CLIENT_ID as string);

if (!authority || !clientId) {
  console.warn(
    "[Auth] VITE_OIDC_AUTHORITY and VITE_OIDC_CLIENT_ID must be set for OIDC login.",
  );
}

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
const RENEW_TIMEOUT_SECONDS = 10;

const userManager = new UserManager({
  authority,
  client_id: clientId,
  redirect_uri: `${window.location.origin}/callback`,
  silent_redirect_uri: `${window.location.origin}/silent-renew.html`,
  post_logout_redirect_uri: window.location.origin,
  response_type: "code",
  scope: "openid profile email offline_access",
  // Eigene Erneuerung über renewToken() (Single-Flight) statt des
  // eingebauten SilentRenewService, der signinSilent() direkt aufruft.
  automaticSilentRenew: false,
  accessTokenExpiringNotificationTimeInSeconds: 60,
  // Ohne diesen Wert laufen Discovery- und JWKS-Abrufe ohne Timeout; bei
  // hängender Verbindung blockierte dann der Guard die Navigation.
  requestTimeoutInSeconds: 10,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
});

// --- Event handlers for token lifecycle ---

// Proactive renewal shortly before the access token expires
userManager.events.addAccessTokenExpiring(() => {
  void renewToken();
});

// Kein Session-Monitoring (`monitorSession` bleibt aus): Es braucht das
// check_session_iframe des IdP und Drittanbieter-Cookies (iOS/ITP). Das Ende
// der IdP-Session wird erst wirksam, wenn der IdP die Token-Erneuerung
// ablehnt (→ `rejected` → Login). Wie lange ein Offline-Token gilt, ist
// eine Einstellung im IdP.

// --- Token renewal (single flight) ---

let renewInFlight: Promise<AuthState> | null = null;
const rejectedListeners = new Set<() => void>();

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

function notifyRejected(): void {
  rejectedListeners.forEach((cb) => cb());
}

async function doRenew(): Promise<AuthState> {
  // Während des Logouts keine neue Erneuerung (Rennen mit dem Widerruf).
  if (logoutInProgress) return "offline";
  const state = await renewOnce();
  if (state === "rejected" && !logoutInProgress) notifyRejected();
  return state;
}

async function renewOnce(): Promise<AuthState> {
  const user = await userManager.getUser();
  if (!user?.refresh_token) return "rejected";
  if (!navigator.onLine) return "offline";

  console.warn("[Auth] Token-Erneuerung per Refresh-Token");
  try {
    await userManager.signinSilent({
      silentRequestTimeoutInSeconds: RENEW_TIMEOUT_SECONDS,
    });
    return "valid";
  } catch (e) {
    const state = classifyRenewError(e);
    if (state === "offline") {
      console.warn("[Auth] Token-Erneuerung nicht möglich (offline):", e);
      return state;
    }
    // Hat ein anderer Tab den Refresh-Token inzwischen rotiert, gilt dessen Ergebnis.
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
}

/** Erneuert den Access-Token; parallele Aufrufer teilen sich einen Versuch. */
export function renewToken(): Promise<AuthState> {
  renewInFlight ??= doRenew().finally(() => {
    renewInFlight = null;
  });
  return renewInFlight;
}

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

/**
 * Callback, wenn eine Token-Erneuerung mit `rejected` endet (Ablauf-Timer,
 * 401-Pfad, Guard, Store). Liefert eine Funktion zum Abmelden.
 */
export function onSessionRejected(cb: () => void): () => void {
  rejectedListeners.add(cb);
  return () => rejectedListeners.delete(cb);
}

/**
 * Callback bei neuem Token (Login-Callback oder Erneuerung).
 * Liefert eine Funktion zum Abmelden.
 */
export function onUserLoaded(cb: () => void): () => void {
  return userManager.events.addUserLoaded(() => cb());
}

// --- Redirect flows ---

let loginStarted = false;
let logoutInProgress = false;

// Rückkehr per Zurück aus dem bfcache (z. B. vom IdP): Die Seite lebt mit
// altem Modulzustand weiter, ein neuer Login bzw. Logout muss möglich sein.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    loginStarted = false;
    logoutInProgress = false;
  }
});

const LOGIN_ATTEMPTS_KEY = "oidc-login-attempts";
/** Automatische Login-Wiederholungen nach einem Callback-Fehler. */
const MAX_AUTO_LOGIN_ATTEMPTS = 1;

/**
 * Verbraucht eine automatische Login-Wiederholung (sessionStorage, überlebt
 * den Redirect). `false`, wenn das Limit erreicht ist.
 */
export function takeAutoLoginAttempt(): boolean {
  const used = Number(sessionStorage.getItem(LOGIN_ATTEMPTS_KEY) ?? 0);
  if (used >= MAX_AUTO_LOGIN_ATTEMPTS) return false;
  sessionStorage.setItem(LOGIN_ATTEMPTS_KEY, String(used + 1));
  return true;
}

/** Nach erfolgreichem Login oder manuellem Neuversuch. */
export function resetLoginAttempts(): void {
  sessionStorage.removeItem(LOGIN_ATTEMPTS_KEY);
}

/**
 * Einzige Stelle, die zum IdP-Login umleitet. Wirkt höchstens einmal pro
 * Seite, nur online und nicht während des Logouts. Ein Rücksprung auf
 * /callback wird durch "/" ersetzt (keine Schleife über den Callback).
 * Liefert `true`, wenn der Redirect gestartet wurde.
 */
export async function requestLogin(returnUrl: string): Promise<boolean> {
  if (loginStarted || logoutInProgress || !navigator.onLine) return false;
  const target = returnUrl.startsWith("/callback") ? "/" : returnUrl;
  loginStarted = true;
  sessionStorage.setItem("oidc-return-url", target);
  try {
    await userManager.signinRedirect();
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

/** Login für die aktuelle Route (öffentliche Routen bleiben, wie sie sind). */
export function requestLoginForCurrentRoute(): void {
  const target = loginTarget();
  if (target) void requestLogin(target);
}

/**
 * App wieder im Vordergrund: Auth-Zustand prüfen (erneuert abgelaufene
 * Tokens) und bei abgelehnter Sitzung online zum Login. Wirkt auch, wenn
 * keine Sitzung mehr gespeichert ist und deshalb keine Erneuerung läuft.
 */
export async function checkSessionOnResume(): Promise<AuthState> {
  const state = await ensureAuth();
  if (state === "rejected" && navigator.onLine) requestLoginForCurrentRoute();
  return state;
}

/**
 * Verarbeitet die Antwort des IdP auf /callback. Bei Fehler einmal
 * automatisch neu anmelden (z. B. veralteter state nach Zurück), danach
 * `false`: Callback.vue zeigt eine Meldung statt Spinner oder Schleife.
 * requestLogin() kehrt erst bei Rückkehr per Zurück (bfcache) zurück.
 */
export async function handleCallback(returnUrl: string): Promise<boolean> {
  try {
    await userManager.signinRedirectCallback();
    resetLoginAttempts();
    return true;
  } catch (e) {
    console.error("[Auth] Login-Callback fehlgeschlagen:", e);
    if (takeAutoLoginAttempt()) await requestLogin(returnUrl);
    return false;
  }
}

const REVOKE_TIMEOUT_MS = 5000;

/**
 * Logout: widerruft zuerst den Refresh-Token (RFC 7009), weil ein Logout
 * beim IdP Offline-Tokens nicht zwingend beendet, dann Redirect zum IdP.
 * Ein fehlgeschlagener Widerruf (kein Revocation-Endpunkt, kein Netz)
 * blockiert den Logout nicht; deshalb nicht `revokeTokensOnSignout`, das
 * bei einem Fehler den ganzen Logout abbricht.
 * Während des Logouts startet keine Erneuerung und kein Login; eine bereits
 * laufende Erneuerung wird abgewartet, damit der aktuelle Token widerrufen
 * wird und nicht ein gerade rotierter.
 */
export async function logout(): Promise<void> {
  logoutInProgress = true;
  await renewInFlight?.catch(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      userManager.revokeTokens(["refresh_token"]),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Timeout beim Token-Widerruf")),
          REVOKE_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (e) {
    console.warn("[Auth] Refresh-Token konnte nicht widerrufen werden:", e);
  } finally {
    clearTimeout(timer);
  }
  try {
    await userManager.signoutRedirect();
  } catch (e) {
    logoutInProgress = false;
    throw e;
  }
}

/** Get the currently authenticated user (or null) */
export async function getUser(): Promise<User | null> {
  return await userManager.getUser();
}

export { userManager };
