#!/usr/bin/env bash
# Olexweb Mail: set up Olaitan's own mail server, once, on a fresh Ubuntu 24.04 server (Oracle Cloud Always Free).
#   sudo bash setup.sh
# Installs Postfix (delivers the mail), OpenDKIM (signs it as olexweb.com), Caddy (HTTPS for the relay, free certificates),
# the Olexweb Mail relay (the private sending API the site calls) and the bounce reader (tells the site about bounces).
# Opens the ports it needs, including through Oracle's own firewall rules. Safe to run again (it keeps the existing key
# and token). At the end it prints the DNS records to add in Cloudflare and the settings to add in Vercel.
# Before running: Oracle must have unblocked outbound port 25 for your account, and its Security List must allow
# incoming TCP 25, 80 and 443 (Networking → Virtual Cloud Networks → your network → Security Lists → Add Ingress Rules).
set -euo pipefail
DOMAIN="${DOMAIN:-olexweb.com}"; HOST="${HOST:-mail.olexweb.com}"; SITE_URL="${SITE_URL:-https://olexweb.com}"; SELECTOR="${SELECTOR:-olex}"
HERE="$(cd "$(dirname "$0")" && pwd)"; ENVF=/etc/olexweb-mail.env
say() { printf '\n\033[1;32m== %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*"; }
[ "$(id -u)" = 0 ] || { echo "Run it with sudo: sudo bash setup.sh"; exit 1; }
grep -q 'VERSION_ID="24.04"' /etc/os-release || warn "This was written for Ubuntu 24.04; continuing anyway."
for f in relay.mjs bounce.mjs; do [ -f "$HERE/$f" ] || { echo "Missing $HERE/$f (copy the whole scripts/mailserver folder)"; exit 1; }; done

say "1. Name and packages"
hostnamectl set-hostname "$HOST"
echo "postfix postfix/main_mailer_type select Internet Site" | debconf-set-selections
echo "postfix postfix/mailname string $HOST" | debconf-set-selections
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q postfix opendkim opendkim-tools nodejs caddy iptables-persistent netcat-openbsd dnsutils openssl >/dev/null
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)' || { echo "Node 18 or newer is needed"; exit 1; }

say "2. A user for the relay, and its settings (the secret token is made once and kept)"
id olexmail >/dev/null 2>&1 || useradd --system --home /opt/olexweb-mail --shell /usr/sbin/nologin olexmail
install -d -o olexmail -g olexmail -m 750 /opt/olexweb-mail
install -o olexmail -g olexmail -m 640 "$HERE/relay.mjs" "$HERE/bounce.mjs" /opt/olexweb-mail/
if [ ! -f "$ENVF" ]; then
  printf 'MAIL_TOKEN=%s\nMAIL_HOST=%s\nSITE_URL=%s\n' "$(openssl rand -hex 32)" "$HOST" "$SITE_URL" > "$ENVF"
fi
chown olexmail:olexmail "$ENVF"; chmod 600 "$ENVF"
TOKEN="$(grep ^MAIL_TOKEN= "$ENVF" | cut -d= -f2)"
cat > /opt/olexweb-mail/bounce.sh <<EOF
#!/bin/sh
# Postfix runs this (as olexmail) for each bounce notice to bounces+<id>@$HOST
set -a; . $ENVF; set +a
exec /usr/bin/node /opt/olexweb-mail/bounce.mjs "\$ORIGINAL_RECIPIENT"
EOF
chown olexmail:olexmail /opt/olexweb-mail/bounce.sh; chmod 750 /opt/olexweb-mail/bounce.sh

say "3. DKIM: signing every email as $DOMAIN (selector $SELECTOR)"
install -d -o opendkim -g opendkim -m 750 /etc/opendkim/keys/"$DOMAIN"
if [ ! -f /etc/opendkim/keys/"$DOMAIN"/"$SELECTOR".private ]; then
  opendkim-genkey -b 2048 -d "$DOMAIN" -s "$SELECTOR" -D /etc/opendkim/keys/"$DOMAIN"
  chown opendkim:opendkim /etc/opendkim/keys/"$DOMAIN"/*
fi
cat > /etc/opendkim.conf <<EOF
Syslog yes
UMask 007
Mode s
Domain $DOMAIN
Selector $SELECTOR
KeyFile /etc/opendkim/keys/$DOMAIN/$SELECTOR.private
Canonicalization relaxed/simple
SignatureAlgorithm rsa-sha256
OversignHeaders From
Socket inet:8891@127.0.0.1
PidFile /run/opendkim/opendkim.pid
UserID opendkim
EOF
systemctl enable --now opendkim >/dev/null; systemctl restart opendkim

say "4. Postfix: sends for the relay, receives only bounces for $HOST"
postconf -e "myhostname = $HOST" "myorigin = $HOST" "mydestination = $HOST, localhost" "inet_interfaces = all" "inet_protocols = ipv4" \
  "mynetworks = 127.0.0.0/8" "smtpd_relay_restrictions = permit_mynetworks, reject_unauth_destination" "recipient_delimiter = +" \
  "smtp_tls_security_level = may" "smtp_tls_loglevel = 1" "smtpd_tls_security_level = may" "smtpd_helo_required = yes" "disable_vrfy_command = yes" \
  "message_size_limit = 10485760" "milter_default_action = accept" "milter_protocol = 6" \
  "smtpd_milters = inet:127.0.0.1:8891" "non_smtpd_milters = inet:127.0.0.1:8891" \
  "alias_maps = hash:/etc/aliases, hash:/opt/olexweb-mail/aliases" "alias_database = hash:/etc/aliases, hash:/opt/olexweb-mail/aliases"
printf 'bounces: "|/opt/olexweb-mail/bounce.sh"\n' > /opt/olexweb-mail/aliases
chown olexmail:olexmail /opt/olexweb-mail/aliases                       # Postfix runs the pipe as this file's owner
grep -q '^postmaster:' /etc/aliases || echo 'postmaster: root' >> /etc/aliases
grep -q '^root:' /etc/aliases || echo "root: info@$DOMAIN" >> /etc/aliases
newaliases; postalias /opt/olexweb-mail/aliases; chown olexmail:olexmail /opt/olexweb-mail/aliases.db 2>/dev/null || true
systemctl enable --now postfix >/dev/null; systemctl restart postfix

say "5. The relay (private sending API) and HTTPS"
cat > /etc/systemd/system/olexweb-mail-relay.service <<EOF
[Unit]
Description=Olexweb Mail relay
After=network-online.target postfix.service
[Service]
User=olexmail
EnvironmentFile=$ENVF
ExecStart=/usr/bin/node /opt/olexweb-mail/relay.mjs
Restart=always
RestartSec=3
NoNewPrivileges=no
ProtectSystem=full
ProtectHome=yes
PrivateTmp=yes
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload; systemctl enable --now olexweb-mail-relay >/dev/null; systemctl restart olexweb-mail-relay
printf '%s {\n\treverse_proxy 127.0.0.1:8025\n}\n' "$HOST" > /etc/caddy/Caddyfile
systemctl enable --now caddy >/dev/null; systemctl reload caddy || systemctl restart caddy

say "6. Firewall: SSH, mail (25) and HTTPS (80, 443), including Oracle's own rules"
for p in 25 80 443; do iptables -C INPUT -p tcp --dport "$p" -j ACCEPT 2>/dev/null || iptables -I INPUT 5 -p tcp --dport "$p" -m state --state NEW -j ACCEPT; done
netfilter-persistent save >/dev/null 2>&1 || true

say "7. Checks"
IP="$(curl -s -4 https://ifconfig.me || true)"
sleep 2
curl -s http://127.0.0.1:8025/health | grep -q '"ok":true' && echo "✓ relay running" || warn "relay not answering: journalctl -u olexweb-mail-relay"
systemctl is-active --quiet opendkim && echo "✓ DKIM signing running" || warn "opendkim not running: journalctl -u opendkim"
systemctl is-active --quiet postfix && echo "✓ Postfix running" || warn "postfix not running: journalctl -u postfix"
if timeout 8 nc -z gmail-smtp-in.l.google.com 25 2>/dev/null; then echo "✓ outbound port 25 is open (Oracle unblocked it)"; else warn "outbound port 25 is BLOCKED: Oracle hasn't unblocked it yet. Nothing will deliver until they do."; fi
PTR="$(dig +short -x "$IP" 2>/dev/null | sed 's/\.$//')"
[ "$PTR" = "$HOST" ] && echo "✓ reverse DNS: $IP → $HOST" || warn "reverse DNS for $IP is '${PTR:-none}' (ask Oracle to set it to $HOST)"

DKIM="$(sed -n 's/.*"\(.*\)".*/\1/p' /etc/opendkim/keys/"$DOMAIN"/"$SELECTOR".txt | tr -d '\n\t ')"
say "8. Add these DNS records in Cloudflare (all DNS only, proxy OFF)"
cat <<EOF
  A      mail                 $IP
  MX     mail                 mail.$DOMAIN   (priority 10)    ← bounces come back to this server
  TXT    $SELECTOR._domainkey   $DKIM
  SPF:   edit your ONE existing TXT record on $DOMAIN that starts with v=spf1 and add  ip4:$IP
         e.g.  v=spf1 include:zohomail.com include:spf.mailjet.com ip4:$IP ~all
  DMARC: if there's no TXT record named _dmarc, add:  _dmarc   v=DMARC1; p=none; rua=mailto:info@$DOMAIN
EOF
say "9. Add these in Vercel → Environment Variables (no quotation marks), then redeploy"
cat <<EOF
  OWN_MAIL_URL           https://$HOST
  OWN_MAIL_TOKEN         $TOKEN
  OWN_MAIL_DAILY_LIMIT   50      ← warm-up: start low, raise it slowly over a few weeks (100, 200, 500…)
EOF
echo; echo "Then: Admin → Mail → Send test. Keep this window's output private (it shows your token)."
