/**
 * OIDC-Hilfen um die Sitzung: Logout und Ereignis bei neuem Token.
 *
 * `UserManager`-Instanz: `auth/userManager.ts`. Erneuerung, Login-Redirect,
 * Login-Callback und die Entscheidung, wann zum Login geleitet wird:
 * `auth/session.ts`. Importrichtung nur `oidc → session → userManager`.
 */

import { userManager } from "@/auth/userManager";
import { currentRenewal, setLogoutInProgress } from "@/auth/session";
import { clearStoredRole } from "@/auth/role";

/**
 * @deprecated Kompatibilität: `api/images.ts` importiert noch von hier
 * (Umstellung auf `@/auth/session` nach dem Merge von W.28).
 */
export { getAccessToken } from "@/auth/session";

/**
 * Callback bei neuem Token (Login-Callback oder Erneuerung).
 * Liefert eine Funktion zum Abmelden.
 */
export function onUserLoaded(cb: () => void): () => void {
  return userManager.events.addUserLoaded(() => cb());
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
  setLogoutInProgress(true);
  clearStoredRole();
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
    setLogoutInProgress(false);
    throw e;
  }
}
