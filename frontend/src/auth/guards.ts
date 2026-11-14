/**
 * Router guards for authentication and role-based access control.
 * Uses return-based guards (Vue Router 5 pattern).
 */

import type { RouteLocationNormalized } from "vue-router";
import { ensureAuth, requestLogin, type AuthState } from "@/auth/oidc";
import { api } from "@/api/client";

interface MeResponse {
  oidc_sub: string;
  display_name: string;
  role: string;
}

let cachedRole: string | null = null;

/** Fetch and cache the current user's role from the backend */
async function getUserRole(): Promise<string | null> {
  if (cachedRole) return cachedRole;
  try {
    const me = await api.get<MeResponse>("/me");
    cachedRole = me.role;
    return cachedRole;
  } catch {
    return null;
  }
}

/** Clear cached role (call on logout) */
export function clearRoleCache(): void {
  cachedRole = null;
}

// Number of guards currently awaiting the auth state. While a guard runs, it
// decides about the login itself (it knows the target route).
let activeGuards = 0;

/** True while a route guard is resolving the auth state. */
export function isGuardActive(): boolean {
  return activeGuards > 0;
}

async function guardAuth(): Promise<AuthState> {
  activeGuards++;
  try {
    return await ensureAuth();
  } finally {
    activeGuards--;
  }
}

/**
 * Auth guard — redirects to IdP login if the session was rejected.
 * When the token cannot be renewed for lack of network (or without network
 * at all), allows navigation with cached data (read-only mode).
 */
export async function requireAuth(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
) {
  const state = await guardAuth();
  if (state !== "rejected") return true;
  if (!navigator.onLine) return true;
  await requestLogin(to.fullPath);
  return false;
}

/**
 * Role guard factory — requires the user to have one of the specified roles.
 */
export function requireRole(...roles: string[]) {
  return async (
    _to: RouteLocationNormalized,
    _from: RouteLocationNormalized,
  ) => {
    const state = await guardAuth();
    if (state === "offline") return { name: "Gallery" };
    if (state === "rejected") {
      if (!navigator.onLine) return { name: "Gallery" };
      await requestLogin(_to.fullPath);
      return false;
    }

    const userRole = await getUserRole();
    if (userRole && roles.includes(userRole)) return true;
    return { name: "Gallery" };
  };
}
