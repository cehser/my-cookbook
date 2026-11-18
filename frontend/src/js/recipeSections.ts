import type { Section } from "@/types/recipe";

/**
 * Abschnitte, die mindestens einen Eintrag (Zutat oder Schritt) haben.
 * Einträge, deren Abschnitt nicht in `sections` steht („verwaist“),
 * erscheinen als eigene Abschnitte vorneweg.
 *
 * Immer mit der vollständigen Abschnittsliste aufrufen und erst danach
 * filtern, sonst gelten Einträge anderer Abschnitte als verwaist (R-01).
 */
export function effectiveSections(
  sections: Section[],
  items: { section?: string }[],
): Section[] {
  const known = new Set(sections.map((s) => s.section));
  const result: Section[] = [];

  const orphanNames = new Set(
    items.map((i) => i.section ?? "").filter((name) => !known.has(name)),
  );
  for (const name of orphanNames) result.push({ section: name });

  for (const section of sections) {
    if (items.some((i) => (i.section ?? "") === section.section)) {
      result.push(section);
    }
  }
  return result;
}

/**
 * Abschnitt für den Filter „Nur aktuell“: der aktive, falls er Einträge hat,
 * sonst – solange noch kein Abschnitt aktiv ist – der erste.
 * Ein aktiver Abschnitt ohne Einträge ergibt eine leere Liste.
 */
export function currentSectionOnly(
  effective: Section[],
  active: string | null,
): Section[] {
  if (active === null) return effective.slice(0, 1);
  return effective.filter((s) => s.section === active);
}
