#!/bin/sh
for h in paletteforge freemovies clicky down masonry shotcut squoosh tldraw invented feeds gradientlab fontpair; do grep -q " $h.test$" /etc/hosts || echo "127.0.0.1 $h.test" >> /etc/hosts; done  # hosts-setup
# usage: ./frun.sh <phase script> [args]   starts Postgres, the stand-ins and the admin, runs the phase, stops everything
true
. /home/claude/yt-test/fenv.sh
cd /home/claude/yt-test
node mock-google.mjs > /tmp/mock.log 2>&1 &
[ -f /tmp/s3.pid ] || true
node mock-s3.mjs > /tmp/s3.log 2>&1 &
cd /home/claude/Olexweb && npx next start -p 3000 > /tmp/nextf.log 2>&1 &
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:3000/admin/login && break; sleep 1; done
psql postgres://olex:olex@localhost/olexweb -qc "update yt_settings set long_style = 'day', explain_style = false, plan_on = false"; psql postgres://olex:olex@localhost/olexweb -qc "update meta_settings set story_on = false" 2>/dev/null   # Install 23: the older phases test the story Shorts; fEXPLAIN turns the explainers on   # Install 22: the older phases test the old long videos; fTALE switches to real stories
cd /home/claude/yt-test && sh "$@"; R=$?
pkill -f "next-serve[r]"; pkill -f "mock-googl[e]"; pkill -f "mock-s[3]"
echo "admin errors:"; grep -iE "error|failed" /tmp/nextf.log | grep -v "token exchange" | head -5
exit $R
