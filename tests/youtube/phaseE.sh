. /home/claude/yt-test/fenv.sh
export FACTORY_RETRY_SCALE=0.01
SESS='const pg=require("pg"),c=require("crypto");(async()=>{const d=new pg.Client({connectionString:"postgres://olex:olex@localhost/olexweb"});await d.connect();const u=(await d.query("select id from admin_users where email=$1",[process.argv[1]])).rows[0];const t=c.randomBytes(32).toString("base64url");await d.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '"'"'1 day'"'"')",[c.createHash("sha256").update(t).digest("hex"),u.id]);console.log(t);await d.end()})()'
OWNER=$(node -e "$SESS" owner@test.local)
LOC=$(curl -s -o /dev/null -D - -H "cookie: __Host-olex_sess=$OWNER" http://localhost:3000/admin/api/youtube/connect | grep -i '^location' | tr -d '\r' | cut -d' ' -f2)
STATE=$(echo "$LOC" | sed -E 's/.*[?&]state=([^&]*).*/\1/'); BACK=$(curl -s -o /dev/null -D - "$LOC" | grep -i '^location' | tr -d '\r' | cut -d' ' -f2)
echo "YouTube: $(curl -s -H "cookie: olex_yt_state=$STATE" "$BACK" | grep -o 'yt=[a-z_]*' | head -1)"
worker() { (cd /home/claude/olexweb-factory && node worker/run.mjs --id $(cat /tmp/fid) --step job,upload 2>&1 | grep -E "upload:|FAILED|trying again" | head -4); }
node fA.mjs > /tmp/fa.log || { cat /tmp/fa.log; exit 1; }
curl -s "http://localhost:4560/_set?rejectPut=403" > /dev/null; worker; curl -s "http://localhost:4560/_set?rejectPut=0" > /dev/null
node fE.mjs refused || exit 1
node fA.mjs > /tmp/fa.log || { cat /tmp/fa.log; exit 1; }
curl -s "http://localhost:4560/_set?failNext=2" > /dev/null; worker
node fE.mjs hiccup || exit 1
node fA.mjs > /tmp/fa.log || { cat /tmp/fa.log; exit 1; }
curl -s "http://localhost:4560/_set?rejectPut=403" > /dev/null; psql postgres://olex:olex@localhost/olexweb -qc "alter table yt_pieces rename to yt_pieces_hidden"
worker
psql postgres://olex:olex@localhost/olexweb -qc "alter table yt_pieces_hidden rename to yt_pieces"; curl -s "http://localhost:4560/_set?rejectPut=0" > /dev/null
node fE.mjs broken
