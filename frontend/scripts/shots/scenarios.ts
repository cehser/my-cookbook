/**
 * Szenarien des Screenshot-Harness. Neue Szenarien hier eintragen; Aufruf
 * per `npm run shots -- <name|all> [ausgabeordner]`.
 *
 * Die drei Beispiele stellen die Bilder aus W.38 nach
 * (`docs/plans/w38-datenverlust/`).
 */

import type { Recipe } from "../../src/types/recipe.ts";
import type { Scenario } from "./types.ts";

const LOCAL_ID = "5d2c8f1e-7a43-4b0e-9c61-2f7e3a9b1c04";
const SERVER_ID = "8b1e4c7a-2d39-4f56-a0e8-6c3b9d2f7e15";

const marmorkuchen: Recipe = {
  recipe_uuid: LOCAL_ID,
  recipe_name: "Marmorkuchen",
  subtitle: "offline angelegt",
  tags: ["Kuchen"],
  yields: [{ unit: "Stück", value: 12 }],
  ingredients: [
    { name: "Mehl", amounts: [{ amount: 300, unit: "g" }], section: "" },
    { name: "Zucker", amounts: [{ amount: 200, unit: "g" }], section: "" },
    { name: "Eier", amounts: [{ amount: 4, unit: "" }], section: "" },
    { name: "Kakao", amounts: [{ amount: 2, unit: "EL" }], section: "" },
  ],
  steps: [
    { step: "Alles verrühren.", section: "" },
    { step: "30 Minuten bei 180 °C backen.", section: "" },
  ],
  sections: [{ section: "" }],
  lastUpdated: "2026-11-18T10:00:00Z",
};

const apfelkuchen = {
  id: SERVER_ID,
  recipe_name: "Apfelkuchen",
  tags: ["Kuchen"],
  data: {
    subtitle: "vom Server",
    ingredients: [
      { name: "Äpfel", amounts: [{ amount: 1, unit: "kg" }], section: "" },
    ],
    steps: [{ step: "Äpfel schälen.", section: "" }],
  },
};

const user = {
  sub: "c0ffee00-0000-4000-8000-000000000001",
  name: "Test",
  role: "editor",
};

export const scenarios: Scenario[] = [
  {
    name: "rezept-nur-auf-geraet",
    description:
      "Vorgemerktes Rezept, Übertragung scheitert (POST 503): Kennzeichnung „Nur auf diesem Gerät“",
    route: `/recipe/${LOCAL_ID}`,
    seed: { user, pending: [{ recipe: marmorkuchen }] },
    responses: { "POST /recipes": { status: 503 } },
    waitForText: "Nur auf diesem Gerät",
  },
  {
    name: "rezept-abgelehnt",
    description:
      "Vorgemerktes Rezept, vom Server abgelehnt (403): Kennzeichnung „Vom Server abgelehnt“",
    route: `/recipe/${LOCAL_ID}`,
    seed: { user, pending: [{ recipe: marmorkuchen, rejected: 403 }] },
    responses: { "POST /recipes": { status: 403 } },
    waitForText: "Vom Server abgelehnt",
  },
  {
    name: "edit-nicht-ladbar",
    description:
      "Editor eines Server-Rezepts, Detail-GET 503 ohne Cache: Meldung, Speichern ausgegraut",
    route: `/edit/${SERVER_ID}`,
    seed: { user, serverRecipes: [apfelkuchen] },
    responses: { "GET /recipes/:id": { status: 503 } },
    waitForText: "Rezept konnte nicht geladen werden",
  },
  {
    name: "rezept-menue-readonly",
    description:
      "Rezeptansicht als readonly (U.15): ⋮-Menü mit „Bildschirm anlassen“, ohne Bearbeiten",
    route: `/recipe/${SERVER_ID}`,
    seed: {
      user: { ...user, role: "readonly" },
      serverRecipes: [apfelkuchen],
    },
    waitForText: "Äpfel schälen.",
    clicks: ["button[title='Menü']"],
  },
  {
    name: "rezept-menue-editor",
    description:
      "Rezeptansicht als editor (U.15): ⋮-Menü mit Bearbeiten-Einträgen und „Als Datei exportieren“",
    route: `/recipe/${SERVER_ID}`,
    seed: { user, serverRecipes: [apfelkuchen] },
    waitForText: "Äpfel schälen.",
    clicks: ["button[title='Menü']"],
  },
];
