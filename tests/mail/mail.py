# Olexweb Mail: routing across pipes (own server → Resend → Mailjet), failover in the same request, resting pipes,
# daily limits, Mailjet's format, rejected addresses, the do-not-send list, and the admin screen. Pipes: tests/mail/mock-pipes.mjs.
import json, sys, urllib.request
from playwright.sync_api import sync_playwright
exec(open('tests/meet/e2e.py').read().split("OWNER, EDITOR = ")[0])            # helpers: session, req, sql, check, APP, SHOTS
OWNER, EDITOR = session('owner@test.local'), session('editor@test.local')
def ctl(body): urllib.request.urlopen(urllib.request.Request('http://localhost:4568/control', data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'}))
def plog(): return json.loads(urllib.request.urlopen('http://localhost:4568/log').read())
def mail(body, who=None): return req('/admin/api/mail', body, OWNER if who is None else who)
def test(to='olaitan@example.com'): return mail({'action': 'test', 'to': to})
sql("delete from mail_messages; delete from mail_suppressions; delete from mail_pipe_days; delete from mail_pipes")

print('The pipes')
s, o = mail({'action': 'overview'})
check(s == 200 and [p['pipe'] for p in o['pipes']] == ['own', 'resend', 'mailjet'] and all(p['ready'] for p in o['pipes']), 'three pipes, in order: your server, Resend, Mailjet')
check(o['from'] == 'Olexweb Meet <meet@olexweb.com>', 'sending as ' + o['from'])
ctl({'reset': True, 'mode': {'own': 'ok', 'resend': 'ok', 'mailjet': 'ok'}})
s, j = test(); check(s == 200 and j['pipe'] == 'own' and [x['pipe'] for x in plog()] == ['own'], 'an email goes through your own server first')
check(plog()[0]['auth'] == 'Bearer', 'your server is called with its secret token')

print('When a pipe fails')
ctl({'reset': True, 'mode': {'own': 'down'}}); s, j = test()
check(s == 200 and j['pipe'] == 'resend' and [x['pipe'] for x in plog()] == ['own', 'resend'], 'your server down: the same email goes through Resend at once')
m = json.loads(sql("select row_to_json(x) from (select status, pipe, tries from mail_messages order by id desc limit 1) x"))
check(m['status'] == 'sent' and m['tries'][0]['pipe'] == 'own' and 'error' in m['tries'][0], 'the log shows both tries')
s, o = mail({'action': 'overview'}); own = o['pipes'][0]
check(own['resting'] and own['lastError'] and '503' in own['lastError'], 'your server rests for a while: ' + str(own['lastError']))
ctl({'reset': True}); s, j = test(); check(j['pipe'] == 'resend' and [x['pipe'] for x in plog()] == ['resend'], 'while it rests, it isn’t tried (no delay for people)')
sql("update mail_pipes set rest_until = now() - interval '1 second' where pipe = 'own'"); ctl({'reset': True, 'mode': {'own': 'ok'}})
s, j = test(); check(j['pipe'] == 'own', 'after its rest it’s used again, first')
check(sql("select fails || ' ' || (rest_until is null) from mail_pipes where pipe = 'own'") == '0 true', 'and its failure count resets')

print('Daily limits')
sql("delete from mail_pipe_days"); ctl({'reset': True, 'mode': {'own': 'down'}})
pipes = []
for i in range(5):
    sql("update mail_pipes set rest_until = now() - interval '1 second' where pipe = 'own'")         # keep trying own, so it keeps falling over
    s, j = test(); pipes.append(j.get('pipe'))
check(pipes[:3] == ['resend'] * 3 and pipes[3:] == ['mailjet'] * 2, f'Resend’s daily limit (3 here) is respected, then Mailjet takes over: {pipes}')
mj = [x for x in plog() if x['pipe'] == 'mailjet']
check(mj and mj[0]['auth'] == 'Basic' and mj[0]['tracking'] == ['disabled', 'disabled'] and mj[0]['hasText'], 'Mailjet: signed in, open and click tracking off, plain-text version included')
check(sql("select sent from mail_pipe_days where pipe = 'resend'") == '3' and sql("select sent from mail_pipe_days where pipe = 'own'") in ('0', ''), 'failed tries don’t count toward a pipe’s limit')
s, o = mail({'action': 'overview'}); r = o['pipes'][1]; check(r['today'] == 3 and r['dayLimit'] == 3, 'the admin shows Resend at 3 of 3 today')

print('When nothing can send')
sql("delete from mail_pipe_days; delete from mail_pipes"); ctl({'reset': True, 'mode': {'own': 'down', 'resend': 'down', 'mailjet': 'down'}})
s, j = test(); check(s == 400 and 'couldn’t be sent right now' in j.get('error', ''), 'every pipe down: a plain message, “' + j.get('error', '') + '”')
check(sql("select status from mail_messages order by id desc limit 1") == 'failed', 'logged as failed')

print('Bad addresses and the do-not-send list')
sql("delete from mail_pipes"); ctl({'reset': True, 'mode': {'own': 'reject', 'resend': 'ok', 'mailjet': 'ok'}})
s, j = test('no-such-person@example.com'); check(s == 400 and 'rejected' in j.get('error', '') and [x['pipe'] for x in plog()] == ['own'], 'a rejected address stops at once (no other pipe would do better)')
s, j = test('not an address'); check(s == 400 and 'doesn’t look right' in j.get('error', ''), 'a mistyped address is caught before sending')
ctl({'reset': True, 'mode': {'own': 'ok'}})
mail({'action': 'suppress', 'email': 'Spam.Trap@Example.com', 'note': 'test'})
s, j = test('spam.trap@example.com'); check(s == 400 and 'can’t send email to that address' in j.get('error', '') and plog() == [], 'the do-not-send list is checked first (no pipe is even called)')
check(sql("select status from mail_messages order by id desc limit 1") == 'suppressed', 'logged as not sent')
s, l = mail({'action': 'suppressions'}); check(l['list'][0]['email'] == 'spam.trap@example.com' and l['list'][0]['note'] == 'test', 'the list, in lowercase, with your note')
mail({'action': 'unsuppress', 'email': 'spam.trap@example.com'}); s, j = test('spam.trap@example.com'); check(s == 200, 'allowed again, it sends')

print('Delivery reports (bounces and spam complaints)')
import base64, hmac, hashlib, time
SECRET = 'whsec_' + base64.b64encode(b'olexweb-test-webhook-secret-32b!').decode()
def hook(path, body, headers=None):
    data = json.dumps(body).encode(); r = urllib.request.Request(APP + path, data=data, headers={'Content-Type': 'application/json', **(headers or {})})
    try:
        with urllib.request.urlopen(r) as x: return x.status
    except urllib.error.HTTPError as e: return e.code
def signed(body, ts=None, secret=SECRET):
    raw = json.dumps(body); ts = str(int(ts or time.time())); mid = 'msg_' + ts
    sig = base64.b64encode(hmac.new(base64.b64decode(secret[6:]), f'{mid}.{ts}.{raw}'.encode(), hashlib.sha256).digest()).decode()
    return {'svix-id': mid, 'svix-timestamp': ts, 'svix-signature': 'v1,' + sig}
sql("delete from mail_pipes; delete from mail_pipe_days; delete from mail_suppressions"); ctl({'reset': True, 'mode': {'own': 'down', 'resend': 'ok', 'mailjet': 'ok'}})
s, j = test('ghost@example.com'); pid = sql(f"select provider_id from mail_messages where id = {j['id']}")
bounce = {'type': 'email.bounced', 'created_at': '2026-11-04T10:00:00Z', 'data': {'email_id': pid, 'to': ['ghost@example.com'], 'bounce': {'type': 'Permanent', 'subType': 'General', 'message': 'mailbox does not exist'}}}
check(hook('/api/mail/events/resend', bounce, {'svix-id': 'x', 'svix-timestamp': str(int(time.time())), 'svix-signature': 'v1,forged'}) == 401, 'a forged Resend report is refused')
check(hook('/api/mail/events/resend', bounce) == 401, 'an unsigned one too')
check(hook('/api/mail/events/resend', bounce, signed(bounce, time.time() - 900)) == 401, 'and a genuine one replayed 15 minutes later')
check(sql("select count(*) from mail_suppressions") == '0', 'none of those changed anything')
check(hook('/api/mail/events/resend', bounce, signed(bounce)) == 200, 'a genuine signed bounce is accepted')
check(sql("select reason || ' | ' || note from mail_suppressions where email = 'ghost@example.com'") == 'bounce | General: mailbox does not exist', 'the address goes on the do-not-send list, with the reason')
check(sql(f"select status from mail_messages where id = {j['id']}") == 'bounced', 'and the email shows as bounced in the log')
s, j2 = test('full.box@example.com'); pid2 = sql(f"select provider_id from mail_messages where id = {j2['id']}")
soft = {'type': 'email.bounced', 'data': {'email_id': pid2, 'to': ['full.box@example.com'], 'bounce': {'type': 'Transient', 'subType': 'MailboxFull', 'message': 'mailbox full'}}}
hook('/api/mail/events/resend', soft, signed(soft)); check(sql("select count(*) from mail_suppressions where email = 'full.box@example.com'") == '0', 'a temporary bounce (full mailbox) is only noted, not blocked')
comp = {'type': 'email.complained', 'data': {'email_id': pid2, 'to': ['full.box@example.com']}}
hook('/api/mail/events/resend', comp, signed(comp)); check(sql("select reason from mail_suppressions where email = 'full.box@example.com'") == 'complaint', 'a spam complaint blocks the address')
mail({'action': 'suppress', 'email': 'mine@example.com', 'note': 'asked to stop'}); b2 = {**bounce, 'data': {**bounce['data'], 'to': ['mine@example.com']}}
hook('/api/mail/events/resend', b2, signed(b2)); check(sql("select reason from mail_suppressions where email = 'mine@example.com'") == 'manual', 'an address you added by hand keeps your reason')
TOKEN = 'mj-events-token-0123456789abcdef'
check(hook('/api/mail/events/mailjet?token=wrong', [{'event': 'spam', 'email': 'x@example.com'}]) == 401, 'Mailjet reports without the secret token are refused')
check(hook(f'/api/mail/events/mailjet?token={TOKEN}', [{'event': 'bounce', 'email': 'MJ.Bad@Example.com', 'hard_bounce': True, 'error': 'user unknown'}, {'event': 'spam', 'email': 'mj.spam@example.com'}, {'event': 'bounce', 'email': 'mj.soft@example.com', 'hard_bounce': False}]) == 200, 'genuine Mailjet reports are accepted')
check(sql("select string_agg(email || ':' || reason, ',' order by email) from mail_suppressions where email like 'mj.%'") == 'mj.bad@example.com:bounce,mj.spam@example.com:complaint', 'Mailjet: a hard bounce and a complaint are blocked; a soft bounce isn’t')
check(hook('/api/mail/events/own', [{'email': 'own.bad@example.com', 'kind': 'bounce'}], {'Authorization': 'Bearer wrong'}) == 401, 'reports claiming to be from your server need its token')
check(hook('/api/mail/events/own', [{'email': 'own.bad@example.com', 'kind': 'bounce', 'detail': '550 no such user'}], {'Authorization': 'Bearer t'}) == 200 and sql("select reason from mail_suppressions where email = 'own.bad@example.com'") == 'bounce', 'your server’s bounce reports work')
s, j = test('ghost@example.com'); check(s == 400 and 'can’t send email to that address' in j.get('error', ''), 'and Olexweb Mail no longer sends to a bounced address')

print('Who can use it')
s, j = mail({'action': 'overview'}, EDITOR); check(s == 403, 'an editor can’t')
s, j = req('/admin/api/mail', {'action': 'overview'}); check(s == 401, 'nobody signed out can')

print('On screen')
with sync_playwright() as pw:
    b = pw.chromium.launch(); c = b.new_context(viewport={'width': 1280, 'height': 900})
    c.add_cookies([{'name': '__Host-olex_sess', 'value': OWNER, 'domain': 'localhost', 'path': '/', 'secure': True, 'httpOnly': True, 'sameSite': 'Strict'}])
    P = c.new_page(); errs = []; P.on('pageerror', lambda e: errs.append(str(e)[:90])); P.goto(APP + '/admin/mail'); P.wait_for_selector('.ml-pipe', timeout=10000)
    check(P.locator('.side-nav a:has-text("Mail")').count() == 1, 'Mail is in the sidebar')
    P.wait_for_selector('.ml-table tbody tr', timeout=10000)                  # the log loads just after the pipes
    check(P.locator('.ml-pipe').count() == 3 and P.locator('.ml-table tbody tr').count() >= 10, 'the pipes and the sent log are shown')
    P.fill('.ml-test input', 'screen@example.com'); P.click('.ml-test button'); P.wait_for_selector('.toast:has-text("Sent through")', timeout=10000)
    check(True, 'Send test works from the screen: ' + P.locator('.toast').inner_text())
    P.click('.ml-tabs button:has-text("Do-not-send")'); P.fill('.ml-add input[type=email]', 'blocked@example.com'); P.click('.ml-add button')
    P.wait_for_selector('.mg-list li:has-text("blocked@example.com")', timeout=8000); check(True, 'an address can be added to the do-not-send list from the screen')
    P.screenshot(path=SHOTS + '/26-mail.png', full_page=True)
    P.click('.ml-tabs button:has-text("Sent")'); P.screenshot(path=SHOTS + '/27-mail-log.png', full_page=True)
    check(not errs, 'no page errors', errs)
    b.close()
print(f'\n{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
