ID=$(cat /tmp/fid); cd /home/claude/olexweb-factory
node worker/run.mjs --id $ID --step capture 2>&1 | tail -3
