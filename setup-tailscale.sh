#!/bin/bash
set -e

echo "🌐 Tailscale Setup — Zugriff von überall"
echo "========================================="
echo ""

# 1. Install Tailscale
if ! command -v tailscale &> /dev/null; then
  echo "📦 Tailscale wird installiert..."
  curl -fsSL https://tailscale.com/install.sh | sh
  echo "✅ Tailscale installiert"
else
  echo "✅ Tailscale ist bereits installiert"
fi

# 2. Start Tailscale
echo ""
echo "🔑 Tailscale wird gestartet..."
echo "   Ein Link wird angezeigt — öffne ihn im Browser und logge dich ein."
echo ""
sudo tailscale up

# 3. Show IP
TAILSCALE_IP=$(tailscale ip -4 2>/dev/null || echo "unbekannt")
echo ""
echo "✅ Tailscale ist aktiv!"
echo ""
echo "🌐 Deine Tailscale-Adresse:"
echo "   http://$TAILSCALE_IP:3001"
echo ""
echo "📱 Nächste Schritte:"
echo "   1. Tailscale App auf Handy/Laptop installieren"
echo "   2. Mit gleichem Account einloggen"
echo "   3. URL oben im Browser öffnen — funktioniert überall"
