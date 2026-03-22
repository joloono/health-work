# PRD: Health System

## 1. Executive Summary

Health System ist eine persönliche Web-Applikation für einen Solopreneur, der zu viel Zeit ununterbrochen vor dem PC verbringt. Die App strukturiert den Arbeitstag in 4 Blöcke à 4 Pomodoros mit erzwungenen Bewegungspausen zwischen jedem Pomodoro (min. 1 Minute) und grösseren Pausen zwischen Blöcken. Vor jedem Pomodoro wird eine Fokus-Intention gesetzt. Ein Gamification-System mit 30+ griechisch-antiken Rängen belohnt Konsistenz und Qualität. Bewegung zählt doppelt; Arbeit an umsatzrelevanten Projekten gibt Bonuspunkte. Backend: SQLite3. Deployment: Docker. Zugang: Basic Auth.

---

## 2. Product Vision

**Purpose**: Den Teufelskreis „endlose PC-Sessions ohne Bewegung" durchbrechen — nicht durch Willenskraft, sondern durch ein System mit eingebautem Rhythmus, sozialer Gamification-Dynamik (gegen sich selbst) und Datenrückkopplung.

**Direction**: Phase 1 liefert eine vollständige Web-App mit Tracking, Gamification und Trendanalyse. Phase 2 erweitert um eine REST-API mit Webhooks und eine Telegram-Bot-Integration, die das System agentisch steuerbar macht (Intention setzen, Timer starten, Status abfragen — alles per Chat).

**Positioning**: Kein generischer Pomodoro-Timer. Ein integriertes Health-Productivity-System, das Bewegung als Arbeitsvoraussetzung behandelt, nicht als Belohnung.

---

## 3. Target Users

### Primary Persona: Jo (Solopreneur)

| Attribute | Description |
|-----------|-------------|
| Role | Gründer, AI-Berater, arbeitet allein am PC |
| Goals | Gesunder Arbeitsrhythmus, mehr Bewegung, Fokus auf umsatzrelevante Arbeit |
| Pain Points | Endlose KI-Sessions ohne Unterbrechung, keine Struktur, zu wenig Bewegung, kein Überblick wo die Zeit hinfliesst |
| Tech Savvy | Hoch — kann Docker deployen, APIs nutzen, selbst entwickeln |

### Secondary Personas

Keine im MVP. Single-User-System.

---

## 4. Problem Statement

**Current State**: Der Arbeitstag hat keinen natürlichen Rhythmus. KI-Interaktionen haben keinen Endpunkt — man hört auf, wenn man erschöpft ist, nicht wenn ein System einen rausholt. Bewegung wird als „Extra" behandelt und fällt regelmässig aus. Es gibt kein Feedback darüber, ob die investierte Zeit auf Geschäftswert einzahlt oder nur auf Beschäftigung.

**Pain Points**:

1. Keine erzwungenen Bewegungspausen — der Körper verkümmert
2. Kein Fokus-System — man arbeitet reaktiv statt intentional
3. Kein Überblick — wo fliessen die Stunden hin? Was davon bringt Geld?
4. Keine Konsequenz bei Inaktivität — kein System hält einen accountable

**Impact**: Gesundheitliche Folgen (Rücken, Augen, Kreislauf), verringerte Produktivität durch fehlende Pausen, verpasste Revenue-Chancen durch Beschäftigung statt Wertschöpfung.

---

## 5. Solution Overview

**Approach**: Eine Web-App, die den Arbeitstag in einen festen Rhythmus zwingt:

Fokus-Intention → 25 min Pomodoro → 1+ min Bewegung → nächste Intention → … → Block fertig → 10–15 min grosse Pause → nächster Block.

4 Blöcke pro Tag, 16 Pomodoros maximal. Alles wird in SQLite3 geloggt: Intentionen, Pomodoro-Completions, Bewegungstypen, Geschäftswert-Flag. Ein Gamification-Layer mit griechisch-antiken Rängen belohnt Konsistenz (Streak) und Qualität (Punkte). Wochenüberblick und Tageslog geben Rückkopplung.

**Key Differentiators**:

- Bewegung ist nicht optional — sie ist die Erlaubnis, den nächsten Pomodoro zu starten
- Geschäftswert-Flag verbindet Health-Tracking mit Revenue-Awareness
- Gamification mit Level-Verlust: „Missing twice is the start of a new habit"
- Agenten-ready Architektur (Phase 2) für Steuerung per Telegram

---

## 6. Success Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Tage mit ≥1 Pomodoro + Bewegung pro Woche | 0 | ≥5 | Woche 2 nach Launch |
| Durchschnittliche Pomodoros/Tag | unbekannt | ≥8 | Woche 4 |
| Längster Streak (Tage) | 0 | ≥14 | Monat 2 |
| Anteil Geschäftswert-Pomodoros | unbekannt | ≥40% | Monat 1 |
| Erreichter Rang | — | Rang 10+ | Monat 1 |

**Leading Indicators**: Tägliche Nutzung, Streak-Länge, Bewegungsminuten/Tag

**Lagging Indicators**: Rang-Entwicklung über Wochen, Geschäftswert-Anteil-Trend

---

## 7. Feature Requirements

### Must Have (P0) — MVP

| Feature | Description | User Benefit | Acceptance Criteria |
|---------|-------------|--------------|---------------------|
| **Pomodoro-Timer** | 25-min Countdown, startet automatisch nach Intention-Eingabe | Strukturierter Fokus | Timer zählt korrekt runter, Completion wird in DB geloggt |
| **Fokus-Intention** | Freitext-Eingabe vor jedem Pomodoro, wird gespeichert | Intentionales Arbeiten statt Reaktivität | Kein Timer-Start ohne Intention, Intention in DB gespeichert |
| **Geschäftswert-Flag** | Toggle pro Pomodoro: „Zahlt direkt auf Umsatz ein" | Revenue-Awareness | Flag wird pro Pomodoro in DB gespeichert, in Statistiken sichtbar |
| **Mini-Bewegung** | Nach jedem der ersten 3 Pomodoros im Block: 60s Countdown + Übungswahl | Erzwungene Bewegung alle 25 min | Timer muss ablaufen bevor Übungswahl erscheint, Wahl in DB geloggt |
| **Block-Pause** | Nach dem 4. Pomodoro: Auswahl einer grösseren Pause (Spaziergang, Workout etc.) | Grössere Erholungsphasen | Wahl in DB geloggt, Block erst nach Auswahl als „fertig" markiert |
| **Tagesstruktur** | 4 Blöcke à 4 Pomodoros, sequenziell | Klare Tagesstruktur mit harter Obergrenze | Max 16 Pomodoros/Tag, kein 5. Block möglich |
| **Tageslog** | Übersicht aller Intentionen, Pomodoros, Bewegungen des Tages | Rückblick: Was hab ich heute gemacht? | Zeigt alle Daten des aktuellen Tages, chronologisch |
| **Wochenüberblick** | Charts: Pomodoros/Tag, Bewegungsminuten/Tag, Geschäftswert-Anteil, Streak | Trend erkennen, Motivation | Line-Charts für 7 Tage, aktuelle Woche + Vorwoche vergleichbar |
| **Gamification: Punkte** | Punkte pro Pomodoro (1 Pt), Bewegung (2 Pt), Geschäftswert-Bonus (+1 Pt) | Motivation durch sichtbaren Fortschritt | Punkteberechnung korrekt, Tagespunkte in DB |
| **Gamification: Ränge** | 30+ griechisch-antike Ränge mit Zwischen-Rängen, Level-Up alle 3 konsistente Tage (gewichtet nach Qualität) | Langfrist-Motivation, Identifikation mit dem System | Rang wird korrekt berechnet und prominent angezeigt |
| **Gamification: Streak & Level-Verlust** | Streak-Erhalt: min. 1 Pomodoro + 1 Bewegung/Tag. Nach 1 Tag Pause: Warnung. Nach 2 Tagen: Level-Verlust | Accountability — „missing twice is a new habit" | Warnung wird angezeigt, Level sinkt nach 2 Tagen Inaktivität |
| **SQLite3 Backend** | Alle Daten persistent in SQLite3 | Daten überleben Neustarts | Schema migriert sauber, alle Writes transaktional |
| **Basic Auth** | Einfacher Passwortschutz | Zugang nur für den Nutzer | 401 ohne korrektes Passwort, Session bleibt aktiv |
| **Docker Deployment** | Dockerfile + docker-compose.yml | Ein-Kommando-Deployment | `docker compose up` startet die App vollständig |
| **Responsive Design** | Funktioniert auf Desktop und Mobile (Browser) | Nutzung auch unterwegs | Alle Features auf 375px Breite bedienbar |

### Should Have (P1)

| Feature | Description | User Benefit | Acceptance Criteria |
|---------|-------------|--------------|---------------------|
| **Streak-Kalender** | Heatmap-Darstellung der aktiven Tage (à la GitHub Contributions) | Visuelle Motivation | Farbe zeigt Intensität, leere Tage sichtbar |
| **Export** | Tages- und Wochendaten als CSV exportierbar | Weiterverarbeitung, Backup | Download-Button, valides CSV |
| **Benachrichtigungs-Sound** | Audio-Signal wenn Timer abläuft | Man muss nicht auf den Screen schauen | Sound spielt bei Timer-Ende, an/aus schaltbar |
| **Dunkelmodus** | Dark Theme | Augenfreundlich bei langer Nutzung | Toggle, Preference gespeichert |

### Nice to Have (P2) — Post-MVP

| Feature | Description | User Benefit | Acceptance Criteria |
|---------|-------------|--------------|---------------------|
| **REST-API** | Alle CRUD-Operationen über HTTP-Endpunkte, Basic Auth | Grundlage für Agent-Integration | OpenAPI-Spec, alle Endpunkte getestet |
| **Webhooks** | Push-Events bei Timer-Ende, Streak-Gefährdung | Agent kann reagieren statt pollen | Webhook-URL konfigurierbar, Events werden zuverlässig gesendet |
| **Telegram-Bot** | Intention setzen, Timer starten, Status abfragen per Chat | Steuerung ohne Browser öffnen | Bot reagiert auf Befehle, schreibt in DB |
| **Intentionen-Analyse** | Gruppierung/Tagging von Intentionen, Zeitverteilung pro Projekt | Muster erkennen: wo fliesst die Zeit hin? | Intentionen nach Projekt filterbar |

---

## 8. Non-functional Requirements

### Performance

- Timer-Latenz < 100ms (kein visuelles Stottern)
- Seitenlade-Zeit < 2s auf 3G-Mobilnetz
- SQLite-Queries < 50ms für alle Dashboard-Views

### Security

- Basic Auth über HTTPS (TLS-Terminierung via Reverse Proxy)
- SQLite-Datei nicht öffentlich zugänglich
- Kein User Management im MVP — Single-User, ein Passwort

### Reliability

- SQLite WAL-Mode für Crash-Resistenz
- Docker Volume für DB-Persistenz (kein Datenverlust bei Container-Restart)
- Tägliches Backup der SQLite-Datei (Cron im Container oder Host)

### Usability

- Mobile-first Design, funktionsfähig ab 375px
- Grosse Touch-Targets (min. 44px) für Timer-Bedienung am Handy
- Deutsche UI-Sprache, Schweizer Rechtschreibung (ss statt ß)

---

## 9. Constraints & Dependencies

### Technical Constraints

- Single-User SQLite3 — keine Concurrent-Write-Probleme, aber auch kein Multi-User
- Basic Auth ist kein echtes Auth-System — reicht für Solo-Use, nicht skalierbar
- Docker-Deployment setzt VPS oder lokale Docker-Installation voraus

### Business Constraints

- Solo-Entwicklung (Jo selbst + Claude als Co-Developer)
- Kein Budget für externe Dienste — alles Self-Hosted
- Zeitbudget: neben laufendem Consulting-Geschäft

### Dependencies

| Dependency | Owner | Status | Risk Level |
|------------|-------|--------|------------|
| VPS / Docker Host | Jo | vorhanden | Low |
| Domain + TLS | Jo | vorhanden | Low |
| SQLite3 | Open Source | stabil | Low |
| Telegram Bot API (Phase 2) | Telegram | stabil | Low |

---

## 10. Release Plan

### Phase 1: MVP — „Néos bis Strategos"

**Scope**: Vollständige Web-App mit Pomodoro-Rhythmus, Bewegungspausen, Fokus-Intentionen, Geschäftswert-Flag, Tageslog, Wochenüberblick, Gamification (Punkte, 30+ Ränge, Streak, Level-Verlust), SQLite3, Basic Auth, Docker, Responsive Design.

**Milestones**:

| Milestone | Deliverable |
|-----------|-------------|
| M1: Backend-Grundgerüst | SQLite3 Schema, API-Routen, Basic Auth, Docker Setup |
| M2: Core Timer Flow | Intention → Timer → Bewegung → Block-Pause, alles persistiert |
| M3: Gamification | Punkte-Engine, Rang-System, Streak-Logik, Level-Verlust |
| M4: Dashboard | Tageslog, Wochenüberblick mit Charts |
| M5: Polish & Deploy | Responsive, Dark Mode Toggle, Sound, Docker Compose, Go Live |

### Phase 2: Agent-Schicht — „Der Herold"

**Scope**: REST-API (OpenAPI), Webhooks, Telegram-Bot-Integration.

| Milestone | Deliverable |
|-----------|-------------|
| M6: REST-API | CRUD für Pomodoros, Intentionen, Status — Basic Auth |
| M7: Webhooks | Push-Events (Timer fertig, Streak-Warnung) an konfigurierbare URL |
| M8: Telegram-Bot | Befehle: /intention, /start, /status, /stats — schreibt über API in DB |

---

## 11. Open Questions

| Question | Owner | Impact |
|----------|-------|--------|
| Tech-Stack Frontend: Vanilla JS, React, oder Svelte? | Jo | Beeinflusst Entwicklungsgeschwindigkeit und Wartbarkeit |
| Tech-Stack Backend: Python (FastAPI/Flask), Node (Express), Go? | Jo | Beeinflusst Docker-Image-Grösse und Vertrautheit |
| Exakte Punkte-Formel für Level-Aufstieg: lineare Schwelle oder progressiv steigend? | Jo | Beeinflusst Balancing der Gamification |
| Sollen Level-Bezeichnungen im Code hardcoded sein oder in einer Config-Datei? | Jo | Beeinflusst Wartbarkeit |
| Backup-Strategie: SQLite-Datei per Cron kopieren oder Litestream für Streaming-Backup? | Jo | Beeinflusst Betriebssicherheit |

---

## 12. Appendices

### A. Rang-System (30 Ränge, griechisch-antik mit Zwischen-Rängen)

| Rang | Level | Bezeichnung |
|------|-------|-------------|
| 1 | 1 | Néos (Neuling) |
| 2 | 2 | Néos Dókimos (Bewährter Neuling) |
| 3 | 3 | Mathitís (Schüler) |
| 4 | 4 | Mathitís Prótos (Erster Schüler) |
| 5 | 5 | Ephébos (Kadett) |
| 6 | 6 | Ephébos Dókimos (Bewährter Kadett) |
| 7 | 7 | Hoplítis (Hoplit) |
| 8 | 8 | Hoplítis Prótos (Erster Hoplit) |
| 9 | 9 | Pentekóntarchos (Führer von 50) |
| 10 | 10 | Hekatóntarchos (Zenturio) |
| 11 | 11 | Hekatóntarchos Prótos (Erster Zenturio) |
| 12 | 12 | Lochagós (Kompanie-Führer) |
| 13 | 13 | Lochagós Mégas (Grosser Kompanie-Führer) |
| 14 | 14 | Taxíarchos (Bataillonsführer) |
| 15 | 15 | Taxíarchos Prótos (Erster Bataillonsführer) |
| 16 | 16 | Chiliarchos (Führer von Tausend) |
| 17 | 17 | Chiliarchos Mégas (Grosser Chiliarch) |
| 18 | 18 | Polemarchos (Kriegsherr) |
| 19 | 19 | Polemarchos Prótos (Erster Kriegsherr) |
| 20 | 20 | Strategos (General) |
| 21 | 21 | Strategos Dókimos (Bewährter General) |
| 22 | 22 | Strategos Mégas (Grosser General) |
| 23 | 23 | Strategos Autokrátor (Oberbefehlshaber) |
| 24 | 24 | Archon (Herrscher) |
| 25 | 25 | Archon Prótos (Erster Herrscher) |
| 26 | 26 | Archon Epónymos (Namensgebender Archon) |
| 27 | 27 | Archon Polemarchos (Kriegs-Archon) |
| 28 | 28 | Archon Mégas (Gross-Archon) |
| 29 | 29 | Archon Basileús (König der Archonten) |
| 30 | 30 | Olympionikes (Olympiasieger) |

### B. Punkte-Logik (Entwurf)

- 1 Pomodoro abgeschlossen: **1 Punkt**
- 1 Bewegungseinheit (Mini oder Block): **2 Punkte**
- Geschäftswert-Flag aktiv: **+1 Punkt** pro Pomodoro
- Maximale Tagespunkte: 16 (Pomodoros) + 32 (16× Bewegung: 12 Mini + 4 Block) + 16 (wenn alle Geschäftswert) = **64 Punkte**
- Minimum für Streak-Erhalt: 1 Pomodoro + 1 Bewegung = **3 Punkte**

**Level-Aufstieg**: Alle 3 konsistente Tage (Streak ≥ 3), sofern Durchschnitt ≥ 20 Punkte/Tag in diesen 3 Tagen. Progressiv steigende Schwelle für höhere Ränge (offene Frage: exakte Formel).

**Level-Verlust**: 1 Tag Inaktivität → Warnung anzeigen. 2 Tage Inaktivität → 1 Rang Verlust. Minimum: Rang 1 (Néos).

### C. Tagesrhythmus-Schema

```
Block I:   [Intention → Pomodoro → Move] × 3 → [Intention → Pomodoro] → Grosse Pause
Block II:  [Intention → Pomodoro → Move] × 3 → [Intention → Pomodoro] → Grosse Pause
Block III: [Intention → Pomodoro → Move] × 3 → [Intention → Pomodoro] → Grosse Pause
Block IV:  [Intention → Pomodoro → Move] × 3 → [Intention → Pomodoro] → Grosse Pause → FEIERABEND
```

### D. Datenmodell (SQLite3, Entwurf)

**Tabelle: days**

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | INTEGER PK | Auto-Increment |
| date | TEXT UNIQUE | ISO-Datum (2026-03-21) |
| total_points | INTEGER | Tagespunkte |
| streak_day | INTEGER | Wievielte Tag im aktuellen Streak |
| rank_level | INTEGER | Rang am Ende des Tages |

**Tabelle: pomodoros**

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | INTEGER PK | Auto-Increment |
| day_id | INTEGER FK | Referenz auf days |
| block_index | INTEGER | 0–3 |
| pom_index | INTEGER | 0–3 |
| intention | TEXT | Fokus-Intention |
| business_value | BOOLEAN | Geschäftswert-Flag |
| started_at | TEXT | ISO Timestamp |
| completed_at | TEXT | ISO Timestamp |

**Tabelle: movements**

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | INTEGER PK | Auto-Increment |
| day_id | INTEGER FK | Referenz auf days |
| block_index | INTEGER | 0–3 |
| type | TEXT | mini / block |
| exercise | TEXT | pushups, walk, etc. |
| duration_seconds | INTEGER | Tatsächliche Dauer |
| completed_at | TEXT | ISO Timestamp |

**Tabelle: gamification**

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | INTEGER PK | Auto-Increment |
| date | TEXT UNIQUE | ISO-Datum |
| cumulative_points | INTEGER | Gesamtpunkte seit Start |
| current_rank | INTEGER | Aktueller Rang (1–30) |
| streak_length | INTEGER | Aktuelle Streak-Länge |
| level_change | TEXT | up / down / none |

### E. Glossary

| Term | Definition |
|------|------------|
| Pomodoro | 25-Minuten-Fokuseinheit |
| Mini-Move | 1+ Minuten Bewegung zwischen Pomodoros innerhalb eines Blocks |
| Block-Pause | 10–15 Minuten Bewegung/Erholung nach 4 Pomodoros |
| Geschäftswert-Flag | Markierung: diese Arbeit zahlt direkt auf Umsatz ein |
| Streak | Ununterbrochene Kette von Tagen mit mindestens 1 Pomodoro + 1 Bewegung |
| Rang | Gamification-Level mit griechisch-antiker Bezeichnung |

---

*Document Version: 1.0*
*Last Updated: 2026-03-21*
*Author: Jo (Waldsee Consulting)*
