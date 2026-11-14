/**
 * Sitzungszustand: Token-Erneuerung (Single-Flight), Auth-Zustand und
 * Ereignis bei abgelehnter Sitzung.
 *
 * Alle Aufrufer (Guard, API-Client, Store, Ablauf-Timer) teilen sich eine
 * laufende Erneuerung. oidc-client-ts fasst parallele `signinSilent()`-Aufrufe
 * nicht zusammen; mit Refresh-Token geht `signinSilent()` direkt an den
 * Token-Endpunkt (kein iframe).
 *
 * Zyklischer Import mit `auth/oidc.ts` (UserManager, Login, Logout): Beide
 * Module nutzen die Bindungen des anderen nur in Funktionen, nie auf oberster
 * Ebene. Das muss so bleiben, sonst greift die Temporal Dead Zone.
 */

import { ErrorResponse, type User } from "oidc-client-ts";
import {
  isLogoutInProgress,
  requestLoginForCurrentRoute,
  userManager,
} from "@/auth/oidc";

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
  if (isLogoutInProgress()) return "offline";
  const state = await renewOnce();
  if (state === "rejected" && !isLogoutInProgress()) notifyRejected();
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

/** Laufende Erneuerung oder `null` (logout() wartet darauf). */
export function currentRenewal(): Promise<AuthState> | null {
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
 * App wieder im Vordergrund: Auth-Zustand prüfen (erneuert abgelaufene
 * Tokens) und bei abgelehnter Sitzung online zum Login. Wirkt auch, wenn
 * keine Sitzung mehr gespeichert ist und deshalb keine Erneuerung läuft.
 */
export async function checkSessionOnResume(): Promise<AuthState> {
  const state = await ensureAuth();
  if (state === "rejected" && navigator.onLine) requestLoginForCurrentRoute();
  return state;
}
