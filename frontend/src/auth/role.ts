/**
 * Rolle des angemeldeten Nutzers für die Rollen-Guards.
 *
 * Gespeichert in localStorage (je `sub`), damit die Rolle auch ohne Netz
 * nach einem Kaltstart bekannt ist. Die Rolle steuert nur die Oberfläche;
 * das Backend prüft jede Anfrage selbst. Mit gültiger Sitzung wird sie
 * einmal je Seitenaufruf im Hintergrund aufgefrischt.
 */

import { api } from "@/api/client";
import { isAuthenticated, RENEW_TIMEOUT_SECONDS } from "@/auth/session";

interface MeResponse {
  oidc_sub: string;
  display_name: string;
  role: string;
}

interface StoredRole {
  sub: string;
  role: string;
}

const ROLE_KEY = "my-cookbook-role";

let refreshed = false;

export function readStoredRole(sub: string | null): string | null {
  if (!sub) return null;
  try {
    const stored = JSON.parse(
      localStorage.getItem(ROLE_KEY) ?? "null",
    ) as StoredRole | null;
    return stored?.sub === sub ? stored.role : null;
  } catch {
    return null;
  }
}

/** Beim Logout: gespeicherte Rolle verwerfen. */
export function clearStoredRole(): void {
  refreshed = false;
  try {
    localStorage.removeItem(ROLE_KEY);
  } catch {
    // Storage gesperrt: nichts zu tun
  }
}

/**
 * Rolle vom Backend (`/me`), höchstens so lange wie eine Token-Erneuerung.
 * Speichert sie; `null` bei Fehler oder Timeout.
 */
export async function fetchRole(): Promise<string | null> {
  try {
    const me = await api.get<MeResponse>("/me", {
      timeoutMs: RENEW_TIMEOUT_SECONDS * 1000,
    });
    refreshed = true;
    try {
      localStorage.setItem(
        ROLE_KEY,
        JSON.stringify({ sub: me.oidc_sub, role: me.role }),
      );
    } catch {
      // quota/gesperrt: Rolle gilt nur für diesen Aufruf
    }
    return me.role;
  } catch {
    return null;
  }
}

let refreshing = false;

/**
 * Gespeicherte Rolle einmal je Seitenaufruf im Hintergrund auffrischen,
 * nur mit gültiger Sitzung (sonst beim nächsten Rollen-Guard erneut).
 */
export function refreshRoleOnce(): void {
  if (refreshed || refreshing) return;
  refreshing = true;
  void isAuthenticated()
    .then((ok) => (ok ? fetchRole() : null))
    .finally(() => {
      refreshing = false;
    });
}
