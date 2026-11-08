# Shared helpers for the meeting tests (copied from e2e.py)
# Meetings, end to end: a real local LiveKit server (livekit-server --dev), the built site (next start) and two real
# Chrome browsers with fake cameras and microphones. Run with run.sh (it starts and stops everything).
import json, base64, os, subprocess, sys, time, urllib.request

APP = 'http://localhost:3000'
DB = 'postgres://olex:olex@localhost/olexweb'
SHOTS = os.environ.get('SHOTS', '/tmp/meet-shots')
os.makedirs(SHOTS, exist_ok=True)
passed = failed = 0
def check(ok, what, extra=''):
    global passed, failed
    if ok: passed += 1; print('  ✓ ' + what)
    else: failed += 1; print('  ✗ ' + what + ('  → ' + str(extra)[:300] if extra else ''))

def session(email):
    js = ("const pg=require('pg'),c=require('crypto');(async()=>{const d=new pg.Client({connectionString:'%s'});await d.connect();"
          "const u=(await d.query('select id from admin_users where email=$1',[process.argv[1]])).rows[0];const t=c.randomBytes(32).toString('base64url');"
          "await d.query(\"insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')\",[c.createHash('sha256').update(t).digest('hex'),u.id]);"
          "console.log(t);await d.end()})()") % DB
    return subprocess.check_output(['node', '-e', js, email], cwd='/home/claude/olexweb').decode().strip()
def req(path, body=None, token=None, origin=True, method=None):
    h = {'Content-Type': 'application/json'}
    if origin: h['Origin'] = APP
    if token: h['Cookie'] = '__Host-olex_sess=' + token
    r = urllib.request.Request(APP + path, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method or ('POST' if body is not None else 'GET'))
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.loads(x.read() or b'{}')
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
def grants(tok):
    p = tok.split('.')[1]; p += '=' * (-len(p) % 4); return json.loads(base64.urlsafe_b64decode(p))
def probe(path):
    out = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path]))
    return {'dur': float(out['format'].get('duration') or 0), 'kinds': sorted(x['codec_type'] for x in out['streams']),
            'video': next(((x['codec_name'], x.get('width'), x.get('height')) for x in out['streams'] if x['codec_type'] == 'video'), None)}
def green_share(path):   # how much of a frame shows the (green) fake camera: proves the video isn't blank
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-sseof', '-2', '-i', path, '-frames:v', '1', '/tmp/frame.png'], check=True)
    im = Image.open('/tmp/frame.png').convert('RGB').resize((160, 90)); px = list(im.getdata())
    return sum(1 for r, g, b in px if g > 100 and g > r + 40 and g > b + 40) / len(px)
def sql(q): return subprocess.check_output(['psql', DB, '-qtAc', q]).decode().strip()

def done():
    print(f'passed: {passed}  failed: {failed}'); sys.exit(1 if failed else 0)
