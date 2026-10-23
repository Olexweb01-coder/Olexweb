#!/bin/sh
for h in paletteforge freemovies clicky down masonry shotcut squoosh tldraw invented feeds gradientlab fontpair; do grep -q " $h.test$" /etc/hosts || echo "127.0.0.1 $h.test" >> /etc/hosts; done  # hosts-setup
service postgresql start >/dev/null 2>&1; sleep 2
cd /home/claude/Olexweb
export DATABASE_URL=postgres://olex:olex@localhost/olexweb DATABASE_URL_POOLED=postgres://olex:olex@localhost/olexweb
export AUTH_SECRET=test-secret-that-is-long-enough-0123456789abcdef CRON_SECRET=cron-secret-that-is-long-enough-0123456789
export YT_CLIENT_ID=test-client YT_CLIENT_SECRET=test-secret YT_SITE_ORIGIN=http://localhost:3000
export YT_AUTH_URL=http://localhost:4555/auth YT_TOKEN_URL=http://localhost:4555/token YT_REVOKE_URL=http://localhost:4555/revoke YT_API_BASE=http://localhost:4555 YT_ANALYTICS_BASE=http://localhost:4555
node /home/claude/yt-test/mock-google.mjs > /tmp/mock.log 2>&1 &
MOCK=$!
npx next start -p 3000 > /tmp/next.log 2>&1 &
NEXT=$!
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:3000/admin/login && break; sleep 1; done
cd /home/claude/yt-test && node test.mjs; R1=$?
# reconnect, restart the server (no cached token), make Google refuse the stored sign-in
OWNER=$(node -e "
const pg=require('pg'),c=require('crypto');(async()=>{const d=new pg.Client({connectionString:'postgres://olex:olex@localhost/olexweb'});await d.connect();
const u=(await d.query(\"select id from admin_users where email='owner@test.local'\")).rows[0];const t=c.randomBytes(32).toString('base64url');
await d.query(\"insert into sessions (id_hash,user_id,expires_at) values (\$1,\$2,now()+interval '1 day')\",[c.createHash('sha256').update(t).digest('hex'),u.id]);console.log(t);await d.end()})()")
LOC=$(curl -s -o /dev/null -D - -H "cookie: __Host-olex_sess=$OWNER" http://localhost:3000/admin/api/youtube/connect | grep -i '^location' | tr -d '\r' | cut -d' ' -f2)
STATE=$(echo "$LOC" | sed -E 's/.*[?&]state=([^&]*).*/\1/')
BACK=$(curl -s -o /dev/null -D - "$LOC" | grep -i '^location' | tr -d '\r' | cut -d' ' -f2)
curl -s -H "cookie: olex_yt_state=$STATE" "$BACK" | grep -o 'yt=[a-z_]*' | head -1
kill $NEXT; kill $(pgrep -f next-server) 2>/dev/null; sleep 2
curl -s "http://localhost:4555/_set?revokedRefresh=true" > /dev/null
cd /home/claude/Olexweb && npx next start -p 3000 > /tmp/next2.log 2>&1 &
NEXT=$!
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:3000/admin/login && break; sleep 1; done
echo; echo "10. Google withdraws the sign-in (fresh server, no cached access)"
cd /home/claude/yt-test && node test2.mjs "$OWNER"; R2=$?
kill $NEXT $MOCK; kill $(pgrep -f next-server) 2>/dev/null
echo "server errors logged:"; grep -iE "error|failed" /tmp/next.log /tmp/next2.log | grep -v "youtube token exchange failed" | head -5
exit $((R1+R2))
