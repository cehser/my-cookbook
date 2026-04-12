/**
 * Router guards for authentication and role-based access control.
 * Uses return-based guards (Vue Router 5 pattern).
 */

import type { RouteLocationNormalized } from "vue-router";
import { isAuthenticated, login } from "@/auth/oidc";
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

/**
 * Auth guard — redirects to IdP login if not authenticated.
 * When offline, allows navigation with cached data (read-only mode).
 */
export async function requireAuth(
  _to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
) {
  if (await isAuthenticated()) return true;
  if (!navigator.onLine) return true;
  await login();
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
    if (!(await isAuthenticated())) {
      if (!navigator.onLine) return { name: "Gallery" };
      await login();
      return false;
    }

    const userRole = await getUserRole();
    if (userRole && roles.includes(userRole)) return true;
    return { name: "Gallery" };
  };
}
