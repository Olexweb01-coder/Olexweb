# Install 5 (email sign-in): create an account with a code, sign in with a password or an emailed code, forgot password,
# safety (hashes, limits, no revealing who has an account, bans), one account with Google, and the owner.
# Emails go through Olexweb Mail to the pipe stand-in (tests/mail/mock-pipes.mjs); the test reads codes from them.
import json, re, sys, urllib.request
from playwright.sync_api import sync_playwright
exec(open('tests/meet/app.py').read().split("print('The Meet address')")[0])            # helpers: raw, req, sql, oauth, MEET, OWNER
def mails(): return json.loads(urllib.request.urlopen('http://localhost:4568/log').read())
def ctl(body): urllib.request.urlopen(urllib.request.Request('http://localhost:4568/control', data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'}))
def code_for(addr): m = [x for x in mails() if x['to'] == addr and re.match(r'^\d{6} is your', x['subject'] or '')]; return m[-1]['subject'][:6] if m else None
def api(body, cookie=None):
    h = {'Content-Type': 'application/json', 'Origin': MEET, 'Host': 'meet.localhost:3000', **({'Cookie': cookie} if cookie else {})}
    r = urllib.request.Request(APP + '/api/meet/email', data=json.dumps(body).encode(), headers=h)
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.loads(x.read()), x.headers.get('set-cookie', '')
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}'), ''
sql("delete from meet_codes; delete from meet_login_fails; delete from mail_pipe_days; delete from mail_pipes; delete from mail_suppressions")
sql("delete from meetings where host_user in (select id from meet_users where email like '%@mailtest.local')"); sql("delete from meet_users where email like '%@mailtest.local'")
ctl({'reset': True, 'mode': {'own': 'ok', 'resend': 'ok', 'mailjet': 'ok'}})
OWNER_EMAIL = sql("select email from admin_users where role = 'owner' limit 1")

print('Creating an account')
with sync_playwright() as pw:
    b = pw.chromium.launch(); errs = []
    A = b.new_context(viewport={'width': 1280, 'height': 900}).new_page(); A.on('pageerror', lambda e: errs.append(str(e)[:90])); A.goto(MEET + '/')
    A.click('button:has-text("New meeting")'); A.click('button:has-text("Schedule a meeting")'); A.wait_for_selector('.es-or')
    check(A.locator('.mh-provider').count() >= 1 and A.locator('.es input[type=password]').count() == 1, 'the sign-in sheet offers Google and email')
    A.click('.es-switch button:has-text("Create an account")')
    A.fill('.es input[autocomplete=name]', 'Kemi Bello'); A.fill('.es input[type=email]', 'kemi@mailtest.local'); A.fill('.es input[type=password]', 'password1')
    A.click('.es button:has-text("Create account")'); A.wait_for_selector('.es-err', timeout=8000); check('too easy to guess' in A.locator('.es-err').inner_text(), 'a common password is refused: “' + A.locator('.es-err').inner_text() + '”')
    A.fill('.es input[type=password]', 'blue-river-42-sunset'); A.click('.es button:has-text("Create account")'); A.wait_for_selector('.es-code', timeout=10000)
    check(sql("select count(*) from meet_users where email = 'kemi@mailtest.local'") == '0', 'no account exists until the email is confirmed')
    m = [x for x in mails() if x['to'] == 'kemi@mailtest.local'][-1]; code = m['subject'][:6]
    check(m['pipe'] == 'own' and re.match(r'^\d{6} is your Olexweb Meet code$', m['subject']) and 'Confirm your email' in m['html'] and code in m['text'], f'the code email goes out through Olexweb Mail (your server first): “{m["subject"]}”')
    check(code not in json.dumps(sql("select string_agg(code_hash || coalesce(pw_hash, ''), '') from meet_codes")), 'the code is stored only as a hash')
    A.fill('.es-code', '000000' if code != '000000' else '111111'); A.click('.es button:has-text("Confirm")'); A.wait_for_selector('.es-err', timeout=8000)
    check('isn’t right' in A.locator('.es-err').inner_text(), 'a wrong code is refused')
    A.fill('.es-code', code); A.click('.es button:has-text("Confirm")'); A.wait_for_selector('.mh-schedule, #mh-sheet-h:has-text("Schedule a meeting")', timeout=15000)
    check(True, 'the right code creates the account, signs her in, and carries on to scheduling')
    u = json.loads(sql("select row_to_json(x) from (select name, email_verified, password_hash, role from meet_users where email = 'kemi@mailtest.local') x"))
    check(u['name'] == 'Kemi Bello' and u['email_verified'] and u['role'] == 'user', 'the account: her name, verified email')
    check(u['password_hash'].startswith('scrypt$16384$8$1$') and 'blue-river' not in u['password_hash'], 'the password is stored only as a scrypt hash')
    A.wait_for_timeout(1500); w = [x for x in mails() if x['to'] == 'kemi@mailtest.local' and x['subject'] == 'Welcome to Olexweb Meet']
    check(len(w) == 1 and 'Open Olexweb Meet' in w[0]['html'], 'a welcome email follows')
    A.screenshot(path=SHOTS + '/28-email-signed-in.png')

    print('Signing in')
    B = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True).new_page(); B.on('pageerror', lambda e: errs.append(str(e)[:90])); B.goto(MEET + '/')
    B.click('.mh-top button:has-text("Sign in")'); B.fill('.es input[type=email]', 'kemi@mailtest.local'); B.fill('.es input[type=password]', 'wrong-password-1')
    B.click('.es button:has-text("Sign in")'); B.wait_for_selector('.es-err', timeout=8000); check(B.locator('.es-err').inner_text() == 'Wrong email or password.', 'a wrong password: “Wrong email or password.”')
    B.screenshot(path=SHOTS + '/29-email-signin-phone.png')
    B.fill('.es input[type=password]', 'blue-river-42-sunset'); B.click('.es button:has-text("Sign in")'); B.wait_for_selector('.mh-me', timeout=10000); check(True, 'the right password signs her in (on a phone)')
    s, j, _ = api({'action': 'password', 'email': 'nobody@mailtest.local', 'password': 'whatever-123'}); check(s == 400 and j['error'] == 'Wrong email or password.', 'an address with no account gets the same answer (nothing revealed)')
    n0 = len(mails()); s, j, _ = api({'action': 'code', 'email': 'nobody@mailtest.local', 'purpose': 'signin'})
    check(s == 200 and 'If that address can sign in' in j['message'] and len(mails()) == n0, 'asking a code for an unknown address: the same answer, and no email is sent')
    sql("update meet_codes set created_at = created_at - interval '2 minutes' where lower(email) = 'kemi@mailtest.local'")   # a couple of minutes later
    s, j, ck = api({'action': 'code', 'email': 'kemi@mailtest.local', 'purpose': 'signin'}); c2 = code_for('kemi@mailtest.local')
    check(s == 200 and c2 and 'Your sign-in code' in [x for x in mails() if x['to'] == 'kemi@mailtest.local'][-1]['html'], 'Email me a code: a sign-in code arrives')
    s, j, _ = api({'action': 'code', 'email': 'kemi@mailtest.local', 'purpose': 'signin'}); check(s == 429 and 'Wait a minute' in j['error'], 'asking again at once: “' + j['error'] + '”')
    s, j, ck = api({'action': 'verify', 'email': 'kemi@mailtest.local', 'code': c2}); check(s == 200 and '__Host-meet_sess=' in ck and 'HttpOnly' in ck, 'the code signs her in (secure cookie)')
    s, j, _ = api({'action': 'verify', 'email': 'kemi@mailtest.local', 'code': c2}); check(s == 400, 'a code works only once')

    print('Forgot password')
    sql("delete from meet_codes where lower(email) = 'kemi@mailtest.local'")
    s, j, _ = api({'action': 'code', 'email': 'kemi@mailtest.local', 'purpose': 'reset'}); c3 = code_for('kemi@mailtest.local')
    check('Reset your password' in [x for x in mails() if x['to'] == 'kemi@mailtest.local'][-1]['html'], 'a reset code arrives')
    s, j, _ = api({'action': 'verify', 'email': 'kemi@mailtest.local', 'code': c3, 'password': 'short'}); check(s == 400 and '8 characters' in j['error'], 'the new password is checked first (and the code isn’t used up)')
    sessions_before = int(sql("select count(*) from meet_sessions s join meet_users u on u.id = s.user_id where u.email = 'kemi@mailtest.local'"))
    s, j, ck = api({'action': 'verify', 'email': 'kemi@mailtest.local', 'code': c3, 'password': 'green-hills-77-dawn'}); check(s == 200 and '__Host-meet_sess=' in ck, 'with a good new password: saved, and signed in')
    check(sessions_before >= 2 and sql("select count(*) from meet_sessions s join meet_users u on u.id = s.user_id where u.email = 'kemi@mailtest.local'") == '1', 'a new password signs out everywhere else')
    s, j, _ = api({'action': 'password', 'email': 'kemi@mailtest.local', 'password': 'blue-river-42-sunset'}); check(s == 400, 'the old password no longer works')
    s, j, _ = api({'action': 'password', 'email': 'kemi@mailtest.local', 'password': 'green-hills-77-dawn'}); check(s == 200, 'the new one does')

    print('Limits')
    sql("delete from meet_codes where lower(email) = 'kemi@mailtest.local'"); api({'action': 'code', 'email': 'kemi@mailtest.local', 'purpose': 'signin'})
    for i in range(5): s, j, _ = api({'action': 'verify', 'email': 'kemi@mailtest.local', 'code': '999999' if i % 2 else '888888'})
    check('Too many wrong codes' in j['error'], 'five wrong codes: “' + j['error'] + '”')
    s, j, _ = api({'action': 'verify', 'email': 'kemi@mailtest.local', 'code': code_for('kemi@mailtest.local')}); check(s == 400 and 'expired' in j['error'], 'after that, even the right code no longer works')
    sql("update meet_codes set expires_at = now() - interval '1 second' where lower(email) = 'kemi@mailtest.local'")
    for i in range(8): api({'action': 'password', 'email': 'kemi@mailtest.local', 'password': f'wrong-pass-{i}x'})
    s, j, _ = api({'action': 'password', 'email': 'kemi@mailtest.local', 'password': 'green-hills-77-dawn'}); check(s == 429 and 'Wait 15 minutes' in j['error'], 'eight wrong passwords pause password sign-in (even the right one): “' + j['error'] + '”')
    sql("delete from meet_login_fails")

    print('One account, and the owner')
    oauth({'as': {'google': {'sub': 'g-kemi', 'email': 'kemi@mailtest.local', 'email_verified': True, 'name': 'Kemi B'}}})
    G = b.new_context().new_page(); G.goto(MEET + '/api/meet/auth/google?next=/'); G.wait_for_url(MEET + '/', timeout=15000)
    check(sql("select count(*) from meet_users where email = 'kemi@mailtest.local'") == '1' and sql("select string_agg(provider, ',' order by provider) from meet_identities i join meet_users u on u.id = i.user_id where u.email = 'kemi@mailtest.local'") == 'email,google',
          'Google with the same verified address is the same account (two ways in)')
    sql(f"delete from meet_users where lower(email) = lower('{OWNER_EMAIL}')")
    s, j, _ = api({'action': 'signup', 'name': 'Olaitan', 'email': OWNER_EMAIL, 'password': 'owner-pass-2026-x'}); oc = code_for(OWNER_EMAIL.lower())
    s, j, _ = api({'action': 'verify', 'email': OWNER_EMAIL, 'code': oc}); check(s == 200 and sql(f"select role from meet_users where lower(email) = lower('{OWNER_EMAIL}')") == 'owner', 'signing up with your admin email (confirmed by code) makes you the owner')
    sql("update meet_users set banned_at = now() where email = 'kemi@mailtest.local'")
    s, j, _ = api({'action': 'password', 'email': 'kemi@mailtest.local', 'password': 'green-hills-77-dawn'}); check(s == 403, 'a banned account can’t sign in by email either')
    n0 = len(mails()); api({'action': 'code', 'email': 'kemi@mailtest.local', 'purpose': 'signin'}); check(len(mails()) == n0, 'and gets no codes')

    print('When email can’t go out')
    sql("update meet_users set banned_at = null where email = 'kemi@mailtest.local'; delete from meet_codes; delete from mail_pipes")
    ctl({'mode': {'own': 'down', 'resend': 'down', 'mailjet': 'down'}})
    s, j, _ = api({'action': 'code', 'email': 'kemi@mailtest.local', 'purpose': 'signin'}); check(s == 400 and 'couldn’t be sent' in j['error'], 'every pipe down: a plain message, “' + j['error'] + '”')
    ctl({'mode': {'own': 'ok', 'resend': 'ok', 'mailjet': 'ok'}})
    check(not errs, 'no page errors', errs)
    b.close()
print(f'\n{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
