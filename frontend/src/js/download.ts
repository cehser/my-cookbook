/**
 * Wartezeit bis zur Freigabe der Blob-URL. Der Browser liest den Blob nach
 * `click()` asynchron; ein sofortiges `revokeObjectURL` kann den Download
 * großer Dateien (besonders in Safari/WebKit) leer ausgehen lassen.
 */
export const REVOKE_DELAY_MS = 60_000;

/** Bietet einen Blob als Datei zum Speichern an (unsichtbarer Download-Link). */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
