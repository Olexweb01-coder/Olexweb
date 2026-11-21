#!/usr/bin/env bash
# Olexweb Meet: our own free video server (LiveKit, open source) on an Ubuntu 22.04 computer (Oracle Always Free, ARM).
# Run on that computer:  sudo bash install.sh meet-rtc.olexweb.com turn-rtc.olexweb.com you@email.com
# Safe to run again: it keeps the same keys and just updates and restarts.
set -euo pipefail
MAIN="${1:?Give the main address, e.g. meet-rtc.olexweb.com}"; TURN="${2:?Give the turn address, e.g. turn-rtc.olexweb.com}"; EMAIL="${3:?Give your email (for the security certificates)}"
HOOK="https://meet.olexweb.com/api/meet/livekit"
D=/opt/livekit; mkdir -p "$D/caddy_data"; cd "$D"

echo "1/5 Installing Docker…"
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

echo "2/5 Keys…"
if [ -f "$D/keys.env" ]; then . "$D/keys.env"; else
  KEY="API$(openssl rand -hex 6)"; SECRET="$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 48)"
  printf 'KEY=%s\nSECRET=%s\n' "$KEY" "$SECRET" > "$D/keys.env"; chmod 600 "$D/keys.env"
fi

echo "3/5 Settings…"
CERTS=/data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/$TURN
cat > livekit.yaml <<Y
port: 7880
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
turn:
  enabled: true
  domain: $TURN
  udp_port: 3478
  tls_port: 5349
  cert_file: $CERTS/$TURN.crt
  key_file: $CERTS/$TURN.key
room:
  empty_timeout: 1800
keys:
  $KEY: $SECRET
webhook:
  api_key: $KEY
  urls:
    - $HOOK
Y
chmod 600 livekit.yaml
cat > Caddyfile <<C
{
  email $EMAIL
  acme_ca https://acme-v02.api.letsencrypt.org/directory
}
$MAIN {
  reverse_proxy localhost:7880
}
$TURN {
  respond "ok"
}
C
cat > docker-compose.yml <<C
services:
  caddy:
    image: caddy:2
    network_mode: host
    restart: unless-stopped
    volumes: [ "./Caddyfile:/etc/caddy/Caddyfile:ro", "./caddy_data:/data" ]
  livekit:
    image: livekit/livekit-server:latest
    command: --config /etc/livekit.yaml
    network_mode: host
    restart: unless-stopped
    volumes: [ "./livekit.yaml:/etc/livekit.yaml:ro", "./caddy_data:/data:ro" ]
C

echo "4/5 Opening the computer's own firewall…"
for r in "tcp 80" "tcp 443" "tcp 7881" "tcp 5349" "udp 3478" "udp 50000:60000"; do
  set -- $r; iptables -C INPUT -p "$1" -m state --state NEW --dport "$2" -j ACCEPT 2>/dev/null || iptables -I INPUT -p "$1" -m state --state NEW --dport "$2" -j ACCEPT
done
DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent >/dev/null 2>&1 || true
netfilter-persistent save >/dev/null 2>&1 || true
# the turn certificate renews every ~60 days; a weekly restart (Sunday 4am, a few seconds) picks up the new one
( crontab -l 2>/dev/null | grep -v 'livekit restart' ; echo "0 4 * * 0 cd $D && docker compose restart livekit >/dev/null 2>&1 # livekit restart" ) | crontab -

echo "5/5 Starting…"
docker compose pull -q && docker compose up -d
# the turn certificate takes a moment the first time; restart once it's there
for i in $(seq 1 24); do [ -f "$D/caddy_data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/$TURN/$TURN.crt" ] && break; sleep 5; done
docker compose restart livekit >/dev/null

echo
echo "Done. Check https://$MAIN in a browser: it should say OK."
echo "Add these three in Vercel → Settings → Environment Variables (then Redeploy). Don't share them with anyone:"
echo
echo "LIVEKIT_SELF_URL=wss://$MAIN"
echo "LIVEKIT_SELF_API_KEY=$KEY"
echo "LIVEKIT_SELF_API_SECRET=$SECRET"
