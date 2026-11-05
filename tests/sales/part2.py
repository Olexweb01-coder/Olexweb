# Olex Sales part 2: reading replies (threads, opt-outs by plain code, out-of-office, bounces and the bounce pause),
# drafted answers with the booking link, follow-ups only without replies, and "Book a call with Olaitan".
import json, re, sys, urllib.request
from playwright.sync_api import sync_playwright
exec(open('tests/meet/e2e.py').read().split("OWNER, EDITOR = ")[0])            # helpers: session, req, sql, check, APP, SHOTS
OWNER = session('owner@test.local')
SECRET, MEET = 'test-cron-secret-0123456789', 'http://meet.localhost:3000'
def api(body): return req('/admin/api/sales', body, OWNER)
def ctl(body): urllib.request.urlopen(urllib.request.Request('http://localhost:4570/control', data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'}))
def mlog(kind=None, role=None): l = json.loads(urllib.request.urlopen('http://localhost:4570/log').read()); return [x for x in l if (not kind or x['kind'] == kind) and (not role or x.get('role') == role)]
def mails(): return json.loads(urllib.request.urlopen('http://localhost:4568/log').read())
def cron(): urllib.request.urlopen(urllib.request.Request(APP + '/api/assistant/cron?run=due', headers={'authorization': 'Bearer ' + SECRET}), timeout=120).read()
def pub(path, body=None, method=None):
    r = urllib.request.Request(APP + path, data=json.dumps(body).encode() if body is not None else None, method=method, headers={'Content-Type': 'application/json', 'Origin': APP})
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.loads(x.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
sql("delete from sales_bookings; delete from sales_replies; delete from sales_outbox; delete from sales_contacts; delete from sales_signals; delete from sales_companies; delete from sales_dnc; delete from meetings where title like 'Call with %'")
sql("update sales_settings set enabled = true, require_approval = true, daily_cap = 20, start_date = '2026-01-01', postal_address = '12 Example Street, Lagos', imap_uid = 0, paused_reason = null, call_hours = '{\"days\":[1,2,3,4,5],\"from\":\"14:00\",\"to\":\"18:00\"}'")
ctl({'reset': True, 'ai': 'good'}); urllib.request.urlopen(urllib.request.Request('http://localhost:4568/control', data=b'{"reset": true}', headers={'Content-Type': 'application/json'}))
def contacted(name, email, days_ago=1, msgid=None):     # a business already emailed (step 1 sent)
    cid = sql(f"insert into sales_companies (name, domain, country, city, category, source, source_ref, status, score) values ('{name}', '{email.split('@')[1]}', 'US', 'Austin TX', 'Dentists', 'manual', '{name}', 'contacted', 8) returning id").split('\n')[0]
    kid = sql(f"insert into sales_contacts (company_id, email, email_status) values ({cid}, '{email}', 'deliverable') returning id").split('\n')[0]
    sql(f"insert into sales_outbox (company_id, contact_id, step, subject, body, status, sent_at, message_id) values ({cid}, {kid}, 1, '{name.lower()} website on phones', 'Hi, your site is slow on phones. Would a quick idea help?\n\nOlaitan\nOlexweb', 'sent', now() - interval '{days_ago} days', '{msgid or '<' + name.replace(' ', '') + '@gmail.test>'}')")
    return int(cid)
A = contacted('Alpha Dental', 'ann@alpha.test', msgid='<alpha1@gmail.test>'); B = contacted('Beta Salon', 'bob@beta.test'); C = contacted('Gamma Cafe', 'cat@gamma.test')
D = contacted('Delta Law', 'dan@delta.test'); E = contacted('Echo Clinic', 'eve@echo.test', days_ago=4); F = contacted('Fox Plumbing', 'fay@fox.test', days_ago=4)

print('Reading replies')
ctl({'inbox': [
  {'from': 'ann@alpha.test', 'subject': 'Re: alpha dental website on phones', 'text': 'Hi Olaitan, I would love to hear your ideas.\n\nOn Tue, Olaitan wrote:\n> Hi, your site is slow', 'messageId': '<ann-reply@alpha.test>', 'inReplyTo': '<alpha1@gmail.test>'},
  {'from': 'bob@beta.test', 'subject': 'Re: beta salon website on phones', 'text': 'No thanks, please remove me from your list.', 'messageId': '<b@beta.test>'},
  {'from': 'cat@gamma.test', 'subject': 'Automatic reply: gamma cafe website on phones', 'text': 'I am out of the office until Monday.', 'messageId': '<c@gamma.test>', 'auto': True},
  {'from': 'mailer-daemon@googlemail.com', 'subject': 'Delivery Status Notification (Failure)', 'text': "Address not found\nYour message wasn't delivered to dan@delta.test because the address couldn't be found.", 'messageId': '<d@g.test>'},
  {'from': 'stranger@else.test', 'subject': 'Hello', 'text': 'Random email', 'messageId': '<s@else.test>'}]})
ai_before = len(mlog('ai')); cron()
r = json.loads(sql(f"select row_to_json(x) from (select intent, summary, body from sales_replies where company_id = {A}) x"))
check(r['intent'] == 'interested' and r['body'] == 'Hi Olaitan, I would love to hear your ideas.', 'a reply is matched to its email by thread, sorted as “interested”, and only their new words are kept')
check(sql(f"select status from sales_companies where id = {A}") == 'replied', 'the business is marked as replied')
ans = json.loads(sql(f"select row_to_json(o) from sales_outbox o where company_id = {A} and step = 9"))
tok = re.search(r'/book\?t=([\w.-]+)', ans['body'])
check(ans['status'] == 'waiting' and ans['subject'] == 'Re: alpha dental website on phones' and tok and ans['in_reply_to'] == '<ann-reply@alpha.test>', 'an answer is drafted in the same thread, with your booking link, waiting for your approval')
check(sql(f"select (select status from sales_companies where id = {B}) || ' ' || (select count(*) from sales_dnc where entry = 'bob@beta.test')") == 'opted_out 1', '“No thanks, please remove me”: never contacted again')
check(not [x for x in mlog('ai')[ai_before:] if 'remove me' in x['prompt']], 'opt-outs are decided by plain code (the AI never sees them)')
check(sql(f"select status || ' ' || (next_touch_after > now() + interval '4 days') from sales_companies where id = {C}") == 'contacted true', 'an out-of-office reply only pushes follow-ups back')
check(sql(f"select (select status from sales_companies where id = {D}) || ' ' || (select email_status from sales_contacts where company_id = {D})") == 'bounced bounced', 'a “not delivered” notice marks the address as bounced')
check(sql("select count(*) from sales_replies where from_email = 'stranger@else.test'") == '0', 'emails that aren’t replies to Olex Sales are left alone')
check(sql("select imap_uid from sales_settings") == '105', 'each message is read once')
cron(); check(sql("select count(*) from sales_replies") == '4', 'and never twice')

print('Follow-ups')
E1 = sql(f"select message_id from sales_outbox where company_id = {E}"); cron()
fu = json.loads(sql(f"select row_to_json(o) from sales_outbox o where company_id = {E} and step = 2"))
check(fu['subject'] == 'Re: echo clinic website on phones' and fu['in_reply_to'] == E1 and fu['status'] == 'waiting', '3 days after the first email: a short follow-up in the same thread, for your approval')
check(sql(f"select count(*) from sales_outbox where company_id = {A} and step = 2") == '0' and sql(f"select count(*) from sales_outbox where company_id = {C} and step = 2") == '0', 'none for businesses that replied, or are out of office')
api({'action': 'approve', 'id': fu['id']}); cron(); g = [x for x in mlog('gmail') if x['to'] == 'eve@echo.test']
check(len(g) == 1 and g[0]['inReplyTo'] == E1, 'it goes out threaded under the first email')
sql(f"update sales_outbox set sent_at = now() - interval '5 days' where company_id = {E} and step = 2"); sql("update sales_outbox set sent_at = sent_at - interval '13 minutes' where status = 'sent' and sent_at > now() - interval '1 hour'")
cron(); check(sql(f"select count(*) from sales_outbox where company_id = {E} and step = 3") == '1', '4 days later: the last, gentle follow-up')
sql(f"update sales_outbox set status = 'sent', sent_at = now() - interval '9 days', message_id = '<e3@gmail.test>' where company_id = {E} and step = 3"); cron()
check(sql(f"select max(step) from sales_outbox where company_id = {E}") == '3', 'and never a fourth')

print('Answers to replies')
sql("update sales_outbox set sent_at = sent_at - interval '13 minutes' where status = 'sent'"); sql("update sales_settings set daily_cap = 1, start_date = '2026-01-01'")
api({'action': 'approve', 'id': ans['id']}); cron(); g = [x for x in mlog('gmail') if x['to'] == 'ann@alpha.test']
check(len(g) == 1 and g[0]['inReplyTo'] == '<ann-reply@alpha.test>' and '/book?t=' in g[0]['text'], 'your approved answer goes out in their thread, even when the cold-email limit for today is reached')
sql("update sales_settings set daily_cap = 20")

print('Pausing when emails bounce')
for i in range(10):
    sql(f"with c as (insert into sales_companies (name, country, source, source_ref, status) values ('B{i}', 'US', 'manual', 'b{i}', 'contacted') returning id), k as (insert into sales_contacts (company_id, email, email_status) select id, 'x{i}@bad{i}.test', 'deliverable' from c returning id, company_id) insert into sales_outbox (company_id, contact_id, step, subject, body, status, sent_at) select company_id, id, 1, 's', 'b', 'sent', now() - interval '1 day' from k")
ctl({'inbox': [{'from': 'mailer-daemon@googlemail.com', 'subject': 'Delivery Status Notification (Failure)', 'text': f"wasn't delivered to x{i}@bad{i}.test", 'messageId': f'<bb{i}@g.test>'} for i in range(2)]}); cron()
s, o = api({'action': 'overview'}); check(o['blocked'] and 'bounced' in o['blocked'], 'too many bounces: sending pauses itself, with the reason: “' + str(o['blocked']) + '”')
st = o['settings']; st.update({'resume': True}); s, o = api({'action': 'settings', 'settings': st}); check(o['blocked'] is None, 'Resume sending clears it')

print('Book a call with Olaitan')
s, j = pub('/api/meet/book'); sl = j['slots']
import datetime as dt
lag = [dt.datetime.fromisoformat(x.replace('Z', '+00:00')) + dt.timedelta(hours=1) for x in sl]
check(len(sl) > 20 and all(t.weekday() < 5 and (14, 0) <= (t.hour, t.minute) <= (17, 30) for t in lag), f'{len(sl)} open times, all weekdays 2:00–6:00 pm Lagos time')
check(min(dt.datetime.fromisoformat(x.replace('Z', '+00:00')) for x in sl) > dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=12), 'never sooner than 12 hours ahead')
req('/admin/api/meetings', {'action': 'create', 'title': 'Busy', 'startsAt': sl[0], 'minutes': 60}, OWNER)
s, j = pub('/api/meet/book'); check(sl[0] not in j['slots'] and sl[1] not in j['slots'], 'a meeting you already have removes the times it overlaps'); sl = j['slots']
token = tok.group(1)
s, j = pub('/api/meet/book', {'slot': sl[0], 'name': 'Ann Lee', 'email': 'ann@alpha.test', 'company': 'Alpha Dental', 'tz': 'America/Chicago', 't': token})
check(s == 200 and j['when'].endswith('(Chicago time)'), 'booking works, confirmed in their own time zone: ' + str(j.get('when')))
code = sql("select meeting_code from sales_bookings where email = 'ann@alpha.test'")
check(sql(f"select title || ' | ' || minutes from meetings where code = '{code}'") == 'Call with Ann Lee (Alpha Dental) | 30', 'it creates the meeting in Olexweb Meet (30 minutes)')
check(sql(f"select status from sales_companies where id = {A}") == 'booked', 'the business from the Olex Sales email is marked as booked')
import time; time.sleep(1); cm = [x for x in mails() if x['to'] == 'ann@alpha.test']
check(cm and cm[-1]['subject'].startswith('Your call with Olaitan') and f'/{code}' in cm[-1]['html'] and 'calendar=1' in cm[-1]['html'] and cm[-1]['text'], 'a designed confirmation email with the join link and a calendar invite (through Olexweb Mail)')
s, j = pub('/api/meet/book'); check(sl[0] not in j['slots'], 'that time is no longer offered')
s, j = pub('/api/meet/book', {'slot': sl[2], 'name': 'Ann', 'email': 'ann@alpha.test', 'tz': 'UTC'}); check(s == 400 and 'already have a call' in j['error'], 'one upcoming call per email address')
s, j = pub('/api/meet/book', {'slot': '2026-01-01T10:00:00.000Z', 'name': 'X', 'email': 'x@x.test'}); check(s == 400 and 'taken' in j['error'], 'a time outside your hours (or already taken) is refused')
s, j = pub('/api/meet/book', {'slot': sl[3], 'name': 'Bot', 'email': 'bot@x.test', 'website': 'spam'}); check(s == 400 and sql("select count(*) from sales_bookings where email = 'bot@x.test'") == '0', 'bots filling the hidden field are refused')
s, j = pub('/api/meet/book', {'slot': sl[4], 'name': 'Tricky', 'email': 'evil@x.test', 't': f'{B}.forged0000000000'}); check(s == 200 and sql(f"select status from sales_companies where id = {B}") == 'opted_out', 'a forged link can’t mark another business as booked')
s, j = pub('/api/meet/book', {'slot': sl[5], 'name': 'Third', 'email': 'third@x.test'}); s, j = pub('/api/meet/book', {'slot': sl[6], 'name': 'Fourth', 'email': 'fourth@x.test'})
check(s == 429, 'more than 3 bookings an hour from one network are refused')

print('On screen')
sql("delete from sales_bookings where ip_hash is not null")
with sync_playwright() as pw:
    br = pw.chromium.launch(); errs = []
    P = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, timezone_id='Europe/London').new_page(); P.on('pageerror', lambda e: errs.append(str(e)[:90]))
    P.goto(MEET + '/book'); P.wait_for_selector('.bk-times button', timeout=10000)
    check('Europe/London' in P.locator('.bk-lead').inner_text(), 'meet.olexweb.com/book shows times in the visitor’s own time zone (London here)')
    P.locator('.bk-times button').nth(1).click(); P.fill('.bk-form input[autocomplete=name]', 'Phone Booker'); P.fill('.bk-form input[type=email]', 'phone@x.test')
    P.screenshot(path=SHOTS + '/32-book-a-call.png', full_page=True)
    P.click('.bk-form button'); P.wait_for_selector('h1:has-text("You’re booked")', timeout=15000); check(True, 'booking on a phone works: “You’re booked”')
    P.screenshot(path=SHOTS + '/33-booked.png', full_page=True)
    cx = br.new_context(viewport={'width': 1280, 'height': 900}); cx.add_cookies([{'name': '__Host-olex_sess', 'value': OWNER, 'domain': 'localhost', 'path': '/', 'secure': True, 'httpOnly': True, 'sameSite': 'Strict'}])
    A2 = cx.new_page(); A2.on('pageerror', lambda e: errs.append(str(e)[:90])); A2.goto(APP + '/admin/sales#replies'); A2.wait_for_selector('.sl-m', timeout=10000)
    check(A2.locator('.sl-step:has-text("Interested")').count() == 1 and A2.locator('.sl-step:has-text("Opted out")').count() == 1, 'Admin → Sales → Replies shows each reply, sorted')
    A2.screenshot(path=SHOTS + '/34-sales-replies.png', full_page=True)
    A2.click('.sl-tabs button:has-text("Settings")'); A2.wait_for_selector('.sl-hours', timeout=8000); check(A2.locator('.sl-day input:checked').count() == 5, 'Settings shows your call hours')
    check(not errs, 'no page errors', errs); br.close()
print(f'\n{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
