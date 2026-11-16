/** Datumsformate der Oberfläche (de-DE), „—“ ohne Wert. */

const DATE: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
};

const DATE_TIME: Intl.DateTimeFormatOptions = {
  ...DATE,
  hour: "2-digit",
  minute: "2-digit",
};

/** Nur Datum, z. B. „15.11.2026“. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", DATE);
}

/** Datum mit Uhrzeit, z. B. „15.11.2026, 23:05“. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", DATE_TIME);
}
