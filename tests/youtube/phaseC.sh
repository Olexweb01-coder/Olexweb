ID=$(cat /tmp/fid); cd /home/claude/olexweb-factory
node worker/run.mjs --id $ID --step upload 2>&1 | tail -2
cd /home/claude/yt-test && node fC.mjs
