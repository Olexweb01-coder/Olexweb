# Install 3: the usage meter (minutes from LiveKit's signed webhooks), the 80% / 95% protections and "Meet is full",
# pausing a recording, the AI note taker in the Meet app (free first hour), the admin's tabs, and database addresses
# tidied. Run by run.sh in the Meet-app stage (MEET_ORIGIN, LiveKit with webhooks, the AI stand-in on :4566).
import json, os, subprocess, sys, urllib.request, time
from playwright.sync_api import sync_playwright
exec(open('tests/meet/guests.py').read().split("FORM = {")[0])            # helpers: req, post, get, sql, tick, oauth, MEET, OWNER, ADMIN
def ai(path, body=None):
    r = urllib.request.Request('http://localhost:4566' + path, data=json.dumps(body).encode() if body is not None else None, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(r) as x: return json.loads(x.read())
def as_user(uid):
    import secrets, hashlib; t = secrets.token_urlsafe(32); sql(f"insert into meet_sessions (id_hash, user_id, expires_at) values ('{hashlib.sha256(t.encode()).hexdigest()}', {uid}, now() + interval '1 day')"); return t
def ai(path, body=None):
    r = urllib.request.Request('http://localhost:4566' + path, data=json.dumps(body).encode() if body is not None else None, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(r) as x: return json.loads(x.read())
def usage(): return req('/admin/api/meetings', {'action': 'usage'}, OWNER)[1]['usage']
def probe_dur(path): return float(json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-of', 'json', path]))['format'].get('duration') or 0)
sql("delete from meet_usage"); sql("update meet_settings set minutes_allowance = 5000, max_people = 100, warned = '{}'")
sql("insert into meet_users (email, email_verified, name) values ('host3@meettest.local', true, 'Host Three') on conflict do nothing")
H3 = sql("select id from meet_users where email = 'host3@meettest.local' order by id limit 1"); T3 = as_user(H3)
M3 = {'Cookie': '__Host-meet_sess=' + T3}
def mine(body):
    r = urllib.request.Request(APP + '/api/meet/mine', data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', 'Origin': MEET, 'Host': 'meet.localhost:3000', **M3})
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.loads(x.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')

print('Addresses tidied')
out = subprocess.check_output(['node', '-e', """const {tidyDbUrl}=require('./lib/admin/dburl.js'); const r=[];
for (const v of ['"postgresql://u:p@h1/db?sslmode=require"', "MEET_DATABASE_URL='postgresql://u:p@h2/db'", "psql 'postgresql://u:p@h3/db'", 'postgresql://u:p@h4/db\\nNEXT=x']) r.push(tidyDbUrl(v,'X').host)
try { tidyDbUrl('"http://x"','MEET_DATABASE_URL') } catch (e) { r.push(e.message) } console.log(JSON.stringify(r))"""]).decode()
r = json.loads(out)
check(r[:4] == ['h1', 'h2', 'h3', 'h4'], 'quotes, a name in front, Neon’s psql wrapper and a second line are removed', r)
check('MEET_DATABASE_URL isn’t a valid database address' in r[4], 'anything else names the exact setting: “' + r[4] + '”')

print('Counting minutes from LiveKit')
s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'Usage meeting'}, OWNER); C = j['code']
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
    errs = []
    host = b.new_context(viewport={'width': 1280, 'height': 860}, permissions=['camera', 'microphone'])
    host.add_cookies([{'name': '__Host-olex_sess', 'value': OWNER, 'domain': 'localhost', 'path': '/', 'secure': True, 'httpOnly': True, 'sameSite': 'Strict'}])
    H = host.new_page(); H.on('pageerror', lambda e: errs.append('host: ' + str(e)[:90])); H.goto(APP + '/meet/' + C)
    H.click('button[type=submit]'); H.wait_for_selector('#mt-rec-h', timeout=15000); H.click('button:has-text("Not now")')
    gc = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, permissions=['camera', 'microphone'])
    G = gc.new_page(); G.on('pageerror', lambda e: errs.append('guest: ' + str(e)[:90])); G.goto(f'{MEET}/{C}'); G.fill('#mt-name', 'Counter'); G.click('button[type=submit]'); G.wait_for_selector('.mt-bar', timeout=15000)
    H.wait_for_timeout(3000)
    check(sql(f"select count(*) from meet_usage where code = '{C}' and left_at is null") == '2', 'LiveKit’s signed events record both people as in the meeting')
    u = usage(); check(u['live'] == 2 and u['allowance'] == 5000 and u['maxPeople'] == 100, 'the meter shows 2 people in meetings now, against the free plan’s limits', u)
    G.click('.mt-c.mt-leave'); G.wait_for_selector('h1:has-text("left")', timeout=10000); H.wait_for_timeout(2500)
    check(sql(f"select count(*) from meet_usage where code = '{C}' and left_at is not null") == '1', 'when the guest leaves, their time stops counting')

    print('Pausing a recording')
    G.goto(f'{MEET}/{C}'); G.fill('#mt-name', 'Counter'); G.click('button[type=submit]'); G.wait_for_selector('.mt-bar', timeout=15000)
    H.click('.mt-c:has-text("Record")'); H.click('.mt-seg button:has-text("Audio only")'); H.click('.mt-rec-go'); H.wait_for_selector('.mt-c.mt-recording', timeout=8000)
    H.wait_for_timeout(3000); t0 = time.time()
    H.click('.mt-c:has-text("Pause")'); H.wait_for_selector('.mt-c:has-text("Resume")', timeout=5000)
    G.wait_for_selector('.mt-recbadge:has-text("Recording paused")', timeout=8000); check(True, 'Pause: everyone sees “Recording paused”')
    G.wait_for_selector('.mt-toast:has-text("paused the recording")', timeout=8000); check(True, 'and the guest is told')
    shown = H.locator('.mt-c.mt-recording span').inner_text(); H.wait_for_timeout(5000)
    check(H.locator('.mt-c.mt-recording span').inner_text() == shown and 'paused' in shown, 'the timer stops while paused: “' + shown + '”')
    H.click('.mt-c:has-text("Resume")'); paused_for = time.time() - t0
    G.wait_for_selector('.mt-recbadge:not(.mt-paused):has-text("Recording")', timeout=8000); check(True, 'Resume: back to “Recording” for everyone')
    H.wait_for_timeout(3000)
    with H.expect_download(timeout=30000) as d: H.click('.mt-c.mt-recording')
    f = '/tmp/paused.webm'; d.value.save_as(f); dur = probe_dur(f)
    check(5 <= dur <= 9, f'the file holds only the recorded parts: {dur:.1f} s of about 6, not {6 + paused_for:.0f} (the paused {paused_for:.0f} s are left out)', dur)

    print('The AI note taker in the Meet app')
    s, j = mine({'action': 'create', 'title': 'Notes on Meet'}); NC = j['code']
    nh = b.new_context(viewport={'width': 1280, 'height': 860}, permissions=['camera', 'microphone'])
    nh.add_cookies([{'name': '__Host-meet_sess', 'value': T3, 'domain': 'meet.localhost', 'path': '/', 'secure': True, 'httpOnly': True, 'sameSite': 'Lax'}])
    N = nh.new_page(); N.on('pageerror', lambda e: errs.append('meet host: ' + str(e)[:90])); N.add_init_script('window.__olexNotesPieceMs = 2500')
    N.goto(f'{MEET}/{NC}'); N.click('button[type=submit]'); N.wait_for_selector('#mt-rec-h', timeout=15000); N.click('button:has-text("Not now")')
    G2 = gc.new_page(); G2.goto(f'{MEET}/{NC}'); G2.fill('#mt-name', 'Listener'); G2.click('button[type=submit]'); G2.wait_for_selector('.mt-bar', timeout=15000)
    N.click('.mt-c:has-text("AI notes")'); N.wait_for_selector('.mt-c:has-text("Stop notes")', timeout=8000)
    G2.wait_for_selector('.mt-notesbadge', timeout=8000); check(True, 'a Meet host (not you) turns on AI notes, without recording; everyone sees “AI notes”')
    N.wait_for_timeout(8000)
    if not N.locator('.mt-c:has-text("Stop notes")').count():                # if this ever fails, show what was on screen instead
        N.screenshot(path='/tmp/notes-missing.png'); print('    (screen:', N.locator('.mt-bar .mt-c span').all_inner_texts(), N.locator('h1').all_inner_texts(), N.locator('.mt-toast').all_inner_texts(), ')')
    N.click('.mt-c:has-text("Stop notes")')
    N.wait_for_selector('.mt-banner button:has-text("Make AI notes")', timeout=10000); check(True, 'stopping offers “Make AI notes” right in the meeting')
    ai('/control', {'reset': True, 'failNth': []})
    N.click('.mt-banner button:has-text("Make AI notes")'); N.wait_for_selector('.ga-notes .ga-sum', timeout=60000)
    check(N.locator('.ga-notes .ga-sum').inner_text().startswith('Planning the website launch'), 'the notes appear in the Meet app (no trip to the admin)')
    pieces = int(sql(f"select notes_pieces from meetings where code = '{NC}'")); check(2 <= pieces <= 12, f'each piece counts toward the free hour ({pieces} used)')
    N.screenshot(path=SHOTS + '/21-notes-in-meet.png')
    N.click('.ga-notes .ga-x'); N.wait_for_selector('.ga-notes', state='detached', timeout=5000)
    sql(f"update meetings set notes_pieces = 12 where code = '{NC}'")
    BD = 'olexTestBoundary7MA4YWxkTrZu0gW'; audio = open('/tmp/paused.webm', 'rb').read()                  # a real recording piece
    body = (f'--{BD}\r\nContent-Disposition: form-data; name="code"\r\n\r\n{NC}\r\n--{BD}\r\nContent-Disposition: form-data; name="audio"; filename="p.webm"\r\nContent-Type: audio/webm\r\n\r\n').encode() + audio + f'\r\n--{BD}--\r\n'.encode()
    r = urllib.request.Request(APP + '/api/meet/notes', data=body, headers={'Content-Type': 'multipart/form-data; boundary=' + BD, 'Origin': MEET, 'Host': 'meet.localhost:3000', **M3})
    try: urllib.request.urlopen(r); st, msg = 200, ''
    except urllib.error.HTTPError as e: st, msg = e.code, json.loads(e.read()).get('error', '')
    check(st == 402 and 'first 60 minutes' in msg, 'after the free hour: “' + msg + '”')
    st, j = post('/api/meet/notes', {'action': 'notes', 'code': NC, 'transcript': 'x' * 50}, origin=APP); check(st == 403, 'nobody but the host can make or read the notes')
    N.click('.mt-c.mt-leave'); N.click('button:has-text("End for everyone")'); N.wait_for_selector('h1:has-text("ended")', timeout=10000)
    NH = nh.new_page(); NH.goto(MEET + '/'); NH.wait_for_selector(f'.mh-past li:has-text("Notes on Meet") button:has-text("Notes")', timeout=8000)
    NH.click(f'.mh-past li:has-text("Notes on Meet") button:has-text("Notes")'); NH.wait_for_selector('.ga-notes .ga-sum', timeout=8000); check(True, 'the notes reopen later from Your meetings')

    print('The protections')
    req('/admin/api/meetings', {'action': 'limits', 'minutes': 100, 'people': 50}, OWNER)
    sql("insert into meet_usage (identity, code, joined_at, left_at) values ('g_fill000001', 'zzz-fill-aaa', now() - interval '81 minutes', now())")
    r1 = tick(); r2 = tick()
    check(r1.get('usageWarned') == ['warn'] and not r2.get('usageWarned'), 'at 81%: one warning to you (not repeated)', (r1.get('usageWarned'), r2.get('usageWarned')))
    check(usage()['level'] == 'warn', 'and the meter shows the warning level')
    st, j = mine({'action': 'create', 'title': 'Still fine'}); check(st == 200, 'at 81% other hosts can still make meetings')
    sql("insert into meet_usage (identity, code, joined_at, left_at) values ('g_fill000002', 'zzz-fill-aaa', now() - interval '16 minutes', now())")
    r3 = tick(); check(r3.get('usageWarned') == ['stop'], 'at 97%: the second warning goes out', r3.get('usageWarned'))
    st, j = mine({'action': 'create', 'title': 'Too late'}); check(st == 429 and 'paused until' in j.get('error', ''), 'other hosts can’t make new meetings: “' + j.get('error', '') + '”')
    s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'Mine still works'}, OWNER); check(s == 200, 'your meetings still work')
    s, j = post('/api/meet', {'code': C, 'name': 'Late guest'}, origin=APP); check(s == 200 and j.get('state') == 'ready', 'a meeting already going still lets people in (never cut off)')
    H.screenshot(path=SHOTS + '/22-pre-full.png')
    A = host.new_page(); A.goto(APP + '/admin/meetings#usage'); A.wait_for_selector('.mu', timeout=8000)
    check('other hosts can’t start new meetings' in A.locator('.mu').inner_text(), 'Admin → Meetings opens on the Usage tab from the warning’s link, and explains it')
    A.screenshot(path=SHOTS + '/23-usage-tab.png')
    check(A.locator('.mg-tabs button').all_inner_texts() == ['Meetings', 'Usage', 'Accounts and reports'], 'the admin page has tabs instead of one long scroll')
    A.click('.mg-tabs button:has-text("Accounts")'); A.wait_for_selector('.ma', timeout=8000); check(A.locator('.mg-new').count() == 0, 'Accounts and reports is its own tab')
    A.click('.mg-tabs button:has-text("Usage")'); A.click('.mu-change'); A.click('.mu-presets button:has-text("LiveKit $50 plan")'); A.click('button:has-text("Save limits")')
    A.wait_for_selector('.mu-stat:has-text("150,000")', timeout=8000); check(sql("select minutes_allowance || '/' || max_people from meet_settings") == '150000/1000', 'limits can be changed with a preset')
    sql("update meet_settings set max_people = 2"); sql("insert into meet_usage (identity, code) values ('g_live000001', 'zzz-full-aaa'), ('g_live000002', 'zzz-full-aaa')")
    s, j = post('/api/meet', {'code': C, 'name': 'One too many'}, origin=APP); check(s == 429 and 'full right now' in j.get('error', ''), 'when Meet is full, people are told plainly: “' + j.get('error', '') + '”')
    sql("delete from meet_usage where code like 'zzz-%'"); sql("update meet_settings set minutes_allowance = 5000, max_people = 100, warned = '{}'")
    check(not errs, 'no page errors', errs)
    b.close()
print(f'\n{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
