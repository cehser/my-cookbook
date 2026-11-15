/**
 * Einzige `UserManager`-Instanz (oidc-client-ts, IdP-agnostisch).
 *
 * Config is injected at runtime via /config.js → window.__CONFIG__
 * (no compile-time env vars needed).
 *
 * Importiert keine anderen Auth-Module: `session.ts` (Erneuerung, Login-
 * Entscheidung) und `oidc.ts` (Logout, Ereignisse) bauen darauf auf.
 */

import { UserManager, WebStorageStateStore } from "oidc-client-ts";

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

export const userManager = new UserManager({
  authority,
  client_id: clientId,
  redirect_uri: `${window.location.origin}/callback`,
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

// Kein Session-Monitoring (`monitorSession` bleibt aus): Es braucht das
// check_session_iframe des IdP und Drittanbieter-Cookies (iOS/ITP). Das Ende
// der IdP-Session wird erst wirksam, wenn der IdP die Token-Erneuerung
// ablehnt (→ `rejected` → Login). Wie lange ein Offline-Token gilt, ist
// eine Einstellung im IdP.
