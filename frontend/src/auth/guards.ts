/**
 * Router guards for authentication and role-based access control.
 * Uses return-based guards (Vue Router 5 pattern).
 *
 * Ob zum Login geleitet wird, entscheidet allein `onNavigation` in
 * `auth/session.ts`; die Guards setzen das Ergebnis nur um.
 */

import type { RouteLocationNormalized } from "vue-router";
import {
  currentUserSub,
  ensureAuth,
  onNavigation,
  onRoleUnavailable,
} from "@/auth/session";
import { fetchRole, readStoredRole, refreshRoleOnce } from "@/auth/role";

/** Auth guard: durchlassen oder Navigation abbrechen (Login läuft). */
export async function requireAuth(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
) {
  return onNavigation(to);
}

/**
 * Rolle für den Guard: gespeicherte Rolle (auch offline), sonst `/me` mit
 * gültiger Sitzung. Sonst `null`; den Hinweis entscheidet `session.ts`.
 */
async function resolveRole(): Promise<string | null> {
  const stored = readStoredRole(await currentUserSub());
  if (stored) {
    refreshRoleOnce();
    return stored;
  }
  const state = await ensureAuth();
  if (state !== "valid") {
    onRoleUnavailable(state);
    return null;
  }
  return fetchRole();
}

/**
 * Role guard factory — requires the user to have one of the specified roles.
 * Ohne passende oder ohne bekannte Rolle zur Startseite.
 */
export function requireRole(...roles: string[]) {
  return async (
    to: RouteLocationNormalized,
    _from: RouteLocationNormalized,
  ) => {
    if (!(await onNavigation(to))) return false;
    const role = await resolveRole();
    if (role && roles.includes(role)) return true;
    return { name: "Gallery" };
  };
}
