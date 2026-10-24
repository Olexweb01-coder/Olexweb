. /home/claude/yt-test/fenv.sh
cd /home/claude/olexweb-factory && node worker/run.mjs --id $(cat /tmp/fid) --step voice,music 2>&1 | grep -E "voice:|music:|FAILED|broken" | tail -3
python3 -c "
import json; t=json.load(open('src/timeline.json')); print('timeline:', t['kind'], 'vol', t['volume'], round(t['duration']), 's,', len(t['chapters']), 'chapters, clips', t['clipSeconds'])"
