# Deployment: Health System

## Option 1: Docker Compose (VPS / lokal)

```bash
# .env Datei anlegen
echo "AUTH_USER=jo" > .env
echo "AUTH_PASS=dein-sicheres-passwort" >> .env

# Starten
docker compose up -d --build

# Läuft auf http://localhost:3001
# Daten persistent in Docker Volume "health-data"
```

## Option 2: Google Cloud Run (Firebase-nah)

Cloud Run ist serverless, aber SQLite braucht ein persistentes Filesystem.
Lösung: Cloud Run mit **Volume Mount** auf ein NFS/Filestore oder **Cloud Run mit persistent disk** (GA seit 2024).

### Voraussetzungen

```bash
# Google Cloud CLI installiert + eingeloggt
gcloud auth login
gcloud config set project DEIN-PROJEKT-ID
```

### 1. Container bauen & pushen

```bash
# Artifact Registry erstellen (einmalig)
gcloud artifacts repositories create health-system \
  --repository-format=docker \
  --location=europe-west6

# Image bauen & pushen
gcloud builds submit --tag europe-west6-docker.pkg.dev/DEIN-PROJEKT-ID/health-system/app:latest
```

### 2. Cloud Run deployen mit persistentem Volume

```bash
gcloud run deploy health-system \
  --image europe-west6-docker.pkg.dev/DEIN-PROJEKT-ID/health-system/app:latest \
  --region europe-west6 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "AUTH_USER=jo,AUTH_PASS=dein-sicheres-passwort,DB_PATH=/app/data/health.db,PORT=8080" \
  --min-instances 1 \
  --max-instances 1 \
  --cpu 1 \
  --memory 512Mi \
  --execution-environment gen2 \
  --add-volume name=health-data,type=cloud-storage,bucket=DEIN-BUCKET-NAME \
  --add-volume-mount volume=health-data,mount-path=/app/data
```

### 3. Cloud Storage Bucket erstellen (für DB-Persistenz)

```bash
gcloud storage buckets create gs://DEIN-BUCKET-NAME --location=europe-west6
```

**Wichtig:** `--min-instances 1` verhindert Cold Starts und hält die SQLite-DB geladen.

### Alternative: Cloud Run mit Filestore (NFS)

Für echte Dateisystem-Persistenz (besser für SQLite WAL-Modus):

```bash
# Filestore erstellen
gcloud filestore instances create health-fs \
  --zone=europe-west6-a \
  --tier=BASIC_HDD \
  --file-share=name=healthdata,capacity=1TB \
  --network=name=default

# VPC Connector für Cloud Run
gcloud compute networks vpc-access connectors create health-connector \
  --region=europe-west6 \
  --range=10.8.0.0/28

# Deploy mit NFS Volume
gcloud run deploy health-system \
  --image europe-west6-docker.pkg.dev/DEIN-PROJEKT-ID/health-system/app:latest \
  --region europe-west6 \
  --vpc-connector health-connector \
  --add-volume name=health-data,type=nfs,location=FILESTORE-IP:/healthdata \
  --add-volume-mount volume=health-data,mount-path=/app/data \
  --set-env-vars "AUTH_USER=jo,AUTH_PASS=PASSWORT,DB_PATH=/app/data/health.db,PORT=8080" \
  --min-instances 1 --max-instances 1
```

## Option 3: Einfachster Weg — VPS mit Docker

Auf deinem bestehenden VPS (Hetzner, ~4€/Monat):

```bash
# Repo klonen
git clone <repo-url> health-system
cd health-system

# .env anlegen
cat > .env << 'EOF'
AUTH_USER=jo
AUTH_PASS=dein-sicheres-passwort
EOF

# Starten
docker compose up -d --build

# Reverse Proxy (nginx) für HTTPS
# Deine Domain zeigt auf den VPS, Certbot für TLS
```

## Backup

```bash
# Manuelle Kopie der DB
docker compose exec health-system cp /app/data/health.db /app/data/backup-$(date +%Y%m%d).db

# Cron (täglich um 3 Uhr)
0 3 * * * docker compose -f /pfad/zu/docker-compose.yml exec -T health-system cp /app/data/health.db /app/data/backup-$(date +\%Y\%m\%d).db
```
