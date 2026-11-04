# Meetings, end to end: a real local LiveKit server (livekit-server --dev), the built site (next start) and two real
# Chrome browsers with fake cameras and microphones. Run with run.sh (it starts and stops everything).
import json, base64, os, subprocess, sys, time, urllib.request
from PIL import Image
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
def probe(path):
    out = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path]))
    return {'dur': float(out['format'].get('duration') or 0), 'kinds': sorted(x['codec_type'] for x in out['streams']),
            'video': next(((x['codec_name'], x.get('width'), x.get('height')) for x in out['streams'] if x['codec_type'] == 'video'), None)}
def green_share(path):   # how much of a frame shows the (green) fake camera: proves the video isn't blank
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-sseof', '-2', '-i', path, '-frames:v', '1', '/tmp/frame.png'], check=True)
    im = Image.open('/tmp/frame.png').convert('RGB').resize((160, 90)); px = list(im.getdata())
    return sum(1 for r, g, b in px if g > 100 and g > r + 40 and g > b + 40) / len(px)
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
    H.wait_for_selector('#mt-rec-h', timeout=5000); check(H.locator('#mt-rec-h').inner_text() == 'Record this meeting?', 'the host is asked “Record this meeting?” on starting')
    H.click('button:has-text("Not now")'); check(H.locator('#mt-rec-h').count() == 0, '“Not now” closes it')
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
    posts = []
    G.on('request', lambda r: posts.append(r.url) if r.method == 'POST' and r.url.startswith(APP) else None)
    G.click('.mt-send button[aria-label="Emoji"]'); G.click('.mt-emoji button[aria-label="👍"]'); G.click('.mt-emoji button[aria-label="🎉"]')
    check(G.input_value('.mt-send textarea') == '👍🎉', 'the emoji picker puts emoji in the message')
    G.keyboard.press('Enter'); H.wait_for_selector('.mt-msg.mt-big:has-text("👍🎉")', timeout=8000)
    check(True, 'an emoji-only message shows big for the others')
    G.fill('.mt-send textarea', 'Great session'); G.click('.mt-send textarea'); G.keyboard.press('End')
    G.click('.mt-send button[aria-label="Emoji"]'); G.click('.mt-emoji button[aria-label="🔥"]')
    check(G.input_value('.mt-send textarea') == 'Great session🔥', 'emoji go where the cursor is')
    G.keyboard.press('Enter'); H.wait_for_selector('.mt-msg:not(.mt-big):has-text("Great session🔥")', timeout=8000)
    check(True, 'text with emoji stays a normal message')
    check(not posts, 'chat never goes to the Olexweb server (nothing is stored)', posts)
    G.screenshot(path=SHOTS + '/4-guest-chat-phone.png')
    G.click('.mt-x')
    G.click('.mt-c:has-text("React")'); G.click('.mt-reacts button[aria-label="Send 👏"]')
    H.wait_for_selector('.mt-float:has-text("👏"):has-text("Ada")', timeout=8000); check(True, 'a reaction floats up on the host’s screen with the sender’s name')
    check(G.locator('.mt-float:has-text("You")').count() >= 1, 'the sender sees their own reaction')
    rb = G.evaluate("(() => { const r = document.querySelector('.mt-reacts').getBoundingClientRect(); return [r.left >= 0, r.right <= innerWidth] })()")
    check(all(rb), 'the reaction tray fits on a phone screen', rb)
    G.screenshot(path=SHOTS + '/4b-guest-react-phone.png')
    G.keyboard.press('Escape'); check(G.locator('.mt-reacts').count() == 0, 'Escape closes the reaction tray')

    # raise hand
    G.click('.mt-c:has-text("Raise hand")')
    H.wait_for_selector('.mt-toast:has-text("raised a hand")', timeout=8000); check(True, 'the host is told when a hand goes up')
    H.wait_for_selector('.mt-tile .mt-hand', timeout=5000); check(True, 'the hand shows on the guest’s tile')
    H.click('.mt-c:has-text("People")'); H.wait_for_selector('.mt-people li:has-text("hand raised")', timeout=5000)
    check(H.locator('.mt-people li').first.inner_text().startswith('AL') or 'Ada' in H.locator('.mt-people li').first.inner_text(), 'raised hands go to the top of People')
    H.screenshot(path=SHOTS + '/5-host-room-desktop.png')
    G.click('.mt-c:has-text("Lower hand")'); H.wait_for_function("!document.querySelector('.mt-tile .mt-hand')", timeout=5000); check(True, 'lowering the hand clears it')

    # data saver: the guest stops receiving the host's camera
    check(G.locator('.mt-c:has-text("Data saver")').is_hidden(), 'on a phone, Data saver moves into More')
    G.click('.mt-c:has-text("More")'); G.click('.mt-menu button:has-text("Data saver")')
    G.wait_for_function("![...document.querySelectorAll('.mt-tile video')].some(v => v.videoWidth > 0)", timeout=10000)
    check(True, 'Data saver stops other people’s camera video')
    check(G.locator('.mt-c:has-text("Start video")').count() == 1, 'the guest’s own camera stays off with Data saver')
    G.click('.mt-c:has-text("More")'); G.click('.mt-menu button:has-text("Data saver")')
    G.wait_for_function("[...document.querySelectorAll('.mt-tile video')].some(v => v.videoWidth > 0)", timeout=15000)
    check(True, 'turning Data saver off brings video back')
    G.screenshot(path=SHOTS + '/6-guest-room-phone.png')

    # recording: video and audio
    H.click('.mt-c:has-text("React")'); H.wait_for_selector('.mt-reacts')
    vis = H.evaluate("(() => { const r = document.querySelector('.mt-reacts').getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(e && e.closest('.mt-reacts')) })()")
    check(vis, 'on a laptop the reaction tray shows above the bar, not cut off')
    H.click('.mt-reacts button[aria-label="Send 🎉"]'); G.wait_for_selector('.mt-float:has-text("🎉"):has-text("Olaitan")', timeout=8000); check(True, 'the guest sees the host’s reaction')
    H.keyboard.press('Escape')
    H.click('.mt-c:has-text("Record")'); H.wait_for_selector('#mt-rec-h')
    H.click('.mt-seg button:has-text("Video and audio")'); H.click('.mt-rec-go')
    H.wait_for_selector('.mt-c.mt-recording', timeout=8000); check(True, 'recording starts and the button shows a timer')
    G.wait_for_selector('.mt-recbadge', timeout=8000); check(True, 'the guest sees the red Recording badge')
    G.wait_for_selector('.mt-toast:has-text("started recording")', timeout=8000); check(True, 'the guest is told recording started')
    H.screenshot(path=SHOTS + '/8-host-recording.png'); G.screenshot(path=SHOTS + '/9-guest-sees-recording-phone.png')
    G2late = guest.new_page(); G2late.goto(APP + '/meet/' + CODE); G2late.fill('#mt-name', 'Late Comer'); G2late.click('button[type=submit]')
    G2late.wait_for_selector('.mt-toast:has-text("being recorded")', timeout=15000); check(True, 'someone joining late is told it’s being recorded')
    G2late.close()
    H.wait_for_timeout(6000)
    with H.expect_download(timeout=30000) as d: H.click('.mt-c.mt-recording')
    f = '/tmp/rec-video.' + d.value.suggested_filename.rsplit('.', 1)[-1]; d.value.save_as(f)
    check(d.value.suggested_filename.startswith('Weekly check-in 20') and d.value.suggested_filename.endswith('.webm'), 'the file is named after the meeting and date (WebM in Chrome)', d.value.suggested_filename)
    pr = probe(f)
    check(pr['kinds'] == ['audio', 'video'] and pr['video'][1:] == (1280, 720), 'the recording has 1280×720 video and an audio track', pr)
    check(pr['dur'] >= 5, 'the recording is as long as the meeting part recorded', pr['dur'])
    gs = green_share(f); check(gs > 0.15, 'the recorded picture shows the meeting (not a blank frame)', round(gs, 3))
    G.wait_for_function("!document.querySelector('.mt-recbadge')", timeout=8000); check(True, 'the badge goes away when recording stops')
    H.wait_for_selector('.mt-toast:has-text("saved to this device")', timeout=5000); check(True, 'the host is told where the file went')

    # recording: audio only
    H.click('.mt-c:has-text("Record")'); H.click('.mt-seg button:has-text("Audio only")'); H.click('.mt-rec-go')
    H.wait_for_selector('.mt-c.mt-recording', timeout=8000); H.wait_for_timeout(4000)
    with H.expect_download(timeout=30000) as d: H.click('.mt-c.mt-recording')
    f = '/tmp/rec-audio.' + d.value.suggested_filename.rsplit('.', 1)[-1]; d.value.save_as(f); pr = probe(f)
    check(pr['kinds'] == ['audio'] and pr['dur'] >= 3 and '(audio)' in d.value.suggested_filename, 'audio only gives a small audio file', (pr, d.value.suggested_filename))
    check(os.path.getsize(f) < 200_000, 'about 4 seconds of audio is under 200 KB', os.path.getsize(f))

    # a crash or closed tab while recording: nothing is lost
    H.click('.mt-c:has-text("Record")'); H.click('.mt-seg button:has-text("Video and audio")'); H.click('.mt-rec-go')
    H.wait_for_selector('.mt-c.mt-recording', timeout=8000); H.wait_for_timeout(5000)
    n = H.evaluate("""new Promise(ok => { const r = indexedDB.open('olexweb-meet-rec'); r.onsuccess = () => { const q = r.result.transaction('chunks').objectStore('chunks').count(); q.onsuccess = () => ok(q.result) } })""")
    check(n >= 2, 'while recording, pieces are saved every 2 seconds', n)
    H.reload(); H.wait_for_selector('.mt-pending', timeout=10000)
    check('wasn’t saved' in H.locator('.mt-pending').inner_text(), 'after closing mid-recording, the page offers the unsaved recording')
    H.screenshot(path=SHOTS + '/10-unsaved-recording.png')
    with H.expect_download(timeout=30000) as d: H.click('.mt-pending button:has-text("Save")')
    f = '/tmp/rec-crash.' + d.value.suggested_filename.rsplit('.', 1)[-1]; d.value.save_as(f); pr = probe(f)
    check(pr['kinds'] == ['audio', 'video'] and pr['dur'] >= 3, 'the rescued recording plays, with what was recorded before the crash', pr)
    check(H.locator('.mt-pending').count() == 0, 'once saved it’s cleared from the browser')
    G.wait_for_function("!document.querySelector('.mt-recbadge')", timeout=15000); check(True, 'when the host drops, the guest’s badge clears')
    H.click('button[type=submit]'); H.wait_for_selector('#mt-rec-h', timeout=15000); H.click('button:has-text("Not now")')
    H.wait_for_function("document.querySelectorAll('.mt-grid .mt-tile:not(.mt-more)').length === 2", timeout=15000); check(True, 'the host rejoins the same meeting')
    if H.locator('.mt-x').count(): H.click('.mt-x')
    H.wait_for_timeout(800); H.screenshot(path=SHOTS + '/5b-host-room-wide.png')
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
    H2.wait_for_selector('#mt-rec-h', timeout=5000); H2.click('button:has-text("Not now")')
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

    # host ends for everyone, while recording: the recording is saved first
    H2.click('.mt-c:has-text("Record")'); H2.click('.mt-seg button:has-text("Audio only")'); H2.click('.mt-rec-go'); H2.wait_for_selector('.mt-c.mt-recording', timeout=8000); H2.wait_for_timeout(3000)
    H2.click('.mt-c.mt-leave'); check('saved first' in H2.locator('.mt-dialog').inner_text(), 'the leave dialog says the recording is saved first')
    with H2.expect_download(timeout=30000) as d: H2.click('button:has-text("End for everyone")')
    check(d.value.suggested_filename.startswith('Class Anatomy of Creation'), 'ending the meeting saves the recording (colon removed from the file name)', d.value.suggested_filename)
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
    W.click('button[type=submit]'); W.wait_for_selector('.mt-bar', timeout=15000); W.click('button:has-text("Not now")')
    check(W.locator('.mt-c:has-text("Raise hand")').count() == 0 and W.locator('.mt-name em:has-text("Host")').count() == 1, 'and they join as the host')
    W.close()
    s, j = req('/api/meet?code=' + CODE3)
    check(j.get('host') is False and j.get('hostName') == '', 'a guest asking about the meeting isn’t told the host’s name', j)

    # AI notes from a recording
    def ai(path, body=None):
        r = urllib.request.Request('http://localhost:4566' + path, data=json.dumps(body).encode() if body is not None else None, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(r) as x: return json.loads(x.read())
    ai('/control', {'reset': True, 'failNth': [2, 3]})          # piece 2 fails twice (the retry too): the first attempt must stop with a clear message
    s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'Planning call', 'speakers': 'everyone'}, OWNER); CODE4 = j['code']
    N = host.new_page(); N.add_init_script('window.__olexNotesPieceMs = 3000')
    N.goto(APP + '/meet/' + CODE4); N.click('button[type=submit]'); N.wait_for_selector('#mt-rec-h', timeout=15000)
    N.click('.mt-seg button:has-text("Audio only")'); N.click('.mt-rec-go'); N.wait_for_selector('.mt-c.mt-recording', timeout=8000)
    N.wait_for_timeout(10500)
    with N.expect_download(timeout=30000) as d: N.click('.mt-c.mt-recording')
    N.wait_for_selector('.mt-banner:has-text("ready for AI notes")', timeout=8000); check(True, 'after recording, the host is offered AI notes')
    parts = N.evaluate("""new Promise(ok => { const r = indexedDB.open('olexweb-meet-rec'); r.onsuccess = () => { const q = r.result.transaction('notes').objectStore('notes').getAll(); q.onsuccess = () => ok(q.result.map(x => [x.code, x.part, x.blob.size, x.mime])) } })""")
    mine = [x for x in parts if x[0] == CODE4]
    check(len(mine) >= 3 and all(x[2] < 4 * 1024 * 1024 for x in mine), 'the notes audio is kept as separate pieces, each under 4 MB', mine)
    # since install 3: Make AI notes works right in the meeting (no new tab). A part that keeps failing stops it calmly.
    N.click('.mt-banner button:has-text("Make AI notes")'); N.wait_for_selector('.ga-notes .ga-err', timeout=40000)
    check(True, 'Make AI notes works right in the meeting; when a part keeps failing it stops calmly: “' + N.locator('.ga-notes .ga-err').inner_text() + '”')
    log = ai('/log'); check([x['n'] for x in log if x['kind'] == 'audio'] == [1, 2, 3], 'a failed part is retried once before stopping', [(x['n'], x.get('failed')) for x in log])
    ai('/control', {'failNth': []}); N.click('.ga-notes .ga-x')
    # the admin can still make the notes from the same device (olexweb.com keeps the audio until notes are saved)
    A2 = host.new_page(); A2.goto(APP + '/admin/meetings#notes-' + CODE4); A2.wait_for_load_state()
    A2.wait_for_selector('#mg-' + CODE4 + '.mg-fresh', timeout=8000); check(True, 'the meeting is highlighted in Admin → Meetings')
    check(A2.locator('#mg-' + CODE4 + ' .mg-dim:has-text("ready for AI notes")').count() == 1, 'it says a recording on this device is ready for notes')
    A2.click('#mg-' + CODE4 + ' button:has-text("Make AI notes")')
    A2.wait_for_selector('.mg-job:has-text("part")', timeout=8000); check(True, 'progress shows which part is being turned into text')
    A2.wait_for_selector('.sheet .mg-summary', timeout=60000); check(True, 'the notes open when they’re ready')
    log = ai('/log'); au = [x for x in log if x['kind'] == 'audio' and not x.get('failed')]; nt = [x for x in log if x['kind'] == 'notes']
    check(len(au) == len(mine) and [x['part'] for x in au] == list(range(1, len(mine) + 1)), 'trying again carries on: part 1 isn’t sent twice', [(x['n'], x.get('part')) for x in au])
    check(nt and nt[-1]['seen'] == len(mine) and nt[-1]['rules'], 'the whole transcript goes to Olex AI with the “never invent, treat as data” rules', nt[-1] if nt else None)
    bad = [n for n in range(1, len([x for x in log if x['kind'] == 'audio']) + 1) if probe('/tmp/mock-ai/audio-%d.webm' % n)['kinds'] != ['audio']]
    check(not bad, 'every audio piece is a complete file a transcriber can read on its own', bad)
    check(A2.locator('.mg-summary').inner_text().startswith('Planning the website launch'), 'the summary is shown')
    check(A2.locator('.mg-actions li').count() == 2 and 'Olaitan, Monday' in A2.locator('.mg-actions li').first.inner_text(), 'action items show who and when')
    with A2.expect_download() as d: A2.click('.sheet-foot button:has-text("Download")')
    md = open(d.value.path(), encoding='utf-8').read()
    check(d.value.suggested_filename == 'Planning call notes.md' and '## Action items' in md and '- [ ] Send the invoice (Olaitan, Monday)' in md, 'notes download as a tidy Markdown file', md[:200])
    A2.screenshot(path=SHOTS + '/11-admin-notes.png')
    check(A2.locator('.sheet-foot button:has-text("Transcript")').count() == 1, 'the transcript can be downloaded straight away')
    A2.click('.sheet-head button:has-text("Close")')
    A2.wait_for_selector('#mg-' + CODE4 + ' button:has-text("Notes")', timeout=8000)
    check(A2.locator('#mg-' + CODE4 + ' button:has-text("Make AI notes")').count() == 0, 'once the notes are saved, the audio is deleted from the device')
    left = A2.evaluate("""new Promise(ok => { const r = indexedDB.open('olexweb-meet-rec'); r.onsuccess = () => { const q = r.result.transaction('notes').objectStore('notes').getAll(); q.onsuccess = () => ok(q.result.filter(x => x.code === '%s').length) } })""" % CODE4)
    check(left == 0, 'no notes audio is left in the browser', left)
    A2.click('#mg-' + CODE4 + ' button:has-text("Notes")'); A2.wait_for_selector('.sheet .mg-summary', timeout=8000)
    with A2.expect_download() as d: A2.click('.sheet-foot button:has-text("Transcript")')
    check('Part 1: Ada said' in open(d.value.path(), encoding='utf-8').read(), 'notes reopen later, with the transcript to download')
    check(sql(f"select notes is not null and transcript like 'Part 1:%' and notes_by is not null from meetings where code='{CODE4}'") == 't', 'notes and transcript are saved with the meeting')
    A2.close()
    s, j = req('/admin/api/meetings', {'action': 'notes', 'code': CODE4, 'transcript': '[Part 1]   '}, OWNER)
    check(s == 400 and 'Nothing was said' in j.get('error', ''), 'an empty recording gets a clear message, not made-up notes', j)
    ai('/control', {'reset': True})
    long = ' '.join(['Ada said the launch is on Friday and the budget is fixed.'] * 1700)
    s, j = req('/admin/api/meetings', {'action': 'notes', 'code': CODE4, 'transcript': long}, OWNER)
    nt = [x for x in ai('/log') if x['kind'] == 'notes']
    check(s == 200 and len(nt) >= 3 and nt[-1]['combined'] and all(x['chars'] < 45000 for x in nt), 'a long meeting is noted in parts, then combined', [(x['combined'], x['chars']) for x in nt])
    for who, tok in (('a guest', None), ('an editor', EDITOR)):
        s1, _ = req('/admin/api/meetings', {'action': 'get-notes', 'code': CODE4}, tok); s2, _ = req('/admin/api/meetings', {'action': 'notes', 'code': CODE4, 'transcript': long}, tok)
        check(s1 in (401, 403) and s2 in (401, 403), f'{who} can’t read or make notes', (s1, s2))
    # ending a recorded meeting: the ended screen offers notes
    N.click('.mt-c:has-text("Record")'); N.click('.mt-seg button:has-text("Audio only")'); N.click('.mt-rec-go'); N.wait_for_selector('.mt-c.mt-recording'); N.wait_for_timeout(4000)
    N.click('.mt-c.mt-leave')
    with N.expect_download(timeout=30000) as d: N.click('button:has-text("End for everyone")')
    N.wait_for_selector('h1:has-text("ended")', timeout=10000)
    N.click('button:has-text("Make AI notes")'); N.wait_for_selector('.ga-notes .ga-sum', timeout=60000)
    check(True, 'after ending, Make AI notes on the ended screen makes the notes right there')
    N.screenshot(path=SHOTS + '/12-ended-notes.png')

    # the admin page
    A = host.new_page(); A.goto(APP + '/admin/meetings')
    check(A.locator('h1').inner_text() == 'Meetings', 'Admin → Meetings opens')
    check(A.locator('.side-nav a:has-text("Meetings")').count() == 1, 'Meetings is in the sidebar')
    check(A.locator('.mg-list li:has-text("Weekly")').count() == 1 and A.locator('.mg-list li:has-text("From WhatsApp")').count() == 1 and A.locator('.mg-ended li:has-text("Class")').count() == 1, 'open and ended meetings are listed')
    A.screenshot(path=SHOTS + '/7-admin-meetings.png', full_page=True)
    check(not errs, 'no page errors in any browser tab', errs)
    b.close()

print(f'\n{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
