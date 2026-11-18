/**
 * Antwort von `/me/settings`. Die Oberfläche nutzt nur die Rolle; `read_only`
 * und `expert_mode` liefert das Backend nur noch für alte PWA-Stände.
 */
export interface Settings {
  role: string;
}
