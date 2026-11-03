# phaseAU + the Library (fLIB.mjs). fD.mjs is skipped: it calls the upload action that was removed when uploads moved to the queue.
. /home/claude/yt-test/fenv.sh
SESS='const pg=require("pg"),c=require("crypto");(async()=>{const d=new pg.Client({connectionString:"postgres://olex:olex@localhost/olexweb"});await d.connect();const u=(await d.query("select id from admin_users where email=$1",[process.argv[1]])).rows[0];const t=c.randomBytes(32).toString("base64url");await d.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '"'"'1 day'"'"')",[c.createHash("sha256").update(t).digest("hex"),u.id]);console.log(t);await d.end()})()'
OWNER=$(node -e "$SESS" owner@test.local); echo "$OWNER" > /tmp/ftok; EDITOR=$(node -e "$SESS" editor@test.local)
LOC=$(curl -s -o /dev/null -D - -H "cookie: __Host-olex_sess=$OWNER" http://localhost:3000/admin/api/youtube/connect | grep -i '^location' | tr -d '\r' | cut -d' ' -f2)
STATE=$(echo "$LOC" | sed -E 's/.*[?&]state=([^&]*).*/\1/'); BACK=$(curl -s -o /dev/null -D - "$LOC" | grep -i '^location' | tr -d '\r' | cut -d' ' -f2)
echo "YouTube: $(curl -s -H "cookie: olex_yt_state=$STATE" "$BACK" | grep -o 'yt=[a-z_]*' | head -1)"
psql postgres://olex:olex@localhost/olexweb -qc "update yt_scripts set status = 'failed' where status in ('rendering', 'rendered', 'approved')"   # a clean start: no leftovers from earlier runs
node fA.mjs > /tmp/fa.log || { cat /tmp/fa.log; exit 1; }
OWNER=$(cat /tmp/ftok); ID=$(cat /tmp/fid); H="cookie: __Host-olex_sess=$OWNER"
(cd /home/claude/olexweb-factory && node worker/run.mjs --id $ID --step job,upload 2>&1 | tail -1)
send() { curl -s -X POST -H "$H" -H "Origin: http://localhost:3000" -H "Content-Type: application/json" -d "{\"action\":\"send-to-factory\",\"id\":$1}" http://localhost:3000/admin/api/youtube > /dev/null; cd /home/claude/olexweb-factory && node worker/run.mjs --id $1 --step job,upload 2>&1 | tail -1; cd /home/claude/yt-test; }
node fYT0.mjs
psql postgres://olex:olex@localhost/olexweb -qc "insert into dir_entries (slug, idea_id, name, url, status, content, quality, published_at) select 'guide-' || id, id, name, url, 'live', '{}', '{\"ok\":true}', now() from yt_ideas where key like 'Queue%' or key = 'paletteforge.test' on conflict do nothing"
echo "(fD.mjs skipped: it still uses the old upload action, removed when uploads moved to the queue)"
ID2=$(psql postgres://olex:olex@localhost/olexweb -qtAc "insert into yt_scripts (idea_id, status, script, package, approved_at) select (select id from yt_ideas where name ilike 'tldraw%' limit 1), 'approved', script, package, now() from yt_scripts where id=$ID on conflict (idea_id) do update set status='approved', part=null, upload=null, yt_video_id=null returning id")
echo "$ID2" > /tmp/fid2
psql postgres://olex:olex@localhost/olexweb -qc "insert into dir_entries (slug, idea_id, name, url, status, content, quality, published_at) select 'guide-' || i.id, i.id, i.name, i.url, 'live', '{}', '{\"ok\":true}', now() from yt_ideas i join yt_scripts s on s.idea_id=i.id where s.id=$ID2 on conflict do nothing"
send $ID2
node fFB0.mjs
node fD2.mjs private
send $ID2
node fD2.mjs scheduled
node fQ.mjs
node fYT.mjs
psql postgres://olex:olex@localhost/olexweb -qc "update dir_entries set status = 'live', published_at = now() where idea_id in (select idea_id from yt_scripts where fb->>'status' = 'pending'); insert into dir_entries (slug, idea_id, name, url, status, content, quality, published_at) select 'guide-' || i.id, i.id, i.name, i.url, 'live', '{}', '{\"ok\":true}', now() from yt_ideas i where i.id in (select idea_id from yt_scripts where fb->>'status' = 'pending') and not exists (select 1 from dir_entries d where d.idea_id = i.id)"   # every test video's site has a live guide
node fFB.mjs
node fAU.mjs
node fT.mjs
node fLIB.mjs
