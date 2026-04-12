/**
 * OIDC Authentication via oidc-client-ts (IdP-agnostic).
 *
 * Config is injected at runtime via /config.js → window.__CONFIG__
 * (no compile-time env vars needed).
 */

import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";

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
  automaticSilentRenew: true,
  // Keep user session alive: check token 60s before expiry
  accessTokenExpiringNotificationTimeInSeconds: 60,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
});

// --- Event handlers for token lifecycle ---

// When silent renew fails, log the error but do NOT immediately redirect.
// The 401-retry in the API client will call refreshToken() explicitly,
// and only if that also fails will the user see an error or re-login.
userManager.events.addSilentRenewError((error) => {
  console.warn("[Auth] Silent renew failed:", error);
});

// When the access token is about to expire, log for debugging
userManager.events.addAccessTokenExpiring(() => {
  console.warn(
    "[Auth] Access token expiring soon, silent renew should trigger automatically.",
  );
});

// When the user session ends unexpectedly (e.g. IdP session timeout)
userManager.events.addUserSignedOut(() => {
  console.warn("[Auth] User signed out from IdP.");
  if (navigator.onLine) {
    userManager.signinRedirect();
  }
});

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

/** Get a valid access token (auto-refreshed if expired) */
export async function getAccessToken(): Promise<string | null> {
  const user = await userManager.getUser();
  if (!user || user.expired) {
    return null;
  }
  return user.access_token;
}

/** Try to silently refresh the token. Returns new token or null on failure. */
export async function refreshToken(): Promise<string | null> {
  try {
    const user = await userManager.signinSilent();
    return user?.access_token ?? null;
  } catch (e) {
    console.warn("[Auth] Token refresh failed:", e);
    return null;
  }
}

/** Check whether the user is authenticated */
export async function isAuthenticated(): Promise<boolean> {
  const user = await userManager.getUser();
  return user !== null && !user.expired;
}

export { userManager };
