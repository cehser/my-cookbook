/**
 * OIDC Authentication via oidc-client-ts (IdP-agnostic): UserManager-Setup,
 * Login-Redirect, Login-Callback und Logout. Token-Erneuerung und
 * Auth-Zustand liegen in `auth/session.ts`.
 *
 * Config is injected at runtime via /config.js → window.__CONFIG__
 * (no compile-time env vars needed).
 *
 * Zyklischer Import mit `auth/session.ts`: Beide Module nutzen die
 * Bindungen des anderen nur in Funktionen, nie auf oberster Ebene. Das muss
 * so bleiben, sonst greift die Temporal Dead Zone.
 */

import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";
import { currentRenewal, renewToken } from "@/auth/session";

// Weiterhin hier importierbar (api/ai.ts, api/images.ts)
export { getAccessToken } from "@/auth/session";

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

/** Logout läuft: keine neue Erneuerung, kein Login-Redirect. */
export function isLogoutInProgress(): boolean {
  return logoutInProgress;
}

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
  await currentRenewal()?.catch(() => undefined);
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
