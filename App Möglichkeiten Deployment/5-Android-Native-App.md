# Android Native App (Capacitor / TWA)

## Brauche ich eine native App?

Kurze Antwort: **Nein.** Die PWA reicht für deinen Use Case. Aber falls du trotzdem eine "echte" Android-App im Play Store willst, gibt es zwei Wege.

---

## Option A: Capacitor Wrapper (empfohlen wenn native)

Capacitor (von Ionic) nimmt deine bestehende Web-App und packt sie in eine native Android-Hülle. Kein Code-Umbau nötig.

### Voraussetzungen
- Node.js
- Android Studio (für den Build)
- Java JDK 17+

### Schritte

```bash
cd health-system
npm install @capacitor/core @capacitor/cli
npx cap init "Health System" ch.waldsee.health --web-dir=dist

# Android-Projekt generieren
npm install @capacitor/android
npx cap add android

# Web-App bauen
npm run build

# In Android-Projekt kopieren
npx cap sync

# In Android Studio öffnen
npx cap open android
# → Build → Run auf Handy oder Emulator
```

### Sync mit Backend

Die App öffnet einfach dein Backend als WebView. Wenn der Server läuft (Pi, VPS), funktioniert alles. Die URL konfigurierst du in `capacitor.config.ts`:

```ts
const config = {
  appId: 'ch.waldsee.health',
  appName: 'Health System',
  server: {
    url: 'https://health.deine-domain.ch', // dein Server
    cleartext: true
  }
};
```

### Offline-Fähigkeit

Ohne Server: App zeigt Fehlermeldung. Mit Service Worker (PWA): Grundfunktionen cached, Timer läuft, Daten werden bei Reconnect synchronisiert.

---

## Option B: TWA (Trusted Web Activity)

Noch einfacher: Google erlaubt, eine PWA als "echte" Android-App im Play Store zu veröffentlichen — ohne Capacitor, ohne WebView. Die App IST der Chrome-Browser, nur unsichtbar.

### Voraussetzung
- PWA mit Manifest + Service Worker
- HTTPS-URL
- Google Play Developer Account (25 $ einmalig)

### Tool: Bubblewrap

```bash
npm install -g @nicedoc/nicedoc
npx @nicedoc/nicedoc
# Oder:
npm install -g @nicedoc/nicedoc
npx @nicedoc/nicedoc
```

Oder einfacher: [PWABuilder.com](https://pwabuilder.com) — URL eingeben, APK herunterladen.

---

## Option C: Lokale SQLite + Server-Sync (Hybrid)

Wenn du wirklich Offline-Daten auf dem Handy willst die sich mit dem Server synchronisieren:

1. Lokale SQLite auf dem Handy (via Capacitor + `@capacitor-community/sqlite`)
2. Sync-Logik: Bei Netzwerkverbindung → lokale Änderungen zum Server pushen, Server-Änderungen pullen
3. Conflict Resolution: "Last Write Wins" für ein Single-User-System

**Aufwand**: 2-3 Tage Entwicklung. Lohnt sich nur wenn du regelmässig offline arbeitest.

---

## Empfehlung

| Szenario | Lösung |
|----------|--------|
| Handy-Nutzung, Server vorhanden | **PWA** (0 Aufwand) |
| Play Store Listing gewünscht | **TWA via PWABuilder** (30 min) |
| Native Features nötig (Notifications etc.) | **Capacitor** (2-3 Stunden) |
| Offline-first mit Sync | **Capacitor + lokale DB** (2-3 Tage) |

Für dich als Single-User mit Server (Pi oder VPS): **PWA reicht völlig.**
