#!/bin/bash
set -e

echo "🏛️ Health System — Raspberry Pi Setup"
echo "======================================="
echo ""

# 1. Check/install Docker
if ! command -v docker &> /dev/null; then
  echo "📦 Docker wird installiert..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  echo "✅ Docker installiert. Bitte einmal ausloggen und wieder einloggen,"
  echo "   dann dieses Script erneut starten."
  exit 0
fi

# 2. Check Docker Compose
if ! docker compose version &> /dev/null; then
  echo "❌ Docker Compose nicht gefunden. Bitte Docker aktualisieren."
  exit 1
fi

echo "✅ Docker ist bereit"

# 3. Create .env if not exists
if [ ! -f .env ]; then
  echo ""
  echo "🔐 Zugangsdaten konfigurieren"
  read -p "   Benutzername [jo]: " AUTH_USER
  AUTH_USER=${AUTH_USER:-jo}
  read -sp "   Passwort: " AUTH_PASS
  echo ""

  if [ -z "$AUTH_PASS" ]; then
    echo "❌ Passwort darf nicht leer sein."
    exit 1
  fi

  cat > .env << EOF
AUTH_USER=$AUTH_USER
AUTH_PASS=$AUTH_PASS
EOF
  echo "✅ .env erstellt"
else
  echo "✅ .env existiert bereits"
fi

# 4. Build and start
echo ""
echo "🔨 Container wird gebaut (dauert 3-5 min auf dem Pi)..."
docker compose up -d --build

# 5. Wait for health check
echo "⏳ Warte auf Start..."
sleep 5

if curl -sf http://localhost:3001/healthz > /dev/null 2>&1; then
  echo ""
  echo "✅ Health System läuft!"
  echo ""
  IP=$(hostname -I | awk '{print $1}')
  echo "🌐 Zugriff im lokalen Netzwerk:"
  echo "   http://$IP:3001"
  echo ""
  echo "📱 Auf dem Handy:"
  echo "   1. URL im Chrome öffnen"
  echo "   2. ⋮ → 'Zum Startbildschirm hinzufügen'"
  echo "   3. Fertig — App ist installiert"
  echo ""
  echo "🔒 Für Zugriff von unterwegs: ./setup-tailscale.sh"
else
  echo "⚠️  Container gestartet, aber Health Check fehlgeschlagen."
  echo "   Prüfe mit: docker compose logs"
fi
