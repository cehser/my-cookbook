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
 *   (`invalid_grant` u. a.) → neu anmelden
 */
export type AuthState = "valid" | "offline" | "rejected";

/** Token gilt als abgelaufen, wenn er in weniger als so vielen Sekunden abläuft. */
const RENEW_MARGIN_SECONDS = 10;

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
  userStore: new WebStorageStateStore({ store: window.localStorage }),
});

// --- Event handlers for token lifecycle ---

// Proactive renewal shortly before the access token expires
userManager.events.addAccessTokenExpiring(() => {
  void renewToken();
});

// When the user session ends unexpectedly (e.g. IdP session timeout)
userManager.events.addUserSignedOut(() => {
  console.warn("[Auth] User signed out from IdP.");
  if (navigator.onLine) {
    userManager.signinRedirect();
  }
});

// --- Token renewal (single flight) ---

let renewInFlight: Promise<AuthState> | null = null;

function needsRenewal(user: User): boolean {
  const expiresIn = user.expires_in;
  return expiresIn !== undefined && expiresIn <= RENEW_MARGIN_SECONDS;
}

/**
 * Bewertet einen Fehler von `signinSilent()` mit Refresh-Token.
 * Nur eine OAuth-Fehlerantwort des IdP (z. B. `invalid_grant`) bedeutet
 * „abgelehnt“; Netzwerkfehler, Timeout und 5xx gelten als „offline“.
 */
export function classifyRenewError(e: unknown): "offline" | "rejected" {
  if (e instanceof ErrorResponse) return "rejected";
  if (e instanceof Error && e.name === "ErrorResponse") return "rejected";
  return "offline";
}

async function doRenew(): Promise<AuthState> {
  const user = await userManager.getUser();
  if (!user?.refresh_token) return "rejected";
  if (!navigator.onLine) return "offline";

  console.warn("[Auth] Token-Erneuerung per Refresh-Token");
  try {
    await userManager.signinSilent();
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
 * Callback bei neuem Token (Login-Callback oder Erneuerung).
 * Liefert eine Funktion zum Abmelden.
 */
export function onUserLoaded(cb: () => void): () => void {
  return userManager.events.addUserLoaded(() => cb());
}

// --- Redirect flows ---

/** Redirect to IdP login page */
export async function login(): Promise<void> {
  await userManager.signinRedirect();
}

/** Handle the callback after IdP redirect */
export async function handleCallback(): Promise<User> {
  return await userManager.signinRedirectCallback();
}

/** Logout — redirect to IdP logout */
export async function logout(): Promise<void> {
  await userManager.signoutRedirect();
}

/** Get the currently authenticated user (or null) */
export async function getUser(): Promise<User | null> {
  return await userManager.getUser();
}

export { userManager };
