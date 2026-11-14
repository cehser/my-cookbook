# Ideensammlung – Weiterentwicklung

> Stand 2026-11-14: Idee 1 steht als S.1, Idee 2 als S.2 in der [Roadmap](../ROADMAP.md).

## 1. Rezept-Tracking: Beliebt & Zuletzt geöffnet

> **Teilweise umgesetzt:** „Zuletzt geöffnet“ gibt es clientseitig (localStorage, `useRecentRecipes`, Sektion in HomeView), also je Gerät statt je User. Offen: serverseitige Erfassung und „Beliebt“.

**Idee:** Das System erfasst, wann ein User ein Rezept öffnet. Daraus ergeben sich zwei Features:

- **Zuletzt geöffnet (pro User):** Zeigt dem angemeldeten User seine zuletzt angesehenen Rezepte (z.B. die letzten 10).
- **Beliebt (alle User):** Aggregiert die Aufrufe aller User und zeigt die meistgesehenen Rezepte.

### Backend

- Neue Tabelle `recipe_views` (user_id, recipe_id, viewed_at)
- Eintrag bei jedem Rezept-Aufruf (GET /recipes/{id})
- Endpoints:
  - `GET /me/recent-recipes` → zuletzt geöffnete Rezepte des aktuellen Users
  - `GET /recipes/popular` → meistgeöffnete Rezepte (Zeitraum konfigurierbar?)

### Frontend

- Anzeige auf dem Dashboard (siehe Idee 2)
- Karussell oder kompakte Kachelansicht

---

## 2. Dashboard statt Galerie

> **Teilweise umgesetzt (UX-2, 04/2026):** HomeView ersetzt die Galerie und enthält „Zuletzt geöffnet“, „Entwürfe“ und „Alle Rezepte“; Favoriten haben einen eigenen Tab. Offen: „Beliebt“, „Zuletzt hinzugefügt“, saisonale Vorschläge.

**Idee:** Die aktuelle Galerie-Ansicht wird durch ein Dashboard ersetzt (oder ergänzt), das verschiedene Sektionen bietet:

- **Zuletzt geöffnet** – persönliche History (→ Idee 1)
- **Beliebt** – meistgeöffnete Rezepte aller User (→ Idee 1)
- **Zuletzt hinzugefügt** – neueste Rezepte
- **Favoriten** – Schnellzugriff auf markierte Rezepte
- **Saisonale Vorschläge?** – optional, je nach Aufwand

### Offene Fragen

- Galerie komplett ersetzen oder als Tab/Ansicht behalten?
- Dashboard als neue Startseite?
- Welche Sektionen sind MVP, welche optional?
