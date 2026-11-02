# Meetings, end to end: a real local LiveKit server (livekit-server --dev), the built site (next start) and two real
# Chrome browsers with fake cameras and microphones. Run with run.sh (it starts and stops everything).
import json, base64, os, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright

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
def sql(q): return subprocess.check_output(['psql', DB, '-qtAc', q]).decode().strip()

OWNER, EDITOR = session('owner@test.local'), session('editor@test.local')

print('API and security')
s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'Weekly check-in', 'speakers': 'everyone'})
check(s == 401, 'creating needs a session (401)', s)
s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'x'}, EDITOR)
check(s == 403, 'an editor can’t create meetings (403)', s)
s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'x'}, OWNER, origin=False)
check(s == 403, 'requests from other sites are refused', s)
s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'Weekly <b>check-in</b>', 'speakers': 'everyone'}, OWNER)
CODE = j.get('code', ''); check(s == 200 and len(CODE) == 12 and CODE[3] == '-' and CODE[8] == '-', 'owner creates a meeting with a readable code', j)
check(sql(f"select title from meetings where code='{CODE}'") == 'Weekly check-in', 'tags are stripped from the name', sql(f"select title from meetings where code='{CODE}'"))
s, j = req('/admin/api/meetings', {'action': 'create', 'speakers': 'nobody'}, OWNER)
check(s == 400, 'an unknown “who can speak” is refused', j)
s, j = req('/api/meet?code=' + CODE)
check(s == 200 and j.get('state') == 'waiting', 'before the host starts, the meeting is waiting', j)
s, j = req('/api/meet', {'code': CODE, 'name': 'Ada'})
check(s == 200 and j.get('state') == 'waiting' and 'token' not in j, 'a guest gets no token before the host starts', j)
s, j = req('/api/meet', {'code': CODE, 'name': 'Ada'}, origin=False)
check(s == 403, 'joining from another site is refused', s)
s, j = req('/api/meet', {'code': 'aaa-aaaa-aaa', 'name': 'Ada'})
check(s == 404, 'an unknown code is a 404', s)
try: urllib.request.urlopen(APP + '/meet/not-a-code'); bad = 200
except urllib.error.HTTPError as e: bad = e.code
check(bad == 404, 'a malformed meeting address shows Not found', bad)
s, j = req('/admin/api/meetings', {'action': 'remove', 'code': CODE, 'identity': 'h_abcdef0123'}, OWNER)
check(s == 400, 'the host can’t be removed or demoted', j)
s, j = req('/admin/api/meetings', {'action': 'delete', 'code': CODE}, OWNER)
check(s == 400, 'an open meeting can’t be deleted before it ends', j)
s, j = req('/admin/api/pages', {'action': 'slug-check', 'slug': 'meet'}, OWNER)
check(s == 200 and j.get('ok') is False, 'Pages & links says the meet address is taken', j)
s, j = req('/admin/api/pages', {'action': 'link-save', 'slug': 'meet', 'url': 'https://example.com'}, OWNER)
check(s == 400 and sql("select count(*) from site_links where slug = 'meet'") == '0', 'a short link can’t take the meet address', j)

print('In the browser')
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
    host = b.new_context(viewport={'width': 1366, 'height': 820}, permissions=['camera', 'microphone'])
    host.add_cookies([{'name': '__Host-olex_sess', 'value': OWNER, 'domain': 'localhost', 'path': '/', 'secure': True, 'httpOnly': True, 'sameSite': 'Strict'}])
    guest = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, permissions=['camera', 'microphone'])
    G, H = guest.new_page(), host.new_page()
    errs = []
    for p, n in ((G, 'guest'), (H, 'host')): p.on('pageerror', lambda e, n=n: errs.append(n + ': ' + str(e)))

    G.goto(APP + '/meet/' + CODE)
    check(G.locator('h1').inner_text().startswith('Weekly'), 'the guest sees the meeting name in the lobby')
    G.screenshot(path=SHOTS + '/1-guest-lobby-phone.png')
    G.fill('#mt-name', 'Ada Lovelace'); G.click('button[type=submit]')
    G.wait_for_selector('.mt-wait', timeout=8000)
    check(True, 'before the host starts, the guest waits')
    G.screenshot(path=SHOTS + '/2-guest-waiting-phone.png')

    H.goto(APP + '/meet/' + CODE)
    check(H.input_value('#mt-name') == 'Olaitan', 'the host’s name is filled in')
    check('Start the meeting' in H.locator('button[type=submit]').inner_text(), 'the host’s button says Start the meeting')
    H.click('button[aria-pressed]:has-text("Camera off")'); H.wait_for_timeout(1200)
    H.screenshot(path=SHOTS + '/3-host-lobby-desktop.png')
    H.click('button[type=submit]'); H.wait_for_selector('.mt-bar', timeout=15000)
    check(True, 'the host is in the room')
    check(sql(f"select started_at is not null from meetings where code='{CODE}'") == 't', 'starting sets the meeting as started')

    G.wait_for_selector('.mt-bar', timeout=15000)
    check(True, 'the waiting guest goes in by themselves once the host starts')
    H.wait_for_function("document.querySelectorAll('.mt-grid .mt-tile:not(.mt-more)').length === 2", timeout=10000)
    G.wait_for_function("document.querySelectorAll('.mt-grid .mt-tile:not(.mt-more)').length === 2", timeout=10000)
    check(True, 'both see 2 people on stage (everyone can speak)')
    check(G.locator('.mt-c:has-text("Mute"), .mt-c:has-text("Unmute")').count() == 1, 'the guest has a mic button')
    ok = G.wait_for_function("[...document.querySelectorAll('.mt-tile video')].some(v => v.videoWidth > 0 && !v.paused)", timeout=15000)
    check(bool(ok), 'the guest receives the host’s camera video')
    lvl = G.wait_for_function("[...document.querySelectorAll('.mt-tile')].some(t => parseFloat(t.style.getPropertyValue('--lvl') || 0) > 0)", timeout=15000)
    check(bool(lvl), 'the voice ring moves with the guest’s fake microphone level')
    aud = H.wait_for_function("document.querySelectorAll('audio').length >= 1", timeout=10000)
    check(bool(aud), 'the host plays the guest’s audio')
    w = G.evaluate("[...document.querySelectorAll('.mt-tile video')].map(v => v.videoHeight)")
    check(w and max(w) <= 360, 'video never exceeds 360p on a phone tile', w)

    # chat both ways
    G.click('.mt-c:has-text("Chat")'); G.fill('.mt-send textarea', 'Hello from Ada'); G.keyboard.press('Enter')
    H.wait_for_selector('.mt-badge', timeout=8000); check(H.locator('.mt-c:has-text("Chat") .mt-badge').inner_text() == '1', 'the host sees 1 unread message')
    H.click('.mt-c:has-text("Chat")'); H.wait_for_selector('.mt-msg:has-text("Hello from Ada")', timeout=5000)
    check(H.locator('.mt-msg b').first.inner_text() == 'Ada Lovelace', 'the message shows who sent it')
    H.fill('.mt-send textarea', 'Welcome, Ada <script>alert(1)</script>'); H.keyboard.press('Enter')
    G.wait_for_selector('.mt-msg:has-text("Welcome, Ada")', timeout=8000)
    check(G.locator('.mt-msg script').count() == 0 and '<script>' in G.locator('.mt-msg:has-text("Welcome")').inner_text(), 'chat text is shown as text, never as code')
    G.screenshot(path=SHOTS + '/4-guest-chat-phone.png')
    G.click('.mt-x')

    # raise hand
    G.click('.mt-c:has-text("Raise hand")')
    H.wait_for_selector('.mt-toast:has-text("raised a hand")', timeout=8000); check(True, 'the host is told when a hand goes up')
    H.wait_for_selector('.mt-tile .mt-hand', timeout=5000); check(True, 'the hand shows on the guest’s tile')
    H.click('.mt-c:has-text("People")'); H.wait_for_selector('.mt-people li:has-text("hand raised")', timeout=5000)
    check(H.locator('.mt-people li').first.inner_text().startswith('AL') or 'Ada' in H.locator('.mt-people li').first.inner_text(), 'raised hands go to the top of People')
    H.screenshot(path=SHOTS + '/5-host-room-desktop.png')
    G.click('.mt-c:has-text("Lower hand")'); H.wait_for_function("!document.querySelector('.mt-tile .mt-hand')", timeout=5000); check(True, 'lowering the hand clears it')

    # data saver: the guest stops receiving the host's camera
    G.click('.mt-c:has-text("Data saver")')
    G.wait_for_function("![...document.querySelectorAll('.mt-tile video')].some(v => v.videoWidth > 0)", timeout=10000)
    check(True, 'Data saver stops other people’s camera video')
    check(G.locator('.mt-c:has-text("Start video")').count() == 1, 'the guest’s own camera stays off with Data saver')
    G.click('.mt-c:has-text("Data saver")')
    G.wait_for_function("[...document.querySelectorAll('.mt-tile video')].some(v => v.videoWidth > 0)", timeout=15000)
    check(True, 'turning Data saver off brings video back')
    G.screenshot(path=SHOTS + '/6-guest-room-phone.png')
    H.click('.mt-x'); H.wait_for_timeout(800); H.screenshot(path=SHOTS + '/5b-host-room-wide.png')
    w = H.evaluate("[...document.querySelectorAll('.mt-grid .mt-tile')].map(t => (t.getBoundingClientRect().width / t.getBoundingClientRect().height).toFixed(2))")
    check(all(abs(float(x) - 16/9) < 0.05 for x in w), 'on a wide screen tiles keep a 16:9 shape', w)
    H.click('.mt-c:has-text("People")')
    bar = G.evaluate("(() => { const b = document.querySelector('.mt-bar'); return [b.scrollWidth <= b.clientWidth + 1, [...b.querySelectorAll('.mt-c')].every(c => { const r = c.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth }) ] })()")
    check(bar[0] and bar[1], 'on a phone every control fits on screen without scrolling', bar)

    # the guest can't use host controls
    s, j = req('/admin/api/meetings', {'action': 'end', 'code': CODE})
    check(s == 401, 'a guest can’t end the meeting through the API', s)

    # host removes the guest
    H.on('dialog', lambda d: d.accept())
    H.click('.mt-people li:has-text("Ada") button:has-text("Remove")')
    G.wait_for_selector('h1:has-text("removed")', timeout=10000); check(True, 'a removed guest is told so')
    H.wait_for_function("document.querySelectorAll('.mt-grid .mt-tile:not(.mt-more)').length === 1", timeout=10000); check(True, 'the host sees the guest gone')

    # a second meeting: only people the host lets speak
    s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'Class: Anatomy of Creation', 'speakers': 'invited'}, OWNER); CODE2 = j['code']
    H2 = host.new_page(); H2.goto(APP + '/meet/' + CODE2); H2.click('button[type=submit]'); H2.wait_for_selector('.mt-bar', timeout=15000)
    s, j = req('/api/meet', {'code': CODE2, 'name': 'Listener One'})
    check(j.get('state') == 'ready' and grants(j['token'])['video'].get('canPublish') is False, 'in a listen-only meeting a guest’s token can’t publish', j.get('state'))
    check(grants(j['token'])['sub'].startswith('g_'), 'guest identities start with g_ (only the server makes h_)')
    G2 = guest.new_page(); G2.goto(APP + '/meet/' + CODE2)
    check('listener' in G2.locator('.mt-p').inner_text(), 'the lobby tells the guest they’ll listen first')
    G2.fill('#mt-name', 'Bola'); G2.click('button[type=submit]'); G2.wait_for_selector('.mt-bar', timeout=15000)
    check(G2.locator('.mt-c:has-text("Mute"), .mt-c:has-text("Unmute")').count() == 0, 'a listener has no mic button')
    H2.wait_for_selector('.mt-more:has-text("1 listening")', timeout=10000); check(True, 'the host sees “1 listening”')
    H2.click('.mt-c:has-text("People")'); H2.click('.mt-people li:has-text("Bola") button:has-text("Let speak")')
    G2.wait_for_selector('.mt-toast:has-text("You can speak now")', timeout=10000); check(True, 'the guest is told they can speak')
    G2.wait_for_selector('.mt-c:has-text("Unmute"), .mt-c:has-text("Mute")', timeout=5000); check(True, 'the mic button appears for them')
    G2.click('.mt-c:has-text("Unmute")'); H2.wait_for_function("document.querySelectorAll('.mt-grid .mt-tile:not(.mt-more)').length === 2", timeout=10000)
    check(True, 'once speaking, they join the stage')
    H2.click('.mt-people li:has-text("Bola") button:has-text("Stop speaking")')
    G2.wait_for_selector('.mt-toast:has-text("ended your turn")', timeout=10000); check(True, 'stopping their turn tells them')
    G2.wait_for_function("!document.querySelector('.mt-c .mt-off, .mt-c:not(.mt-leave) svg') || ![...document.querySelectorAll('.mt-c span')].some(s => /Mute|Unmute/.test(s.textContent))", timeout=8000)
    check(True, 'their mic button goes away')

    # host ends for everyone
    H2.click('.mt-c.mt-leave'); H2.click('button:has-text("End for everyone")')
    G2.wait_for_selector('h1:has-text("ended")', timeout=10000); check(True, 'everyone sees the meeting has ended')
    H2.wait_for_selector('h1:has-text("ended")', timeout=10000); check(True, 'the host sees it ended too')
    s, j = req('/api/meet', {'code': CODE2, 'name': 'Late'}); check(j.get('state') == 'ended' and 'token' not in j, 'nobody can join an ended meeting', j)

    # opened from WhatsApp: the page load arrives without the (Strict) sign-in cookie; the page must still find the host
    s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'From WhatsApp', 'speakers': 'everyone'}, OWNER); CODE3 = j['code']
    W = host.new_page()
    def strip(route):
        if route.request.resource_type == 'document':
            h = {k: v for k, v in route.request.headers.items() if k.lower() != 'cookie'}; route.continue_(headers=h)
        else: route.continue_()
    W.route('**/meet/**', strip)
    W.goto(APP + '/meet/' + CODE3)
    W.wait_for_selector('button[type=submit]:has-text("Start the meeting")', timeout=8000)
    check(True, 'opened without the cookie, the page still recognises the host')
    check(W.input_value('#mt-name') == 'Olaitan', 'and fills in the host’s name')
    W.click('button[type=submit]'); W.wait_for_selector('.mt-bar', timeout=15000)
    check(W.locator('.mt-c:has-text("Raise hand")').count() == 0 and W.locator('.mt-name em:has-text("Host")').count() == 1, 'and they join as the host')
    W.close()
    s, j = req('/api/meet?code=' + CODE3)
    check(j.get('host') is False and j.get('hostName') == '', 'a guest asking about the meeting isn’t told the host’s name', j)

    # the admin page
    A = host.new_page(); A.goto(APP + '/admin/meetings')
    check(A.locator('h1').inner_text() == 'Meetings', 'Admin → Meetings opens')
    check(A.locator('.side-nav a:has-text("Meetings")').count() == 1, 'Meetings is in the sidebar')
    check(A.locator('.mg-list li:has-text("Weekly")').count() == 1 and A.locator('.mg-list li:has-text("From WhatsApp")').count() == 1 and A.locator('.mg-ended li:has-text("Class")').count() == 1, 'open and ended meetings are listed')
    A.screenshot(path=SHOTS + '/7-admin-meetings.png', full_page=True)
    check(not errs, 'no page errors in either browser', errs)
    b.close()

print(f'\n{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
