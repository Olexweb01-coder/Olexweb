. /home/claude/yt-test/fenv.sh
OWNER=$(cat /tmp/ftok)
LOC=$(curl -s -o /dev/null -D - -H "cookie: __Host-olex_sess=$OWNER" http://localhost:3000/admin/api/youtube/connect | grep -i '^location' | tr -d '\r' | cut -d' ' -f2)
STATE=$(echo "$LOC" | sed -E 's/.*[?&]state=([^&]*).*/\1/'); BACK=$(curl -s -o /dev/null -D - "$LOC" | grep -i '^location' | tr -d '\r' | cut -d' ' -f2)
echo "YouTube: $(curl -s -H "cookie: olex_yt_state=$STATE" "$BACK" | grep -o 'yt=[a-z_]*' | head -1)"
(cd /home/claude/olexweb-factory && node worker/run.mjs --id $(cat /tmp/fid) --step upload 2>&1 | grep -E "upload:|FAILED")
node fG3.mjs
