# Zugriff von unterwegs (Tailscale / Cloudflare Tunnel)

## Das Problem

Dein Pi hängt zuhause im Netzwerk. Von unterwegs (Büro, Café, Zug) erreichst du `192.168.1.50` nicht. Du brauchst einen Tunnel.

## Option A: Tailscale (empfohlen, 5 Minuten)

Tailscale ist ein VPN, das deine Geräte direkt verbindet — ohne Port-Forwarding, ohne Router-Konfiguration. Gratis für 3 Geräte.

### Setup

**Auf dem Pi:**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# Link öffnen, mit Google/GitHub einloggen
tailscale ip -4
# z.B. 100.64.0.5
```

**Auf dem Handy/Laptop:**
1. Tailscale App installieren (Android/iOS/Windows/Mac)
2. Mit gleichem Account einloggen

**Fertig.** Die App ist jetzt von überall erreichbar unter: `http://100.64.0.5:3001`

### Vorteile
- Kein Port-Forwarding nötig
- Verschlüsselt (WireGuard)
- Gratis für persönliche Nutzung
- Pi bleibt unsichtbar fürs Internet

### Nachteil
- Tailscale-App muss auf jedem Gerät laufen

---

## Option B: Cloudflare Tunnel (öffentliche URL)

Cloudflare Tunnel gibt dir eine echte URL (z.B. `health.deine-domain.ch`) ohne Port-Forwarding. Gratis. Dein Pi bleibt hinter dem Router, Cloudflare tunnelt den Traffic.

### Voraussetzung
- Eine Domain (z.B. bei Cloudflare registriert, oder DNS auf Cloudflare zeigen)

### Setup

**Auf dem Pi:**
```bash
# Cloudflared installieren
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare.gpg
echo "deb [signed-by=/usr/share/keyrings/cloudflare.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared

# Tunnel erstellen
cloudflared tunnel login
cloudflared tunnel create health-system
cloudflared tunnel route dns health-system health.deine-domain.ch

# Config schreiben
cat > ~/.cloudflared/config.yml << EOF
tunnel: <TUNNEL-ID>
credentials-file: /home/pi/.cloudflared/<TUNNEL-ID>.json
ingress:
  - hostname: health.deine-domain.ch
    service: http://localhost:3001
  - service: http_status:404
EOF

# Starten als Service
sudo cloudflared service install
sudo systemctl start cloudflared
```

**Fertig.** Die App ist unter `https://health.deine-domain.ch` erreichbar — mit HTTPS, weltweit.

### Vorteile
- Echte URL mit HTTPS
- Keine App nötig auf den Clients — normaler Browser reicht
- Gratis
- Pi bleibt unsichtbar

### Nachteil
- Etwas mehr Setup als Tailscale
- Braucht eine Domain

---

## Empfehlung

| Szenario | Lösung |
|----------|--------|
| Nur zuhause | Nichts nötig, direkte IP |
| Unterwegs, nur eigene Geräte | **Tailscale** (5 Min Setup) |
| Unterwegs, beliebige Geräte, echte URL | **Cloudflare Tunnel** (15 Min Setup) |
