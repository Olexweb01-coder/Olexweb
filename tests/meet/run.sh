# Meetings test runner: Postgres, a local LiveKit server, the built site, then e2e.py. Stops everything afterwards.
cd /home/claude/olexweb
service postgresql start >/dev/null 2>&1; sleep 1
psql postgres://olex:olex@localhost/olexweb -qc "delete from meetings"   # each run starts clean
export DATABASE_URL=postgres://olex:olex@localhost/olexweb DATABASE_URL_POOLED=postgres://olex:olex@localhost/olexweb
export AUTH_SECRET=test-secret-that-is-long-enough-0123456789abcdef
export LIVEKIT_URL=ws://localhost:7880 LIVEKIT_API_KEY=devkey LIVEKIT_API_SECRET=secret
pkill -f livekit-server; pkill -f "next start"; pkill -f next-server; sleep 1
setsid nohup livekit-server --dev --bind 127.0.0.1 > /tmp/lk.log 2>&1 &
setsid nohup npx next start -p 3000 > /tmp/next.log 2>&1 &
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:3000/meet/x && curl -s -o /dev/null http://localhost:7880 && break; sleep 0.5; done
python3 tests/meet/e2e.py; R=$?
pkill -f livekit-server; pkill -f "next start"; pkill -f next-server
exit $R
