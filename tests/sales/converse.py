# Olex Sales, Install 19: the agent runs the conversation. It reads the whole thread, picks the next move, and plain code
# guards what must never go wrong (prices only from the playbook, payment and starting go to Olaitan, no links, no promises).
# Then: nudges when a conversation goes quiet, "later" check-ins, introductions, booking stops every email, the pre-call
# brief, and the Simple screen's "Needs you" and "Your calls".
import json, re, sys, urllib.request
exec(open('tests/meet/e2e.py').read().split("OWNER, EDITOR = ")[0])            # helpers: session, req, sql, check, APP
OWNER = session('owner@test.local')
SECRET = 'test-cron-secret-0123456789'
def api(body): return req('/admin/api/sales', body, OWNER)
def ctl(body): urllib.request.urlopen(urllib.request.Request('http://localhost:4570/control', data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'}))
def mlog(role=None): l = json.loads(urllib.request.urlopen('http://localhost:4570/log').read()); return [x for x in l if x['kind'] == 'ai' and (not role or x.get('role') == role)]
def cron(): urllib.request.urlopen(urllib.request.Request(APP + '/api/assistant/cron?run=due', headers={'authorization': 'Bearer ' + SECRET}), timeout=120).read()
def page(path):
    r = urllib.request.Request(APP + path, headers={'Cookie': '__Host-olex_sess=' + OWNER})
    try:
        with urllib.request.urlopen(r) as x: return x.status, x.read().decode()
    except urllib.error.HTTPError as e: return e.code, ''
def pub(path, body):
    r = urllib.request.Request(APP + path, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', 'Origin': APP})
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.loads(x.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
def row(q): v = sql(f"select row_to_json(x) from ({q}) x"); return json.loads(v) if v else None
def co(i): return row(f"select * from sales_companies where id = {i}")
def last_out(i): return row(f"select * from sales_outbox where company_id = {i} order by id desc limit 1")
def move(i): return sql(f"select move from sales_replies where company_id = {i} order by id desc limit 1")

sql("delete from sales_docs; delete from sales_bookings; delete from sales_replies; delete from sales_outbox; delete from sales_contacts; delete from sales_signals; delete from sales_companies; delete from sales_dnc; delete from meetings where title like 'Call with %'")
sql("update sales_settings set auto_find = false, forms_enabled = false, enabled = true, require_approval = false, daily_cap = 20, start_date = '2026-01-01', postal_address = '12 Example Street, Lagos', imap_uid = 0, paused_reason = null, countries = 'GB,US,FR', call_hours = '{\"days\":[1,2,3,4,5],\"from\":\"14:00\",\"to\":\"18:00\"}'")
ctl({'reset': True, 'ai': 'good'})
def contacted(name, email, msgid=None, days_ago=2):
    cid = sql(f"insert into sales_companies (name, domain, country, city, category, source, source_ref, status, score) values ('{name}', '{email.split('@')[1]}', 'US', 'Austin TX', 'Dentists', 'manual', '{name}', 'contacted', 8) returning id").split('\n')[0]
    kid = sql(f"insert into sales_contacts (company_id, email, email_status) values ({cid}, '{email}', 'deliverable') returning id").split('\n')[0]
    sql(f"insert into sales_signals (company_id, code, evidence) values ({cid}, 'NO_BOOKING', 'no booking link on the homepage')")
    sql(f"insert into sales_outbox (company_id, contact_id, step, subject, body, status, sent_at, message_id) values ({cid}, {kid}, 1, '{name.lower()} bookings', 'Hi, patients can’t book online on your site. Would a quick idea help?\n\nOlaitan\nOlexweb', 'sent', now() - interval '{days_ago} days', '{msgid or '<' + name.replace(' ', '') + '@gmail.test>'}')")
    return int(cid)
def say(email, text, mid, to=None, name='Ann Lee'):
    ctl({'inbox': [{'from': email, 'fromName': name, 'subject': 'Re: bookings', 'text': text, 'messageId': mid, **({'inReplyTo': to} if to else {})}]}); cron()

A = contacted('Alpha Dental', 'ann@alpha.test', '<alpha1@gmail.test>')
print('It answers by itself, like a person')
say('ann@alpha.test', 'Hi Olaitan, I would love to hear your ideas.', '<a2@alpha.test>', '<alpha1@gmail.test>')
o = last_out(A); conv = mlog('converse')
check(o and o['step'] == 9 and o['status'] in ('approved', 'sent') and '/book?t=' in o['body'] and o['body'].rstrip().endswith('Olaitan\nOlexweb'), 'interested: it answers with your booking link and sends it by itself (“send without asking me” is on)', json.dumps(o)[:300])
check(move(A) == 'book' and co(A)['status'] == 'replied', 'the move is saved (“sent your booking link”); the business is now Talking')
check(conv and 'OLAITAN (' in conv[-1]['prompt'] and 'can’t book online' in conv[-1]['prompt'], 'it read the whole conversation, not just the last message')
sa = sql(f"select extract(epoch from (send_after - created_at))::int from sales_outbox where id = {o['id']}")
check(sa and 9 * 60 - 5 <= int(sa) <= 39 * 60, f'it waits {int(sa) // 60} minutes before answering, as a person would (9 to 38)')

G = contacted('Gus Gym', 'gus@gym.test', '<gus1@gmail.test>')
print('Prices come only from your playbook')
say('gus@gym.test', 'How much would a new website cost?', '<g2@gym.test>', '<gus1@gmail.test>', 'Gus')
o = last_out(G); p = co(G)['plan']
check(o and p and ('it’s ' + p['price']) in o['body'] and 'My current rates: https://olexweb.com/doc/' in o['body'], 'asked the price: the code adds the price for the offer that fits (' + (p or {}).get('price', '?') + ') and your rate card', (o or {}).get('body', '')[:400])
check(o and '/book?t=' in o['body'], 'and invites them to a call')

H = contacted('Hill Clinic', 'hal@hill.test', '<hill1@gmail.test>')
ctl({'ai': 'badAnswer'}); say('hal@hill.test', 'What would it cost and how fast?', '<h2@hill.test>', '<hill1@gmail.test>', 'Hal'); ctl({'ai': 'good'})
o = last_out(H); c = co(H)
check(c['handover'] and 'check' in c['handover']['why'] and sql(f"select count(*) from sales_outbox where company_id = {H} and step = 9") == '0', 'when the AI writes a price, a link, a promise or “!”, the code refuses it 3 times and hands it to you; the bad draft is thrown away', json.dumps(c['handover']))
check(len([x for x in mlog('converse') if 'Hal' in x['prompt']]) == 3 and 'broke these rules' in mlog('converse')[-1]['prompt'], 'each retry tells the AI exactly what it broke')

print('Starting and paying are yours')
I = contacted('Ivy Dental', 'ivy@ivy.test', '<ivy1@gmail.test>')
say('ivy@ivy.test', 'Sounds perfect. Send me the invoice and we will go ahead.', '<i2@ivy.test>', '<ivy1@gmail.test>', 'Ivy')
o = last_out(I); c = co(I)
check(c['handover'] and 'paying' in c['handover']['why'] and o['status'] == 'waiting' and o['held_reason'].startswith('For you'), 'they want to start and pay: even though the AI chose to answer, the code hands it to you; a suggested reply waits, never sent alone')
check(move(I) == 'handover', 'saved as handed to you')

print('Not now, someone else, no')
J = contacted('Jade Spa', 'jo@jade.test', '<jade1@gmail.test>')
say('jo@jade.test', 'Not now, we are busy until March. Try us in March.', '<j2@jade.test>', '<jade1@gmail.test>', 'Jo')
c = co(J); check(c['status'] == 'nurture' and c['next_touch_after'].startswith('2027-03-02'), 'not now: a gracious answer, and a check-in booked for when they said (2 March)', c['next_touch_after'])
sql(f"update sales_outbox set status = 'sent', sent_at = now() - interval '10 days' where company_id = {J} and status in ('approved', 'waiting')")
sql(f"update sales_companies set next_touch_after = now() - interval '1 hour' where id = {J}"); cron()
o = last_out(J); c = co(J)
check(o['step'] == 20 and o['status'] in ('approved', 'sent') and o['in_reply_to'] and c['nurture_count'] == 1 and c['next_touch_after'] > '2026-12', 'when the time comes: a check-in in the same thread; the next one is 45 days later (3 at most)')
K = contacted('Kite Hotel', 'desk@kite.test', '<kite1@gmail.test>')
say('desk@kite.test', 'Please talk to our manager sam@kite.test, she handles the website.', '<k2@kite.test>', '<kite1@gmail.test>', 'Front desk')
intro = row(f"select o.*, k.email from sales_outbox o join sales_contacts k on k.id = o.contact_id where o.company_id = {K} and o.step = 12")
check(intro and intro['email'] == 'sam@kite.test' and 'Hi Sam' in intro['body'], 'someone else: it thanks them, then writes a short introduction to Sam')
L = contacted('Lark Bakery', 'lee@lark.test', '<lark1@gmail.test>')
say('lee@lark.test', 'Please talk to my friend at someone@gmail.com', '<l2@lark.test>', '<lark1@gmail.test>', 'Lee')
check(sql("select count(*) from sales_contacts where email = 'someone@gmail.com'") == '0', 'but only people at the business’s own domain: never a stranger’s address')
M = contacted('Moss Law', 'max@moss.test', '<moss1@gmail.test>')
say('max@moss.test', 'Thanks but this is not for us.', '<m2@moss.test>', '<moss1@gmail.test>', 'Max')
check(co(M)['status'] == 'lost' and sql(f"select count(*) from sales_outbox where company_id = {M} and step > 1") == '0', 'a polite no: no answer, never emailed again')

print('When a conversation goes quiet')
sql(f"update sales_outbox set sent_at = now() - interval '7 days' where company_id = {A} and step = 1")
sql(f"update sales_replies set received_at = now() - interval '5 days' where company_id = {A}")       # her reply came first, then our answer, then silence
sql(f"update sales_outbox set status = 'sent', sent_at = now() - interval '4 days' where company_id = {A} and step = 9")
cron(); o = last_out(A)
check(o['step'] == 10 and o['in_reply_to'], 'Ann went quiet after the answer: a light nudge after 3 days, in the same thread')
sql(f"update sales_outbox set status = 'sent', sent_at = now() - interval '5 days' where id = {o['id']}"); cron(); o = last_out(A)
check(o['step'] == 11, 'then a last one 4 days later')
sql(f"update sales_outbox set status = 'sent', sent_at = now() - interval '5 days' where id = {o['id']}"); cron()
check(co(A)['status'] == 'nurture', 'then it rests: a check-in in 45 days instead of more chasing')

print('Too many answers without a call')
N = contacted('Nova Dental', 'nia@nova.test', '<nova1@gmail.test>')
for i in range(5): sql(f"insert into sales_outbox (company_id, contact_id, step, subject, body, status, sent_at) select {N}, id, 9, 'Re: x', 'answer', 'sent', now() - interval '{10 - i} days' from sales_contacts where company_id = {N}")
say('nia@nova.test', 'One more question about the colours.', '<n2@nova.test>', '<nova1@gmail.test>', 'Nia')
check(co(N)['handover'] and '5 answers' in co(N)['handover']['why'], 'after 5 answers and no call, it hands the conversation to you')

print('Booking a call, and the brief')
sql(f"update sales_companies set status = 'replied' where id = {A}")
sql(f"insert into sales_outbox (company_id, contact_id, step, subject, body, status) select {A}, id, 10, 'Re: x', 'a waiting nudge', 'approved' from sales_contacts where company_id = {A}")
j = json.loads(urllib.request.urlopen(APP + '/api/meet/book').read())
s, b = pub('/api/meet/book', {'slot': j['slots'][0], 'name': 'Ann Lee', 'email': 'ann@alpha.test', 'tz': 'America/Chicago', 'note': 'Mostly about online booking'})
check(s == 200 and co(A)['status'] == 'booked', 'Ann books from the booking page (even without the link, her address is matched to Alpha Dental)', json.dumps(b)[:200])
check(sql(f"select count(*) from sales_outbox where company_id = {A} and status in ('waiting', 'approved')") == '0', 'every email still waiting for her is stopped')
cron(); c = co(A); B = c['brief']
check(B and B['call'] and B['contact']['name'] == 'Ann Lee' and B['call']['note'] == 'Mostly about online booking', 'a brief is written: the call, who with, what she wrote when booking')
check(B and B['ask'] and B['show'] and B['offer'] and B['offer']['price'] and len(B['thread']) >= 3, 'what she wants, worries, questions to ask, what to show, the price from your playbook, and the whole conversation')
s, h = page(f'/admin/sales/brief/{A}'); h = h.replace('<!-- -->', '')
check(s == 200 and 'Call brief' in h and 'Ask them' in h and 'How do patients book today?' in h and 'How to close' in h, 'the brief page opens in your admin')
check(page('/admin/sales/brief/999999')[0] == 404, 'a business that doesn’t exist: not found')
say('ann@alpha.test', 'Can we move the call to Thursday?', '<a9@alpha.test>', '<alpha1@gmail.test>')
check(co(A)['handover'] and 'booked' in co(A)['handover']['why'], 'a booked client writes again: that goes to you')
s, j = api({'action': 'brief', 'id': A}); check(s == 200 and j['brief']['company']['name'] == 'Alpha Dental', '“Write it again” works')

print('The simple screen')
s, h = page('/admin/sales'); h = h.replace('<!-- -->', '')
check('Needs you</h2>' in h and 'Ivy Dental' in h and 'I’ve dealt with it' in h, '“Needs you”: the conversations that are yours, with why')
check('Your calls</h2>' in h and 'Read the brief' in h and 'Alpha Dental' in h, '“Your calls”: each booked call with its brief')
check('>Later' in h, 'a “Later” stage for leads being kept warm')
s, j = api({'action': 'handover-done', 'id': I}); check(s == 200 and co(I)['handover'] is None, '“I’ve dealt with it” gives it back to the agent')
sql("update sales_settings set enabled = false, require_approval = true")
print(f'\n{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
