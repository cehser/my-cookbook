/**
 * Router guards for authentication and role-based access control.
 */

import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import { isAuthenticated, login, getUser } from '@/auth/oidc'
import { api } from '@/api/client'

interface MeResponse {
  oidc_sub: string
  display_name: string
  role: string
}

let cachedRole: string | null = null

/** Fetch and cache the current user's role from the backend */
async function getUserRole(): Promise<string | null> {
  if (cachedRole) return cachedRole
  try {
    const me = await api.get<MeResponse>('/me')
    cachedRole = me.role
    return cachedRole
  } catch {
    return null
  }
}

/** Clear cached role (call on logout) */
export function clearRoleCache(): void {
  cachedRole = null
}

/**
 * Auth guard — redirects to IdP login if not authenticated.
 * When offline, allows navigation with cached data (read-only mode).
 */
export async function requireAuth(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext,
): Promise<void> {
  if (await isAuthenticated()) {
    next()
  } else if (!navigator.onLine) {
    // Offline: allow navigation with cached IDB data (read-only)
    next()
  } else {
    await login()
  }
}

/**
 * Role guard factory — requires the user to have one of the specified roles.
 */
export function requireRole(...roles: string[]) {
  return async (
    to: RouteLocationNormalized,
    _from: RouteLocationNormalized,
    next: NavigationGuardNext,
  ): Promise<void> => {
    if (!(await isAuthenticated())) {
      if (!navigator.onLine) {
        next({ name: 'Gallery' })
        return
      }
      await login()
      return
    }

    const userRole = await getUserRole()
    if (userRole && roles.includes(userRole)) {
      next()
    } else {
      next({ name: 'Gallery' })
    }
  }
}
