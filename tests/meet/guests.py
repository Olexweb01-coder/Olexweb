# Install 2: the optional guest details form, the attendance list (LiveKit's real signed webhooks for leaving, plus the
# browser's signed "I left"), CSV, keeping details only as long as the host chose, reports, and bans.
# Run by run.sh in the Meet-app stage (MEET_ORIGIN=http://meet.localhost:3000; LiveKit with webhooks to the site).
import json, sys, urllib.request, csv, io
from datetime import datetime, timedelta, timezone
from playwright.sync_api import sync_playwright
exec(open('tests/meet/app.py').read().split("print('The Meet address')")[0])      # helpers: req, sql, raw, oauth, MEET, OWNER
SECRET = __import__('os').environ.get('CRON_SECRET', '')
def tick():
    r = urllib.request.Request(APP + '/api/assistant/cron?run=due', headers={'authorization': 'Bearer ' + SECRET})
    with urllib.request.urlopen(r, timeout=60) as x: return json.loads(x.read())
def post(path, body, host=None, origin=None, cookie=None):
    h = {'Content-Type': 'application/json'}
    if origin: h['Origin'] = origin
    if cookie: h['Cookie'] = cookie
    if host: h['Host'] = host
    r = urllib.request.Request(APP + path, data=json.dumps(body).encode(), headers=h)
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.loads(x.read() or b'{}')
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
def get(path, cookie=None):
    r = urllib.request.Request(APP + path, headers={'Cookie': cookie} if cookie else {})
    try:
        with urllib.request.urlopen(r) as x: return x.status, x.headers, x.read()
    except urllib.error.HTTPError as e: return e.code, e.headers, e.read()
ADMIN = '__Host-olex_sess=' + OWNER
FORM = {'on': True, 'phone': 'required', 'email': 'optional', 'org': True, 'question': 'What do you want to learn?', 'keep': 30}

print('The host’s form')
s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'Workshop', 'form': FORM}, OWNER); C = j['code']
f = json.loads(sql(f"select form::text from meetings where code = '{C}'"))
check(f == {'phone': 'required', 'email': 'optional', 'org': True, 'question': 'What do you want to learn?', 'keep': 30}, 'the form is saved as chosen', f)
s, j = req('/api/meet?code=' + C); check(j.get('form') == {'phone': 'required', 'email': 'optional', 'org': True, 'question': 'What do you want to learn?', 'keep': 30}, 'guests can see what will be asked, and for how long')
s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'Weird form', 'form': {'on': True, 'phone': 'always', 'keep': 7, 'question': '<b>Hi</b>'}}, OWNER)
f2 = json.loads(sql(f"select form::text from meetings where code = '{j['code']}'"))
check(f2['phone'] == 'required' and f2['keep'] == 30 and f2['question'] == 'Hi', 'odd values fall back to safe defaults (and tags are removed)', f2)
s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'Plain'}, OWNER); PLAIN = j['code']
check(sql(f"select form is null from meetings where code = '{PLAIN}'") == 't', 'a meeting without the form has none (most meetings)')

print('Guests fill it in')
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
    errs = []
    host = b.new_context(viewport={'width': 1280, 'height': 860}, permissions=['camera', 'microphone'])
    host.add_cookies([{'name': '__Host-olex_sess', 'value': OWNER, 'domain': 'localhost', 'path': '/', 'secure': True, 'httpOnly': True, 'sameSite': 'Strict'}])
    H = host.new_page(); H.on('pageerror', lambda e: errs.append('host: ' + str(e)[:90])); H.goto(APP + '/meet/' + C)
    check(H.locator('#mt-phone').count() == 0 and H.locator('.mt-consent').count() == 0, 'the host never fills in the form')
    H.click('button[type=submit]'); H.wait_for_selector('#mt-rec-h', timeout=15000); H.click('button:has-text("Not now")')
    g = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, permissions=['camera', 'microphone'])
    G = g.new_page(); G.on('pageerror', lambda e: errs.append('guest: ' + str(e)[:90])); G.goto(f'{MEET}/{C}')
    check(G.locator('#mt-phone').count() == 1 and G.locator('label[for=mt-email]').inner_text() == 'Email (optional)', 'the guest sees phone (required) and email (optional)')
    check(G.locator('#mt-org').count() == 1 and G.locator('label[for=mt-ans]').inner_text().startswith('What do you want to learn?'), 'plus organisation and the host’s question')
    c = G.locator('.mt-consent').inner_text(); check('Only the host sees them' in c and '30 days' in c, 'and is told who sees it and how long it’s kept: “' + c + '”')
    G.screenshot(path=SHOTS + '/17-guest-form-phone.png', full_page=True)
    G.fill('#mt-name', 'Ngozi'); G.click('button[type=submit]'); G.wait_for_selector('.mt-err', timeout=8000)
    check('Tick the box' in G.locator('.mt-err').inner_text(), 'joining without agreeing is refused: “' + G.locator('.mt-err').inner_text() + '”')
    G.check('.mt-consent input'); G.click('button[type=submit]'); G.wait_for_selector('.mt-err:has-text("phone")', timeout=8000)
    check(True, 'a required phone number is required: “' + G.locator('.mt-err').inner_text() + '”')
    G.fill('#mt-phone', '0801 234 5678'); G.fill('#mt-email', 'not-an-email'); G.click('button[type=submit]'); G.wait_for_timeout(600)
    check(G.evaluate("!document.querySelector('#mt-email').checkValidity()") and G.locator('.mt-bar').count() == 0, 'a mistyped email is stopped by the browser')
    s, j = post('/api/meet', {'code': C, 'name': 'Sneaky', 'details': {'consent': True, 'phone': '0801 234 5678', 'email': 'not-an-email'}}, origin=APP)
    check(s == 400 and 'email' in j.get('error', ''), 'and by the server, if someone skips the browser: “' + j.get('error', '') + '”')
    s, j = post('/api/meet', {'code': C, 'name': 'Sneaky', 'details': {'consent': True, 'phone': 'call me maybe'}}, origin=APP)
    check(s == 400 and 'phone' in j.get('error', ''), 'a phone number that isn’t one is refused: “' + j.get('error', '') + '”')
    G.fill('#mt-email', 'Ngozi@Example.com'); G.fill('#mt-org', 'Lagos Tech Hub'); G.fill('#mt-ans', 'Pricing'); G.click('button[type=submit]')
    G.wait_for_selector('.mt-bar', timeout=15000); check(True, 'with everything right, she’s in')
    a = json.loads(sql(f"select row_to_json(x) from (select name, phone, email, org, answer, left_at, identity from meet_attendees where code = '{C}') x"))
    check(a['name'] == 'Ngozi' and a['phone'] == '0801 234 5678' and a['email'] == 'ngozi@example.com' and a['org'] == 'Lagos Tech Hub' and a['answer'] == 'Pricing', 'her details are saved for the host', a)
    check(sql(f"select count(*) from meet_attendees where code = '{C}' and identity like 'h_%'") == '0', 'the host isn’t on the attendance list')
    s, j = post('/api/meet', {'code': C, 'name': '=HYPERLINK("http://x")', 'details': {'consent': True, 'phone': '+44 20 7946 0958'}}, origin=APP)
    check(s == 200 and j.get('leaveKey'), 'another guest joins (details checked on the server too)')
    K2 = (j['identity'], j['leaveKey'])
    s, j = post('/api/meet', {'code': PLAIN, 'name': 'Anyone'}, origin=APP); check(s == 200 and j.get('state') in ('waiting', 'ready'), 'a meeting without the form asks for just a name, as before')

    print('Who was there, and when they left')
    s, j = req('/api/meet/livekit', {'event': 'participant_left', 'participant': {'identity': a['identity']}})
    check(s == 401, 'a fake LiveKit event (not signed) is refused')
    s, j = post('/api/meet/left', {'identity': a['identity'], 'key': 'wrong'}); check(s == 400 and sql(f"select left_at is null from meet_attendees where identity = '{a['identity']}'") == 't', 'someone can’t mark another guest as gone')
    G.click('.mt-c.mt-leave'); G.wait_for_selector('h1:has-text("left")', timeout=10000); H.wait_for_timeout(2500)
    check(sql(f"select left_at is not null from meet_attendees where identity = '{a['identity']}'") == 't', 'when she leaves, her leaving time is recorded (LiveKit’s signed event and her browser)')
    check(sql(f"select last_seen is not null from meet_attendees where identity = '{a['identity']}'") == 't', 'LiveKit’s signed webhook reached the site (only it records “joined”)')
    s, j = post('/api/meet/left', {'identity': K2[0], 'key': K2[1]}); check(s == 200 and sql(f"select left_at is not null from meet_attendees where identity = '{K2[0]}'") == 't', 'the browser’s signed “I left” works too')
    s, h, body = get(f'/api/meet/attendance?code={C}', ADMIN); check(s == 400 and 'when the meeting ends' in json.loads(body).get('error', ''), 'the list isn’t shown while the meeting is on')
    s, h, body = get(f'/api/meet/attendance?code={C}'); check(s == 403, 'nobody but the host can see it', s)
    s, j = req('/admin/api/meetings', {'action': 'end', 'code': C}, OWNER)
    s, h, body = get(f'/api/meet/attendance?code={C}', ADMIN); A = json.loads(body)
    check(s == 200 and len(A['people']) == 2 and A['people'][0]['name'] == 'Ngozi' and A['keepUntil'], 'after it ends: everyone who joined, with a date the details are kept until')
    check(all(p['minutes'] >= 0 and p['leftAt'] >= p['joinedAt'] for p in A['people']), 'each with when they joined and left')
    s, h, body = get(f'/api/meet/attendance?code={C}&format=csv', ADMIN)
    text = body.decode('utf-8-sig'); rows = list(csv.reader(io.StringIO(text)))
    check(s == 200 and 'attachment' in h.get('Content-Disposition', '') and body.startswith('\ufeff'.encode()), 'CSV download (opens correctly in Excel)')
    check(rows[0] == ['Name', 'Phone', 'Email', 'Organisation or role', 'What do you want to learn?', 'Joined (UTC)', 'Left (UTC)', 'Minutes'], 'with a column for each thing asked', rows[0])
    check(rows[1][:5] == ['Ngozi', '0801 234 5678', 'ngozi@example.com', 'Lagos Tech Hub', 'Pricing'], 'and everyone’s details', rows[1])
    check(rows[2][0].startswith("'="), 'a name that looks like a spreadsheet formula can’t run as one', rows[2][0])
    A2 = host.new_page(); A2.goto(APP + '/admin/meetings')
    A2.click(f'.mg-ended li:has-text("Workshop") button:has-text("Attendance")'); A2.wait_for_selector('.ga-table', timeout=8000)
    check(A2.locator('.ga-table tbody tr').count() == 2 and 'Lagos Tech Hub' in A2.locator('.ga-table').inner_text(), 'Admin → Meetings → Attendance shows the list')
    A2.screenshot(path=SHOTS + '/18-attendance.png')
    A2.on('dialog', lambda d: d.accept()); A2.click('.ga-acts button:has-text("Delete")'); A2.wait_for_selector('.ga-table', state='detached', timeout=8000)
    check(sql(f"select count(*) from meet_attendees where code = '{C}'") == '0', 'the host can delete the list early')

    print('Kept only as long as the host chose')
    for keep, title in ((30, 'Keep30'), (90, 'Keep90'), (0, 'KeepForever')):
        s, j = req('/admin/api/meetings', {'action': 'create', 'title': title, 'form': {**FORM, 'keep': keep}}, OWNER); code = j['code']
        sql(f"update meetings set started_at = now(), ended_at = now() - interval '31 days' where code = '{code}'")
        sql(f"insert into meet_attendees (code, identity, name, joined_at, left_at) values ('{code}', 'g_k{keep}x{code[:3]}', 'Old guest', now() - interval '31 days', now() - interval '31 days')")
    r = tick()
    left = {t: sql(f"select count(*) from meet_attendees a join meetings m on m.code = a.code where m.title = '{t}'") for t in ('Keep30', 'Keep90', 'KeepForever')}
    check(left == {'Keep30': '0', 'Keep90': '1', 'KeepForever': '1'}, '31 days after: 30-day details deleted; 90-day and “until I delete” kept', left)
    check(r.get('forgotGuests', 0) >= 1, 'deleted by the 10-minute run')

    print('Reports and bans')
    oauth({'as': {'google': {'sub': 'g-bad', 'email': 'bad@meettest.local', 'email_verified': True, 'name': 'Bad Host'}}})
    BH = b.new_context(permissions=['camera', 'microphone']).new_page(); BH.goto(MEET + '/api/meet/auth/google?next=/'); BH.wait_for_url(MEET + '/', timeout=15000)
    BH.click('button:has-text("New meeting")'); BH.click('button:has-text("Start a meeting now")'); BH.wait_for_url(MEET + '/*-*-*', timeout=15000); BADC = BH.url.rsplit('/', 1)[-1]
    BH.click('button[type=submit]'); BH.wait_for_selector('.mt-bar', timeout=15000)
    R = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, permissions=['camera', 'microphone']).new_page()
    R.goto(f'{MEET}/{BADC}'); R.fill('#mt-name', 'Witness'); R.click('button[type=submit]'); R.wait_for_selector('.mt-bar', timeout=15000)
    R.click('.mt-c:has-text("More")'); R.click('.mt-menu button:has-text("Report")'); R.wait_for_selector('#mt-rep-h')
    check(R.locator('.mt-reasons label').count() == 4, 'a guest can report a meeting (from More on a phone), choosing a reason')
    R.screenshot(path=SHOTS + '/19-report-phone.png')
    R.check('input[value=spam]'); R.fill('.mt-dialog textarea', 'Selling fake investments'); R.click('button:has-text("Send report")')
    R.wait_for_selector('.mt-toast:has-text("report was sent")', timeout=8000); check(sql(f"select reason || '|' || note || '|' || reporter_name from meet_reports where code = '{BADC}'") == 'spam|Selling fake investments|Witness', 'the report is saved')
    check(len(sql(f"select ip_hash from meet_reports where code = '{BADC}'")) == 32, 'the reporter’s address is kept only as a hash')
    s, j = post('/api/meet/report', {'code': BADC, 'reason': 'spam'}, origin=APP); check(s == 400 and 'already reported' in j.get('error', ''), 'the same person can’t flood one meeting with reports')
    s, j = post('/api/meet/report', {'code': PLAIN, 'reason': 'nonsense'}, origin=APP); check(s == 400, 'an unknown reason is refused')
    s, j = post('/api/meet/report', {'code': PLAIN, 'reason': 'spam'}); check(s == 403, 'reports from other sites are refused')
    A3 = host.new_page(); A3.goto(APP + '/admin/meetings#accounts'); A3.wait_for_selector('.ma .mg-list li', timeout=8000)   # its own tab since install 3
    check('Spam or scam' in A3.locator('.ma').inner_text() and 'Selling fake investments' in A3.locator('.ma').inner_text() and 'Bad Host' in A3.locator('.ma').inner_text(), 'you see the report in Admin → Meetings → Meet app')
    A3.screenshot(path=SHOTS + '/20-admin-meet-app.png', full_page=True)
    A3.on('dialog', lambda d: d.accept('Scam meeting'))
    A3.click('.ma .mg-list li:has-text("Selling fake") button:has-text("Ban the host")'); A3.wait_for_selector('.toast:has-text("Banned")', timeout=10000)
    uid = sql("select id from meet_users where email = 'bad@meettest.local'")
    check(sql(f"select banned_reason from meet_users where id = {uid}") == 'Scam meeting' and sql(f"select count(*) from meet_sessions where user_id = {uid}") == '0', 'ban: they’re signed out everywhere, with your reason')
    R.wait_for_selector('h1:has-text("ended")', timeout=15000); check(sql(f"select ended_at is not null from meetings where code = '{BADC}'") == 't', 'and their meeting ended for everyone in it')
    check(sql(f"select status from meet_reports where code = '{BADC}'") == 'actioned', 'the report is marked as acted on')
    BH.goto(MEET + '/'); check(BH.locator('.mh-me').count() == 0, 'the banned host is signed out')
    s, j = req('/admin/api/meetings', {'action': 'ban', 'id': int(sql("select id from meet_users where role = 'owner' limit 1") or 0)}, OWNER); check(s == 400 or not sql("select id from meet_users where role = 'owner' limit 1"), 'the owner’s account can’t be banned')
    s, j = req('/admin/api/meetings', {'action': 'unban', 'id': int(uid)}, OWNER); check(sql(f"select banned_at is null from meet_users where id = {uid}") == 't', 'unban works')
    s, j = req('/admin/api/meetings', {'action': 'meet-admin'}, EDITOR := session('editor@test.local')); check(s == 403, 'an editor can’t see accounts or reports')
    check(not errs, 'no page errors', errs)
    b.close()

print('Privacy')
import glob
check(not any('meet_attendees' in open(f).read() for f in glob.glob('lib/assistant/*.js')), 'guests’ details are never read by Olex AI or sent to an AI provider')
print(f'\n{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
