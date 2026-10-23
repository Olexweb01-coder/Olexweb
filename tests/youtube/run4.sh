#!/bin/sh
for h in paletteforge freemovies clicky down masonry shotcut squoosh tldraw invented feeds gradientlab fontpair; do grep -q " $h.test$" /etc/hosts || echo "127.0.0.1 $h.test" >> /etc/hosts; done  # hosts-setup
service postgresql start >/dev/null 2>&1; sleep 2
cd /home/claude/Olexweb
export DATABASE_URL=postgres://olex:olex@localhost/olexweb DATABASE_URL_POOLED=postgres://olex:olex@localhost/olexweb
export AUTH_SECRET=test-secret-that-is-long-enough-0123456789abcdef CRON_SECRET=cron-secret-that-is-long-enough-0123456789
export YT_CLIENT_ID=test-client YT_CLIENT_SECRET=test-secret YT_SITE_ORIGIN=http://localhost:3000
export YT_AUTH_URL=http://localhost:4555/auth YT_TOKEN_URL=http://localhost:4555/token YT_REVOKE_URL=http://localhost:4555/revoke YT_API_BASE=http://localhost:4555 YT_ANALYTICS_BASE=http://localhost:4555
export ASSISTANT_TEST_HOSTS=paletteforge.test:4555,freemovies.test:4555,clicky.test:4555,down.test:4555,masonry.test:4555,shotcut.test:4555,squoosh.test:4555,tldraw.test:4555,invented.test:4555,feeds.test:4555,gradientlab.test:4555,fontpair.test:4555,localhost:4555 GEMINI_API_KEY=test-key ASSISTANT_GEMINI_BASE=http://localhost:4555 ASSISTANT_GEMINI_RETRY_MS=10
export YTI_FEEDS='[["Mock Picks","http://feeds.test:4555/feed/curated"]]'
export YTI_SHOW_URL="http://localhost:4555/src/show?x=" YTI_TOP_URL="http://localhost:4555/src/top?x=" YTI_GITHUB_URL="http://localhost:4555/src/github?x="
node /home/claude/yt-test/mock-google.mjs > /tmp/mock.log 2>&1 &
npx next start -p 3000 > /tmp/next4.log 2>&1 &
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:3000/admin/login && break; sleep 1; done
SESS='const pg=require("pg"),c=require("crypto");(async()=>{const d=new pg.Client({connectionString:"postgres://olex:olex@localhost/olexweb"});await d.connect();const u=(await d.query("select id from admin_users where email=$1",[process.argv[1]])).rows[0];const t=c.randomBytes(32).toString("base64url");await d.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '"'"'1 day'"'"')",[c.createHash("sha256").update(t).digest("hex"),u.id]);console.log(t);await d.end()})()'
OWNER=$(node -e "$SESS" owner@test.local); EDITOR=$(node -e "$SESS" editor@test.local)
LOC=$(curl -s -o /dev/null -D - -H "cookie: __Host-olex_sess=$OWNER" http://localhost:3000/admin/api/youtube/connect | grep -i '^location' | tr -d '\r' | cut -d' ' -f2)
STATE=$(echo "$LOC" | sed -E 's/.*[?&]state=([^&]*).*/\1/')
BACK=$(curl -s -o /dev/null -D - "$LOC" | grep -i '^location' | tr -d '\r' | cut -d' ' -f2)
echo "YouTube: $(curl -s -H "cookie: olex_yt_state=$STATE" "$BACK" | grep -o 'yt=[a-z_]*' | head -1)"
cd /home/claude/yt-test && node test3.mjs "$OWNER" "$EDITOR" > /tmp/t3.log; R3=$?; grep -E "[0-9]+ passed" /tmp/t3.log; node test4.mjs "$OWNER" "$EDITOR"; R=$((R3+$?))
echo "$OWNER" > /tmp/owner.tok
pkill -f "next-serve[r]"; pkill -f "mock-googl[e]"
echo "server errors:"; grep -iE "error|failed" /tmp/next4.log | grep -viE "token exchange|youtube ideas" | head -5
exit $R
