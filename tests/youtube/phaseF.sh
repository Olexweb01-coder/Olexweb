. /home/claude/yt-test/fenv.sh
node fA.mjs > /tmp/fa.log || { cat /tmp/fa.log; exit 1; }
curl -s "http://localhost:4560/_set?hang=1" > /dev/null
T0=$(date +%s)
(cd /home/claude/olexweb-factory && node worker/run.mjs --id $(cat /tmp/fid) --step job,upload 2>&1 | grep -E "upload:|FAILED|trying again" | head -4)
T1=$(date +%s)
curl -s "http://localhost:4560/_set?hang=0" > /dev/null
node fF.mjs $((T1-T0))
