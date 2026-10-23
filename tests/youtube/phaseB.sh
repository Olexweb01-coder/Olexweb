ID=$(cat /tmp/fid); cd /home/claude/olexweb-factory
node worker/run.mjs --id $ID --step voice 2>&1 | tail -1
node worker/run.mjs --id $ID --step render 2>&1 | grep -vE "^\s*$" | tail -6
ls -la out/video.mp4 | awk '{print "   video:", $5, "bytes"}'
cd /home/claude/yt-test && node -e "
const pg=require('pg');(async()=>{const d=new pg.Client({connectionString:'postgres://olex:olex@localhost/olexweb'});await d.connect();
const s=(await d.query(\"select state from yt_jobs where kind='render'\")).rows[0].state;
console.log('   admin sees: stage', s.stage, '·', s.done, 'of', s.total, '·', s.note);
console.log('   stages:', s.stages.map(x=>x.key+(x.secs!=null?' '+x.secs+'s':'')).join(', '));await d.end()})()"
