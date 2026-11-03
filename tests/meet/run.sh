# Meetings test runner: Postgres, a local LiveKit server, the built site, then e2e.py. Stops everything afterwards.
cd /home/claude/olexweb
service postgresql start >/dev/null 2>&1; sleep 1
psql postgres://olex:olex@localhost/olexweb -qc "delete from meetings"   # each run starts clean
export DATABASE_URL=postgres://olex:olex@localhost/olexweb DATABASE_URL_POOLED=postgres://olex:olex@localhost/olexweb
export CRON_SECRET=test-cron-secret-0123456789
export AUTH_SECRET=test-secret-that-is-long-enough-0123456789abcdef
export LIVEKIT_URL=ws://localhost:7880 LIVEKIT_API_KEY=devkey LIVEKIT_API_SECRET=secret
export GEMINI_API_KEY=test-key ASSISTANT_GEMINI_BASE=http://localhost:4566 ASSISTANT_GEMINI_RETRY_MS=10   # AI notes: tests/meet/mock-ai.mjs
pkill -f livekit-server; pkill -f "next start"; pkill -f next-server; pkill -f mock-ai.mjs; sleep 1
setsid nohup livekit-server --dev --bind 127.0.0.1 > /tmp/lk.log 2>&1 &
setsid nohup node tests/meet/mock-ai.mjs > /tmp/mock-ai.log 2>&1 &
setsid nohup npx next start -p 3000 > /tmp/next.log 2>&1 &
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:3000/meet/x && curl -s -o /dev/null http://localhost:7880 && break; sleep 0.5; done
python3 tests/meet/e2e.py; R=$?
python3 tests/meet/schedule.py || R=1
python3 tests/meet/olex.py || R=1
# the Meet app (meet.olexweb.com), with the production-style settings and the sign-in stand-in
pkill -f "next-serve[r]"; sleep 1
PGOPTIONS='-c client_min_messages=warning' psql postgres://olex:olex@localhost/olexweb -q -f db/meet-schema.sql
setsid nohup node tests/meet/mock-oauth.mjs > /tmp/mock-oauth.log 2>&1 &
MEET_ORIGIN=http://meet.localhost:3000 MAIN_ORIGIN=http://localhost:3000 MEET_OAUTH_TEST_BASE=http://localhost:4567 \
MEET_GOOGLE_CLIENT_ID=test-id MEET_GOOGLE_CLIENT_SECRET=test-secret MEET_MICROSOFT_CLIENT_ID=test-id MEET_MICROSOFT_CLIENT_SECRET=test-secret \
MEET_GITHUB_CLIENT_ID=test-id MEET_GITHUB_CLIENT_SECRET=test-secret MEET_FACEBOOK_APP_ID=test-id MEET_FACEBOOK_APP_SECRET=test-secret \
setsid nohup npx next start -p 3000 > /tmp/next-meet.log 2>&1 &
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:3000/meet/x && break; sleep 0.5; done
python3 tests/meet/app.py || R=1
pkill -f mock-oauth.mjs
pkill -f livekit-server; pkill -f "next start"; pkill -f next-server; pkill -f mock-ai.mjs
exit $R
