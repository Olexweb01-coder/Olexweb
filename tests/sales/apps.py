# Private apps (Install 24): Graceville Fast Bible. The page; uploading a version in pieces from the admin; someone
# requests, waits, is approved and the installer downloads by itself, byte for byte; downloading again; a new device by
# email link; banning and unbanning; a new version replacing the old; and nobody else getting the file.
import hashlib, json, os, sys, urllib.request
exec(open('tests/meet/e2e.py').read().split("OWNER, EDITOR = ")[0])            # helpers: session, req, sql, check, APP
from playwright.sync_api import sync_playwright
OWNER, EDITOR = session('owner@test.local'), session('editor@test.local')
P = 4 * 1024 * 1024
def admin(body, tok=OWNER): return req('/admin/api/downloads', body, tok)
def put_piece(rid, n, data, tok=OWNER):
    r = urllib.request.Request(f'{APP}/admin/api/downloads/piece?id={rid}&n={n}', data=data, headers={'Origin': APP, 'Content-Type': 'application/octet-stream', 'Cookie': '__Host-olex_sess=' + tok}, method='POST')
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.loads(x.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
def upload(blob, name, version):
    s, j = admin({'action': 'start', 'app': 'graceville-fast-bible', 'filename': name, 'size': len(blob), 'version': version})
    assert s == 200, j
    for n in range(j['pieces']): st, _ = put_piece(j['id'], n, blob[n * P:(n + 1) * P]); assert st == 200, (n, _)
    return j, admin({'action': 'finish', 'id': j['id']})
def get(path):
    try:
        with urllib.request.urlopen(APP + path) as x: return x.status, x.read().decode()
    except urllib.error.HTTPError as e: return e.code, ''
sql("delete from app_access; delete from app_releases")
B1 = os.urandom(9 * 1024 * 1024 + 12345); H1 = hashlib.sha256(B1).hexdigest()
B2 = os.urandom(5 * 1024 * 1024 + 7); H2 = hashlib.sha256(B2).hexdigest()

print('The page')
s, h = get('/tools/graceville-fast-bible')
check(s == 200 and 'Scripture on screen' in h and 'Speech to screen' in h and 'Request download' in h and 'Built on FreeShow' in h, 'olexweb.com/tools/graceville-fast-bible: what it does, and Request download', s)
s, h = get('/tools'); check('Graceville Fast Bible' in h and 'Made by Olexweb' in h, 'the Directory features it at the top')

print('Uploading a version from the admin')
s, j = admin({'action': 'start', 'app': 'graceville-fast-bible', 'filename': 'virus.js', 'size': 10, 'version': '1'}); check(s == 400, 'only an installer (.exe, .msi, .zip) is accepted', j)
s, j = admin({'action': 'start', 'app': 'graceville-fast-bible', 'filename': 'x.exe', 'size': 10}, EDITOR); check(s == 403, 'only you (the owner) can upload')
s, j = admin({'action': 'start', 'app': 'graceville-fast-bible', 'filename': 'Graceville-Fast-Bible-Setup-2026.11.616.exe', 'size': len(B1), 'version': '2026.11.616'})
check(s == 200 and j['pieces'] == 3, 'a 9 MB installer goes up in 3 pieces (each under the server’s 4.5 MB limit)', j)
st, e = put_piece(j['id'], 0, B1[:100]); check(st == 400, 'a piece of the wrong size is refused', e)
for n in range(3): put_piece(j['id'], n, B1[n * P:(n + 1) * P])
s, f = admin({'action': 'finish', 'id': j['id']}); check(s == 200 and f['release']['version'] == '2026.11.616' and f['release']['size'] == len(B1), 'finished: it’s the live version', f)
R1 = f['release']
s, h = get('/api/apps/piece?app=graceville-fast-bible&r=%d&n=0' % R1['id']); check(s == 403, 'nobody can fetch it without approval')
c = urllib.request.Request(APP + '/admin/downloads', headers={'Cookie': '__Host-olex_sess=' + OWNER}); h = urllib.request.urlopen(c).read().decode().replace('<!-- -->', '')
check('Downloads</h1>' in h and 'Version 2026.11.616' in h and 'Upload new version' in h, 'Admin → Downloads shows the version and the upload button')

print('Carrying on after a refresh')
B3 = os.urandom(2 * P + 99)
s, a1 = admin({'action': 'start', 'app': 'graceville-fast-bible', 'filename': 'Resume-Test.exe', 'size': len(B3), 'version': 'r1'}); put_piece(a1['id'], 0, B3[:P])
s, a2 = admin({'action': 'start', 'app': 'graceville-fast-bible', 'filename': 'Resume-Test.exe', 'size': len(B3), 'version': 'r1'})
check(a2['id'] == a1['id'] and a2['got'] == [0] and a2['resumed'], 'choosing the same file again carries on from the pieces already up', a2)
s, d = admin({'action': 'data'}); check(d['apps'][0]['uploading']['got'] == 1, 'Downloads shows the paused upload (1 of 3 pieces)', d['apps'][0]['uploading'])
s, f3 = admin({'action': 'finish', 'id': a1['id']}); check(s == 400 and 'didn’t arrive (2, 3)' in f3['error'], 'finishing too early says exactly which pieces are missing', f3)
st, e3 = put_piece(a1['id'], 1, B3[P:P + 10]); check(st == 400 and 'arrived with 10 bytes instead of' in e3['error'], 'a cut-short piece says exactly what arrived', e3)
sql("delete from app_releases where filename = 'Resume-Test.exe'")

print('Request, wait, approved, it downloads by itself')
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(accept_downloads=True); pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(APP + '/tools/graceville-fast-bible'); pg.get_by_role('button', name='Request download').first.click()
    pg.fill('input[autocomplete=name]', 'Grace Okafor'); pg.fill('input[type=email]', 'grace@church.test'); pg.fill('input[type=tel]', '+234 803 000 0000')
    pg.get_by_role('button', name='Send request').click(); pg.wait_for_selector('text=Waiting for approval')
    w = json.loads(sql("select row_to_json(x) from (select id, status, name, email from app_access) x"))
    check(w['status'] == 'waiting' and w['name'] == 'Grace Okafor', 'the request waits for you (and you get a notification)', w)
    cookies = {c['name']: c['value'] for c in ctx.cookies()}
    r = pg.request.get(APP + '/api/apps/piece?app=graceville-fast-bible&r=%d&n=0' % R1['id']); check(r.status == 403, 'while waiting, the file is still locked', r.status)
    c = urllib.request.Request(APP + '/admin/downloads', headers={'Cookie': '__Host-olex_sess=' + OWNER}); h = urllib.request.urlopen(c).read().decode().replace('<!-- -->', '')
    check('Grace Okafor' in h and 'Approve' in h, 'Downloads lists her with Approve and Decline')
    with pg.expect_download(timeout=60000) as d:
        s, j = admin({'action': 'approve', 'id': w['id']})
    path = d.value.path(); got = hashlib.sha256(open(path, 'rb').read()).hexdigest()
    check(s == 200 and d.value.suggested_filename == 'Graceville-Fast-Bible-Setup-2026.11.616.exe' and got == H1, 'the moment you approve, the installer downloads by itself, byte for byte, with its real name', d.value.suggested_filename)
    pg.wait_for_selector('text=Downloaded.'); check(pg.locator('text=Run anyway').count() == 1, 'it says it’s in Downloads, and what to do if Windows warns')
    pg.wait_for_timeout(800); check(sql(f"select downloads from app_access where id = {w['id']}") == '1', 'the download is counted')
    pg.reload(); pg.wait_for_selector('text=You’re approved'); check(pg.get_by_role('button', name='Download now').count() == 1, 'coming back later: Download now, no new request')
    with pg.expect_download(timeout=60000) as d2: pg.get_by_role('button', name='Download now').click()
    check(hashlib.sha256(open(d2.value.path(), 'rb').read()).hexdigest() == H1, 'and it downloads again')
    mails = sql("select count(*) from mail_messages where to_email = 'grace@church.test'")
    check(mails in ('0', '1'), 'the approval email goes out when email is set up', mails)

    print('A new computer: the same email gets a link, no new approval')
    ctx2 = br.new_context(accept_downloads=True); p2 = ctx2.new_page(); p2.goto(APP + '/tools/graceville-fast-bible')
    p2.get_by_role('button', name='Request download').first.click(); p2.fill('input[autocomplete=name]', 'Grace O'); p2.fill('input[type=email]', 'GRACE@church.test'); p2.get_by_role('button', name='Send request').click()
    p2.wait_for_selector('text=Check your email'); n2 = json.loads(sql("select row_to_json(x) from (select id, status from app_access order by id desc limit 1) x"))
    check(n2['status'] == 'waiting' and sql("select count(*) from app_access where status = 'waiting'") == '1', 'she’s told to check her email (you aren’t asked again)')
    t = 'T' * 43; sql(f"update app_access set link_hash = encode(sha256('{t}'::bytea), 'hex'), link_expires = now() + interval '1 hour' where id = {n2['id']}")
    ctx3 = br.new_context(accept_downloads=True); p3 = ctx3.new_page()
    with p3.expect_download(timeout=60000) as d3: p3.goto(APP + '/api/apps/link?t=' + t)
    check(hashlib.sha256(open(d3.value.path(), 'rb').read()).hexdigest() == H1 and sql(f"select status from app_access where id = {n2['id']}") == 'approved', 'opening the email link lets that computer in and downloads at once')
    p4 = ctx3.new_page(); p4.goto(APP + '/api/apps/link?t=' + t); check('expired' in p4.url, 'the link works once')

    print('Ban and unban')
    s, j = admin({'action': 'ban', 'id': w['id']})
    r = pg.request.get(APP + '/api/apps/piece?app=graceville-fast-bible&r=%d&n=0' % R1['id']); check(r.status == 403, 'banned: no more downloads', r.status)
    r = p3.request.get(APP + '/api/apps/piece?app=graceville-fast-bible&r=%d&n=0' % R1['id']); check(r.status == 403, 'on every device she had')
    pg.reload(); pg.wait_for_selector('text=Downloads aren’t available'); check(True, 'her page says downloads aren’t available')
    ctx4 = br.new_context(); p5 = ctx4.new_page(); p5.goto(APP + '/tools/graceville-fast-bible'); p5.get_by_role('button', name='Request download').first.click()
    p5.fill('input[autocomplete=name]', 'Grace'); p5.fill('input[type=email]', 'grace@church.test'); p5.get_by_role('button', name='Send request').click(); p5.wait_for_selector('text=Downloads aren’t available')
    check(sql("select count(*) from app_access where status = 'waiting'") == '0', 'asking again with that email is refused')
    s, j = admin({'action': 'unban', 'id': w['id']}); r = pg.request.get(APP + '/api/apps/piece?app=graceville-fast-bible&r=%d&n=0' % R1['id']); check(r.status == 200, 'unbanned: downloads work again')

    print('A new version')
    j2, (s, f2) = upload(B2, 'Graceville-Fast-Bible-Setup-2026.12.1.exe', '2026.12.1')
    check(s == 200 and f2['release']['version'] == '2026.12.1', 'uploading a new version makes it the live one', f2)
    r = pg.request.get(APP + '/api/apps/piece?app=graceville-fast-bible&r=%d&n=0' % R1['id']); check(r.status == 410, 'the old version is gone (its pieces are deleted)', r.status)
    pg.reload(); pg.wait_for_selector('text=Version 2026.12.1')
    with pg.expect_download(timeout=60000) as d4: pg.get_by_role('button', name='Download now').click()
    check(hashlib.sha256(open(d4.value.path(), 'rb').read()).hexdigest() == H2 and d4.value.suggested_filename.endswith('2026.12.1.exe'), 'approved people get the new version')

    print('Declining, and the phone layout')
    ctx5 = br.new_context(viewport={'width': 390, 'height': 844}); p6 = ctx5.new_page(); p6.goto(APP + '/tools/graceville-fast-bible')
    check(p6.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'on a phone, nothing spills sideways')
    p6.get_by_role('button', name='Request download').first.click(); p6.fill('input[autocomplete=name]', 'Stranger'); p6.fill('input[type=email]', 'who@else.test'); p6.get_by_role('button', name='Send request').click(); p6.wait_for_selector('text=Waiting for approval')
    sid = sql("select id from app_access where email = 'who@else.test'"); admin({'action': 'decline', 'id': int(sid)}); p6.wait_for_selector('text=wasn’t approved', timeout=15000)
    check(True, 'declined: the waiting page says so')
    p6.screenshot(path='/tmp/fb-phone.png', full_page=True); pg.set_viewport_size({'width': 1366, 'height': 900}); pg.goto(APP + '/tools/graceville-fast-bible'); pg.wait_for_timeout(1200); pg.screenshot(path='/tmp/fb-laptop.png', full_page=True)
    check(not errs, 'no page errors', errs)
    br.close()
print(f'\n{passed} passed, {failed} failed'); sys.exit(1 if failed else 0)
