# PWA — Progressive Web App

## Was es ist

Eine PWA ist deine Website mit zwei Extra-Dateien, die dem Browser sagen: "Du kannst mich wie eine App installieren." Kein App Store. Kein Download. Du öffnest die URL, tippst "Zum Startbildschirm hinzufügen" — fertig.

## Was du bekommst

- Eigenes App-Icon auf dem Homescreen (Handy + Desktop)
- Vollbild ohne Browser-Rahmen — sieht aus wie eine native App
- Offline-Grundfunktion: Timer läuft weiter, Daten werden zwischengespeichert
- Funktioniert auf Android, iOS, Windows, Mac, Linux — überall wo ein Browser läuft

## Was du NICHT bekommst

- Kein App Store Listing
- Keine Hintergrund-Prozesse (Timer stoppt wenn App komplett geschlossen)
- Kein Zugriff auf Hardware-Sensoren (Schrittzähler etc.)

## Was technisch dazukommt

Zwei Dateien im Projekt:

**manifest.json** — Beschreibt die App (Name, Icon, Farben, Startseite):
```json
{
  "name": "Health System",
  "short_name": "Health",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#fafaf8",
  "theme_color": "#c44d2b",
  "icons": [{ "src": "/icon-192.png", "sizes": "192x192" }]
}
```

**service-worker.js** — Cached die App für Offline-Nutzung:
```js
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open('health-v1').then((c) => c.addAll(['/', '/index.html'])));
});
```

## Installation auf dem Handy

1. Öffne die App-URL im Chrome
2. Chrome zeigt automatisch "App installieren" oder du tippst auf ⋮ → "Zum Startbildschirm"
3. App erscheint als Icon — öffnet im Vollbild

## Fazit

PWA ist der einfachste Weg, deine Web-App auf jedem Gerät als "echte App" zu nutzen. Kein zusätzlicher Code, kein Store, kein Deployment-Aufwand. Du brauchst nur einen Server, der die App ausliefert.
