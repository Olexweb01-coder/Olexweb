#!/bin/sh
# usage: ./frun.sh <phase script> [args]   starts Postgres, the stand-ins and the admin, runs the phase, stops everything
service postgresql start >/dev/null 2>&1; sleep 1
. /home/claude/yt-test/fenv.sh
cd /home/claude/yt-test
node mock-google.mjs > /tmp/mock.log 2>&1 &
[ -f /tmp/s3.pid ] || true
node mock-s3.mjs > /tmp/s3.log 2>&1 &
cd /home/claude/Olexweb && npx next start -p 3000 > /tmp/nextf.log 2>&1 &
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:3000/admin/login && break; sleep 1; done
cd /home/claude/yt-test && sh "$@"; R=$?
pkill -f "next-serve[r]"; pkill -f "mock-googl[e]"; pkill -f "mock-s[3]"
echo "admin errors:"; grep -iE "error|failed" /tmp/nextf.log | grep -v "token exchange" | head -5
exit $R
