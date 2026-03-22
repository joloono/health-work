# Raspberry Pi Deployment

## Was es ist

Dein Raspberry Pi wird zum persönlichen Server. Er läuft 24/7 bei dir zuhause, braucht ~3 Watt Strom (~8 CHF/Jahr), und hostet die Health System App für alle deine Geräte im gleichen Netzwerk.

## Voraussetzungen

- Raspberry Pi 3, 4 oder 5 (jedes Modell reicht)
- SD-Karte (8 GB+) mit Raspberry Pi OS
- Netzwerkkabel oder WLAN-Verbindung
- SSH-Zugang zum Pi (oder Tastatur + Monitor)

## Schritt für Schritt

### 1. Docker auf dem Pi installieren (einmalig, 2 Minuten)

```bash
ssh pi@raspberrypi.local
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker pi
logout
# Neu einloggen
ssh pi@raspberrypi.local
docker --version  # Sollte funktionieren
```

### 2. Projekt auf den Pi kopieren

```bash
# Vom Laptop aus:
scp -r /pfad/zu/2026_03HealthSystem pi@raspberrypi.local:~/health-system

# Oder mit Git:
ssh pi@raspberrypi.local
git clone <dein-repo> ~/health-system
```

### 3. Konfigurieren und starten

```bash
cd ~/health-system

# Passwort setzen
echo "AUTH_USER=jo" > .env
echo "AUTH_PASS=dein-sicheres-passwort" >> .env

# Bauen und starten
docker compose up -d --build
```

Das Build dauert auf dem Pi ~5 Minuten (ARM-Architektur). Danach läuft die App.

### 4. IP-Adresse herausfinden

```bash
hostname -I
# z.B. 192.168.1.50
```

### 5. Von jedem Gerät zugreifen

Öffne im Browser: `http://192.168.1.50:3001`

- Laptop: Browser öffnen
- Handy: Browser öffnen, als PWA installieren
- Tablet: gleiche URL

## Auto-Start nach Neustart

Docker Compose mit `restart: unless-stopped` (ist bereits konfiguriert) startet die App automatisch wenn der Pi neu bootet.

## Backup

Die DB liegt im Docker Volume. Tägliches Backup:

```bash
# Einmal einrichten:
crontab -e
# Zeile hinzufügen:
0 3 * * * docker compose -f ~/health-system/docker-compose.yml exec -T health-system cp /app/data/health.db /app/data/backup-$(date +\%Y\%m\%d).db
```

## Ressourcenverbrauch

| Ressource | Wert |
|-----------|------|
| RAM | ~50 MB |
| CPU | ~0% idle |
| Speicher | ~200 MB (Docker Image + DB) |
| Strom | ~3 Watt |

## Limitation

Nur im lokalen Netzwerk erreichbar. Für Zugriff von unterwegs → siehe Tailscale oder Cloudflare Tunnel.
