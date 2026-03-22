# Gesamtempfehlung: Health System Deployment

## Die einfachste Architektur

```
Raspberry Pi (zuhause, 24/7, 3 Watt)
├── Docker Container → Health System
├── SQLite DB → alle Daten
└── Tailscale → Zugang von überall

Deine Geräte:
├── 📱 Handy → PWA (Chrome "Zum Startbildschirm")
├── 💻 Laptop → Browser
└── 🖥️ Desktop → Browser
```

Alle Geräte zeigen die gleiche App, gleiche Daten, ein Server.

## Warum diese Empfehlung

| Frage | Antwort |
|-------|---------|
| Warum Pi statt Cloud? | 0 CHF/Monat, perfekter SQLite-Support, volle Kontrolle, deine Daten bleiben bei dir |
| Warum PWA statt Native App? | Null Extra-Aufwand, funktioniert sofort, kein App Store |
| Warum Tailscale statt Cloudflare? | 5 Minuten Setup, kein DNS nötig, verschlüsselt |
| Was wenn der Pi ausfällt? | Tägliches SQLite-Backup (Cron), neuer Pi in 10 min aufgesetzt |
| Was wenn ich mehr will? | VPS (4 €/mo) mit HTTPS + eigener Domain, jederzeit migrierbar |

## Reihenfolge der Umsetzung

### Phase 1: Lokal testen (jetzt, 5 min)
```bash
npm run build && npm start
# Öffne http://localhost:3001
```

### Phase 2: PWA einbauen (10 min)
- Manifest.json + Service Worker hinzufügen
- App auf dem Handy als PWA installieren

### Phase 3: Pi aufsetzen (30 min)
- Docker auf Pi installieren
- Projekt kopieren, `docker compose up -d`
- IP notieren, von allen Geräten testen

### Phase 4: Unterwegs-Zugang (5 min)
- Tailscale auf Pi + Handy + Laptop installieren
- Fertig, funktioniert überall

### Phase 5 (optional): Eigene Domain
- VPS mieten ODER Cloudflare Tunnel auf dem Pi
- HTTPS + echte URL

## Kosten-Übersicht

| Setup | Einmalig | Monatlich |
|-------|----------|-----------|
| Pi + lokal | ~50 CHF (Pi) | ~0.70 CHF (Strom) |
| Pi + Tailscale | ~50 CHF | ~0.70 CHF |
| Pi + Cloudflare Tunnel | ~50 CHF + Domain (~10 CHF/Jahr) | ~0.70 CHF |
| VPS (Hetzner) | 0 | ~4 EUR |
| Cloud Run | 0 | 0-15 EUR |

## Mein Rat

Starte mit dem Pi. Du hast ihn schon. Docker drauf, App starten, Tailscale installieren. Das ist in 30 Minuten erledigt und du hast ein System das läuft, das dir gehört, und das nichts kostet. Wenn du später merkst dass du eine öffentliche URL oder mehr Uptime brauchst, migrierst du auf einen VPS — das ist eine Stunde Arbeit.
