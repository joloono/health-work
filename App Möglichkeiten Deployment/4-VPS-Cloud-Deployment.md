# VPS / Cloud Deployment

## Option A: VPS mit Docker (empfohlen)

Ein VPS (Virtual Private Server) ist ein gemieteter Linux-Server in der Cloud. Immer erreichbar, feste IP, HTTPS möglich. Perfekt für SQLite.

### Anbieter & Kosten

| Anbieter | Modell | Preis | Reicht? |
|----------|--------|-------|---------|
| Hetzner | CX22 | ~4 €/mo | Ja, massiv überdimensioniert |
| DigitalOcean | Basic | ~6 $/mo | Ja |
| Infomaniak | VPS Starter | ~5 CHF/mo | Ja, CH-Hosting |

### Schritt für Schritt

```bash
# 1. SSH auf den VPS
ssh root@dein-server.example.com

# 2. Docker installieren
curl -fsSL https://get.docker.com | sh

# 3. Projekt klonen
git clone <dein-repo> /opt/health-system
cd /opt/health-system

# 4. Passwort setzen
echo "AUTH_USER=jo" > .env
echo "AUTH_PASS=sicheres-passwort" >> .env

# 5. Starten
docker compose up -d --build

# 6. HTTPS mit Nginx + Certbot
apt install nginx certbot python3-certbot-nginx
```

**Nginx Config** (`/etc/nginx/sites-available/health`):
```nginx
server {
    server_name health.deine-domain.ch;
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/health /etc/nginx/sites-enabled/
certbot --nginx -d health.deine-domain.ch
systemctl reload nginx
```

**Fertig.** App läuft unter `https://health.deine-domain.ch`.

---

## Option B: Google Cloud Run

Cloud Run führt Docker-Container serverless aus. Du zahlst nur wenn die App aufgerufen wird. Für SQLite problematisch wegen fehlendem persistentem Dateisystem.

### Das Problem mit SQLite auf Cloud Run

Cloud Run ist **stateless** — bei jedem Neustart ist das Dateisystem leer. SQLite braucht eine echte Datei. Workaround: Cloud Storage als Volume mounten. Aber:
- Kein echtes File-Locking (SQLite WAL geht nicht)
- Langsame Writes (~130ms+)
- Nur 1 Instance erlaubt (sonst DB-Korruption)

### Trotzdem machen? So geht's:

```bash
# 1. Voraussetzung: gcloud CLI installiert + eingeloggt
gcloud auth login
gcloud config set project DEIN-PROJEKT

# 2. Bucket für DB erstellen
gcloud storage buckets create gs://health-system-db --location=europe-west6

# 3. Image bauen und pushen
gcloud builds submit --tag europe-west6-docker.pkg.dev/DEIN-PROJEKT/health/app

# 4. Deployen
gcloud run deploy health-system \
  --image europe-west6-docker.pkg.dev/DEIN-PROJEKT/health/app \
  --region europe-west6 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "AUTH_USER=jo,AUTH_PASS=passwort,DB_PATH=/data/health.db,PORT=8080" \
  --min-instances 1 --max-instances 1 \
  --execution-environment gen2 \
  --add-volume name=db,type=cloud-storage,bucket=health-system-db \
  --add-volume-mount volume=db,mount-path=/data
```

### Kosten
- ~0-5 €/mo bei geringer Nutzung (min-instances 1 kostet ~15 €/mo)
- Cloud Storage: centimes

### Empfehlung
Cloud Run ist **nicht ideal für SQLite**. Wenn du Cloud willst, nimm einen VPS. Wenn du serverless willst, migriere zu einer gehosteten DB (Supabase, Turso).

---

## Vergleich

| Kriterium | VPS | Cloud Run | Raspberry Pi |
|-----------|-----|-----------|-------------|
| Kosten | 4-6 €/mo | 0-15 €/mo | Einmalig ~50 CHF |
| SQLite-Support | Perfekt | Fragil | Perfekt |
| HTTPS | Ja (Certbot) | Ja (automatisch) | Via Tunnel |
| Erreichbarkeit | Weltweit | Weltweit | Lokal (+Tunnel) |
| Wartung | Gering | Keine | Gering |
| Setup-Zeit | 15 min | 30 min | 10 min |
