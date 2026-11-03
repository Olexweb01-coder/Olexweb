# Olexweb Meet as its own app (meet.olexweb.com): the address rules, installing it, sign-in with Google, Microsoft, GitHub
# and Facebook (tests/meet/mock-oauth.mjs stands in for them and checks state, secret, return address and PKCE like the real
# ones), owner linking, banned accounts, creating and scheduling, hosting from a Meet account, guests without accounts,
# who may do what, fair use, and keeping other people's meetings out of the admin and Olex AI.
# Run by run.sh with MEET_ORIGIN=http://meet.localhost:3000 (Chrome sends *.localhost to this computer).
import json, sys, urllib.request, http.client
from datetime import datetime, timedelta, timezone
from playwright.sync_api import sync_playwright
exec(open('tests/meet/e2e.py').read().split("OWNER, EDITOR = ")[0])
MEET = 'http://meet.localhost:3000'
OWNER = session('owner@test.local')
def oauth(body): urllib.request.urlopen(urllib.request.Request('http://localhost:4567/control', data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'}))
def olog(): return json.loads(urllib.request.urlopen('http://localhost:4567/log').read())
def raw(path, host='meet.localhost:3000', headers=None):            # one request, without following redirects
    c = http.client.HTTPConnection('localhost', 3000, timeout=20); c.request('GET', path, headers={'Host': host, **(headers or {})}); r = c.getresponse(); b = r.read(); c.close()
    return r.status, {k.lower(): v for k, v in r.getheaders()}, b
OWNER_EMAIL = sql("select email from admin_users where role = 'owner' limit 1")
sql("delete from meetings where host_user in (select id from meet_users where email like '%@meettest.local')")
sql("delete from meet_users where email like '%@meettest.local' or lower(email) = lower('" + OWNER_EMAIL + "')")

print('The Meet address')
s, h, b = raw('/'); check(s == 200 and b'Meetings that keep working' in b, 'meet.olexweb.com opens Meet’s home')
check(b'rel="manifest" href="/manifest.webmanifest"' in b, 'the home offers the app’s install file')
s, h, b = raw('/manifest.webmanifest'); m = json.loads(b)
check(s == 200 and m['name'] == 'Olexweb Meet' and m['display'] == 'standalone' and m['start_url'].startswith('/'), 'the install file names the app and opens full-screen')
check({i['sizes'] for i in m['icons']} >= {'192x192', '512x512'} and any(i.get('purpose') == 'maskable' for i in m['icons']), 'it has 192 and 512 icons, and one for Android’s shapes')
for i in m['icons']:
    s2, h2, b2 = raw(i['src']); check(s2 == 200 and b2[:8] == b'\x89PNG\r\n\x1a\n', f'icon {i["sizes"]} {i.get("purpose", "")} is a real image')
s, h, b = raw('/sw.js'); check(s == 200 and b'caches' in b and 'javascript' in h.get('content-type', ''), 'the service worker is served at /sw.js')
check(b'never meetings' in b or b'stores nothing private' in b, 'and it stores nothing private')
s, h, b = raw('/apple-touch-icon.png'); check(s == 200 and b[:4] == b'\x89PNG', 'iPhone’s home-screen icon is there')
s, h, b = raw('/meet/offline.html'); check(s == 200 and 'You’re offline'.encode() in b, 'a friendly page for when there’s no connection')
s, h, b = raw('/about'); check(s in (307, 308) and h.get('location', '').endswith('/about') and 'meet.' not in h.get('location', ''), 'other pages on the Meet address go to the main site')
s, h, b = raw('/admin/meetings'); check(s in (307, 308) and '/admin/meetings' in h.get('location', '') and 'meet.' not in h.get('location', ''), 'the admin isn’t on the Meet address')
s, h, b = raw('/meet', host='localhost:3000'); check(s in (307, 308) and h.get('location', '').startswith(MEET), 'olexweb.com/meet now goes to the Meet app')

print('Signing in')
oauth({'reset': True, 'as': {'google': {'sub': 'g-ada', 'email': 'ada@meettest.local', 'email_verified': True, 'name': 'Ada Obi'}}})
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
    ada = b.new_context(viewport={'width': 1280, 'height': 860}, permissions=['clipboard-read', 'clipboard-write', 'camera', 'microphone'])
    errs = []
    A = ada.new_page(); A.on('pageerror', lambda e: errs.append('ada: ' + str(e)[:90])); A.goto(MEET + '/')
    A.click('button:has-text("New meeting")'); A.click('button:has-text("Schedule a meeting")')
    A.wait_for_selector('#mh-sheet-h:has-text("Sign in")'); check(True, 'scheduling while signed out asks you to sign in first')
    check(A.locator('.mh-provider').count() == 4, 'all four sign-in options show when their keys are set', A.locator('.mh-provider').all_inner_texts())
    A.click('.mh-provider:has-text("Google")'); A.wait_for_selector('#mh-sheet-h:has-text("Schedule a meeting")', timeout=15000)
    check(True, 'after signing in with Google you carry on to scheduling')
    L = olog(); au = [x for x in L if x['step'] == 'authorize'][-1]; tk = [x for x in L if x['step'] == 'token'][-1]
    check(au['pkce'] and au['method'] == 'S256' and tk['ok'] and tk['pkceOk'], 'Google sign-in uses PKCE, and the proof matched')
    u = json.loads(sql("select row_to_json(x) from (select id, email, email_verified, name, role from meet_users where email = 'ada@meettest.local') x"))
    check(u['email_verified'] and u['name'] == 'Ada Obi' and u['role'] == 'user', 'an account was made for her, with her verified email')
    sess = A.context.cookies(MEET); sc = [c for c in sess if c['name'] == '__Host-meet_sess']
    check(sc and sc[0]['httpOnly'] and sc[0]['secure'] and sc[0]['sameSite'] == 'Lax', 'the sign-in cookie is HttpOnly, Secure and Lax')
    check(sql(f"select count(*) from meet_sessions where id_hash = '{sc[0]['value']}'") == '0', 'only a hash of the cookie is stored')
    # schedule in her own time zone
    A.fill('.mh-card input[placeholder="Team catch-up"]', 'Product review'); tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
    A.fill('.mh-card input[type=date]', tomorrow); A.fill('.mh-card input[type=time]', '14:30'); A.click('.mh-card button:has-text("Schedule")')
    A.wait_for_selector('#mh-sheet-h:has-text("Meeting scheduled")', timeout=8000)
    code = sql("select code from meetings where title = 'Product review' order by id desc limit 1")
    check(code and sql(f"select host_user from meetings where code = '{code}'") == str(u['id']), 'scheduled, and she’s its host')
    check(f'{MEET}/{code}' in A.locator('.mh-linkbox').inner_text(), 'its link is on the Meet address: ' + A.locator('.mh-linkbox').inner_text())
    check(sql(f"select reminders::text from meetings where code = '{code}'") == '[]', 'no phone reminders for other hosts (their guests get calendar invites)')
    A.click('.mh-card button:has-text("Copy invite")'); inv = A.evaluate('navigator.clipboard.readText()')
    check(inv.startswith('You’re invited: Product review') and 'time)' in inv and f'{MEET}/{code}' in inv, 'Copy invite gives a ready message in her own time zone', inv)
    A.click('.mh-card button:has-text("Done")'); A.wait_for_selector(f'.mh-list li:has-text("Product review")')
    check(True, 'it shows in Your meetings')
    A.screenshot(path=SHOTS + '/16-meet-home-signed-in.png')
    # start a meeting now and host it
    A.click('button:has-text("New meeting")'); A.click('button:has-text("Start a meeting now")'); A.wait_for_url(MEET + '/*-*-*', timeout=15000)
    now_code = A.url.rsplit('/', 1)[-1]
    check(A.locator('button[type=submit]:has-text("Start the meeting")').count() == 1 and A.input_value('#mt-name') == 'Ada Obi', 'Start a meeting now: she lands in it as the host, name filled in')
    A.click('button[type=submit]'); A.wait_for_selector('.mt-bar', timeout=15000)
    A.wait_for_selector('#mt-rec-h', timeout=8000); check(True, 'in the room as host (with the record prompt hosts get)')
    A.click('button:has-text("Not now")')
    # a guest joins without an account
    guest = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, permissions=['camera', 'microphone'])
    G = guest.new_page(); G.on('pageerror', lambda e: errs.append('guest: ' + str(e)[:90])); G.goto(MEET + '/')
    G.fill('.mh-join input', f'https://meet.olexweb.com/{now_code}'); G.click('.mh-join button:has-text("Join")'); G.wait_for_url(MEET + '/' + now_code, timeout=10000)
    check(True, 'a guest pastes the link on the home page and goes to the meeting (no account)')
    G.fill('#mt-name', 'Tunde'); G.click('button[type=submit]'); G.wait_for_selector('.mt-bar', timeout=15000)
    A.wait_for_function("document.querySelectorAll('.mt-grid .mt-tile:not(.mt-more)').length === 2", timeout=15000); check(True, 'the guest is in her meeting')
    A.click('.mt-c:has-text("People")'); A.on('dialog', lambda d: d.accept()); A.click('.mt-people li:has-text("Tunde") button:has-text("Remove")')
    G.wait_for_selector('h1:has-text("removed")', timeout=10000); check(True, 'her host controls work (she removed the guest)')
    st, j = req('/api/meet/host', {'action': 'end', 'code': now_code}); check(st == 403, 'someone who isn’t the host can’t end it', st)
    A.click('.mt-c.mt-leave'); A.click('button:has-text("End for everyone")'); A.wait_for_selector('h1:has-text("ended")', timeout=10000); check(True, 'she ends it for everyone')
    check(A.locator('a:has-text("Make AI notes")').count() == 0, 'AI notes stay with Olaitan for now (not offered to other hosts)')

    print('Other sign-in options and the safety rules')
    oauth({'as': {'github': {'id': 777, 'login': 'adaobi', 'name': 'Ada O.', 'emails': [{'email': 'ada@meettest.local', 'primary': True, 'verified': True}]}}})
    B = b.new_context().new_page(); B.goto(MEET + '/api/meet/auth/github?next=/'); B.wait_for_url(MEET + '/', timeout=15000)
    check(sql("select count(*) from meet_users where email = 'ada@meettest.local'") == '1' and sql("select count(*) from meet_identities i join meet_users u on u.id = i.user_id where u.email = 'ada@meettest.local'") == '2',
          'GitHub with the same verified email joins her existing account (one person, two ways in)')
    oauth({'as': {'microsoft': {'sub': 'ms-1', 'email': 'ada@meettest.local', 'name': 'Not Ada'}}})
    C = b.new_context().new_page(); C.goto(MEET + '/api/meet/auth/microsoft?next=/'); C.wait_for_url(MEET + '/', timeout=15000)
    check(sql("select count(*) from meet_users where email = 'ada@meettest.local'") == '2', 'Microsoft (email not verified by the provider) does NOT join her account: it’s a separate one')
    check([x for x in olog() if x['step'] == 'token'][-1]['pkceOk'], 'Microsoft sign-in uses PKCE too')
    oauth({'as': {'facebook': {'id': 'fb-9', 'name': 'Bisi', 'email': 'bisi@meettest.local'}}})
    D = b.new_context().new_page(); D.goto(MEET + '/api/meet/auth/facebook?next=/'); D.wait_for_url(MEET + '/', timeout=15000)
    check(D.locator('.mh-me').count() == 1 and sql("select email_verified from meet_users where email = 'bisi@meettest.local'") == 'f', 'Facebook sign-in works (email kept as unverified)')
    oauth({'as': {'google': {'sub': 'g-x', 'email': 'x@meettest.local', 'email_verified': True, 'name': 'X'}, 'badState': True}})
    E = b.new_context().new_page(); E.goto(MEET + '/api/meet/auth/google?next=/'); E.wait_for_selector('.mh-toast', timeout=15000); E.wait_for_url(MEET + '/', timeout=8000)
    check('signin' not in E.url and E.locator('.mh-toast:has-text("didn’t match")').count() == 1 and sql("select count(*) from meet_users where email = 'x@meettest.local'") == '0', 'a forged sign-in (wrong state) is refused, with a plain message')
    oauth({'as': {'cancel': True}})
    F = b.new_context().new_page(); F.goto(MEET + '/api/meet/auth/google?next=/'); F.wait_for_url(MEET + '/*', timeout=15000)
    check(F.locator('.mh-toast:has-text("cancelled")').count() == 1, 'cancelling at Google comes back calmly')
    st, h, _ = raw(f'/api/meet/auth/google/callback?code=c999&state=abc'); check(st in (302, 307) and 'signin=' in h.get('location', ''), 'a callback with no sign-in started is refused')
    sql("update meet_users set banned_at = now(), banned_reason = 'test' where email = 'bisi@meettest.local'")
    D.goto(MEET + '/'); check(D.locator('.mh-me').count() == 0, 'a banned account is signed out at once')
    oauth({'as': {'facebook': {'id': 'fb-9', 'name': 'Bisi', 'email': 'bisi@meettest.local'}}}); D.goto(MEET + '/api/meet/auth/facebook?next=/'); D.wait_for_url(MEET + '/*', timeout=15000)
    check(D.locator('.mh-toast:has-text("can’t use")').count() == 1, 'and can’t sign in again')

    print('Olaitan’s Meet account')
    oauth({'as': {'microsoft': {'sub': 'ms-owner', 'email': OWNER_EMAIL, 'name': 'Fake Owner'}}})
    O1 = b.new_context().new_page(); O1.goto(MEET + '/api/meet/auth/microsoft?next=/'); O1.wait_for_url(MEET + '/', timeout=15000)
    check(sql(f"select role from meet_users u join meet_identities i on i.user_id = u.id where i.provider = 'microsoft' and i.subject = 'ms-owner'") == 'user', 'your email on an unverified sign-in does NOT make someone the owner')
    oauth({'as': {'google': {'sub': 'g-owner', 'email': OWNER_EMAIL, 'email_verified': True, 'name': 'Olaitan'}}})
    O = b.new_context(permissions=['camera', 'microphone']).new_page(); O.goto(MEET + '/api/meet/auth/google?next=/'); O.wait_for_url(MEET + '/', timeout=15000)
    check(sql(f"select role from meet_users u join meet_identities i on i.user_id = u.id where i.provider = 'google' and i.subject = 'g-owner'") == 'owner', 'a verified Google sign-in with your admin email is the owner')
    O.click('.mh-me summary'); check(O.locator('.mh-me-menu a:has-text("Open the admin")').count() == 1, 'and gets a link to the admin')
    st, j = req('/admin/api/meetings', {'action': 'create', 'title': 'Made in the admin'}, OWNER); acode = j['code']
    O.goto(MEET + '/'); check(O.locator(f'.mh-list li:has-text("{acode}")').count() == 1, 'your Meet account lists the meetings you made in the admin')
    O.goto(f'{MEET}/{acode}'); O.wait_for_selector('#mt-name'); check(O.locator('button[type=submit]:has-text("Start the meeting")').count() == 1, 'and hosts them on the Meet app')

    print('The old address')
    st, h, _ = raw(f'/meet/{code}', host='localhost:3000'); check(st in (307, 308) and h.get('location', '') == f'{MEET}/{code}', 'a guest opening olexweb.com/meet/… goes to the Meet app')
    st, h, _ = raw(f'/meet/{acode}', host='localhost:3000', headers={'Cookie': '__Host-olex_sess=' + OWNER}); check(st == 200, 'you, signed in to the admin, stay on olexweb.com (and host from there)')
    check(not errs, 'no page errors', errs)
    b.close()

print('Who may do what')
ADA = sql("select id from meet_users where email = 'ada@meettest.local' and email_verified order by id limit 1")
def as_user(uid):
    import secrets, hashlib; t = secrets.token_urlsafe(32); sql(f"insert into meet_sessions (id_hash, user_id, expires_at) values ('{hashlib.sha256(t.encode()).hexdigest()}', {uid}, now() + interval '1 day')"); return t
def mine(body, tok, origin=True):
    h = {'Content-Type': 'application/json', 'Cookie': '__Host-meet_sess=' + tok if tok else ''}
    if origin: h['Origin'] = MEET
    r = urllib.request.Request(MEET.replace('meet.localhost', 'localhost') + '/api/meet/mine', data=json.dumps(body).encode(), headers={**h, 'Host': 'meet.localhost:3000'})
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.loads(x.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
TA, TB = as_user(ADA), as_user(sql("select id from meet_users where email = 'ada@meettest.local' and not email_verified limit 1"))
st, j = mine({'action': 'list'}, None); check(st == 401, 'signed out: can’t list or make meetings')
st, j = mine({'action': 'create', 'title': 'x'}, TA, origin=False); check(st == 403, 'requests from other sites are refused')
st, j = mine({'action': 'end', 'code': code}, TB); check(st == 403, 'one account can’t end another’s meeting')
st, j = mine({'action': 'update', 'code': code, 'title': 'Hijack'}, TB); check(st == 403 and sql(f"select title from meetings where code = '{code}'") == 'Product review', 'or change it')
st, j = mine({'action': 'list'}, TB); check(st == 200 and not any(m['code'] == code for m in j['meetings']), 'and doesn’t see it in their list')
st, j = mine({'action': 'update', 'code': code, 'title': 'Product review (moved)', 'startsAt': (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()}, TA)
check(st == 200 and sql(f"select title from meetings where code = '{code}'") == 'Product review (moved)', 'the host can change her own meeting')
sql(f"insert into meetings (code, title, host_user, created_at) select 'zz' || g || '-test-aaa', 'filler', {ADA}, now() from generate_series(1, 30) g")
st, j = mine({'action': 'create', 'title': 'One more'}, TA); check(st == 400 and '30 meetings today' in j.get('error', ''), 'fair use: 30 new meetings a day per account: “' + j.get('error', '') + '”')
sql("delete from meetings where title = 'filler'")

print('Your admin and Olex AI see only your meetings')
st, j = req('/admin/api/meetings', {'action': 'create', 'title': 'Mine for the admin'}, OWNER)
r = urllib.request.Request(APP + '/admin/meetings', headers={'Cookie': '__Host-olex_sess=' + OWNER}); page = urllib.request.urlopen(r).read().decode()
check('Mine for the admin' in page and 'Product review' not in page, 'Admin → Meetings lists yours, not other people’s')
check(sql(f"select count(*) from meetings where code = '{code}' and {open('lib/site/meet.js').read().split('export const OWNERS = ')[1].split(chr(10))[0].split('   //')[0].strip().strip(chr(34))}") == '0', 'the same rule keeps them out of reminders and Olex AI')
uid = sql("select id from meet_users where email = 'ada@meettest.local' and email_verified limit 1"); n0 = sql(f"select count(*) from meetings where host_user = {uid}")
sql(f"delete from meet_users where id = {uid}")
check(int(n0) > 0 and sql(f"select count(*) from meetings where code = '{code}'") == '0', 'deleting an account deletes its meetings (they never become yours)')

print(f'\n{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
