/**
 * Gemeinsamer Neuladen-Schutz: Chunk-Fehler-Handler (Router) und Service-Worker-
 * Update (swUpdate) können für denselben Fehler beide feuern. Nur der erste lädt.
 */

let reloading = false;

/** Lädt die Seite genau einmal neu, optional auf eine Ziel-URL (Pfad mit Query/Hash). */
export function reloadOnce(target?: string): void {
  if (reloading) return;
  reloading = true;
  if (target) window.location.assign(target);
  else window.location.reload();
}

/** True, sobald ein Neuladen angestoßen wurde. */
export function isReloading(): boolean {
  return reloading;
}
