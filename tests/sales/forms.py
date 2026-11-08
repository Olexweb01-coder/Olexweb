# Olex Sales, Install 21: contact forms (the factory's browser fills them like a person), agency partners, and finding
# businesses by itself. The real factory worker (olexweb-factory/worker/forms.mjs) runs here against the stand-in sites.
import json, os, re, sys, time, hmac, hashlib, subprocess, urllib.request
exec(open('tests/meet/e2e.py').read().split("OWNER, EDITOR = ")[0])            # helpers: session, req, sql, check, APP
OWNER = session('owner@test.local')
SECRET, FSECRET = 'test-cron-secret-0123456789', os.environ['FACTORY_SECRET']
def api(body): return req('/admin/api/sales', body, OWNER)
def ctl(body): urllib.request.urlopen(urllib.request.Request('http://localhost:4570/control', data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'}))
def mlog(kind=None): l = json.loads(urllib.request.urlopen('http://localhost:4570/log').read()); return [x for x in l if not kind or x['kind'] == kind]
def cron(): return json.loads(urllib.request.urlopen(urllib.request.Request(APP + '/api/assistant/cron?run=due', headers={'authorization': 'Bearer ' + SECRET}), timeout=120).read())
def factory(path, body, sign=True):
    buf = json.dumps(body).encode(); ts = str(int(time.time()))
    sig = hmac.new(FSECRET.encode(), f"{ts}\nPOST\n{path}\n{hashlib.sha256(buf).hexdigest()}".encode(), hashlib.sha256).hexdigest()
    r = urllib.request.Request(APP + path, data=buf, headers={'Content-Type': 'application/json', **({'x-factory-sig': ts + '.' + sig} if sign else {})})
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.loads(x.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
def worker():
    env = {**os.environ, 'OLEX_API': APP, 'FACTORY_SECRET': FSECRET, 'FACTORY_TEST_HOSTS': 'localhost:4570', 'FORMS_PAUSE_MS': '0'}
    # the factory's own code, run from a copy so it uses this machine's browser (on GitHub the workflow installs its own)
    d = '/tmp/forms-worker'; os.makedirs(d, exist_ok=True)
    for f in ['forms.mjs', 'api.mjs']: open(f'{d}/{f}', 'w').write(open(f'/home/claude/olexweb-factory/worker/{f}').read())
    nm = f'{d}/node_modules'; os.makedirs(nm, exist_ok=True)
    g = subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True).stdout.strip()
    for pk in ['playwright', 'playwright-core']:
        if not os.path.exists(f'{nm}/{pk}') and os.path.exists(f'{g}/{pk}'): os.symlink(f'{g}/{pk}', f'{nm}/{pk}')
    return subprocess.run(['node', f'{d}/forms.mjs'], env=env, capture_output=True, text=True, timeout=300, cwd=d)
def co(name): return json.loads(sql(f"select row_to_json(x) from (select c.*, (select string_agg(code, ',' order by code) from sales_signals s where s.company_id = c.id) as sigs from sales_companies c where name = '{name}') x") or 'null')
def page(path):
    r = urllib.request.Request(APP + path, headers={'Cookie': '__Host-olex_sess=' + OWNER})
    with urllib.request.urlopen(r) as x: return x.read().decode().replace('<!-- -->', '')

sql("delete from sales_docs; delete from sales_bookings; delete from sales_replies; delete from sales_outbox; delete from sales_contacts; delete from sales_signals; delete from sales_companies; delete from sales_dnc")
sql("update sales_settings set enabled = true, require_approval = false, auto_find = false, forms_enabled = true, forms_cap = 40, forms_paused_reason = null, forms_dispatched_at = null, partners_enabled = true, daily_cap = 20, start_date = '2026-01-01', postal_address = '12 Example Street, Lagos', countries = 'GB,US,FR', imap_uid = 0, paused_reason = null, find_cursor = 0, found_at = null, last_find = null")
ctl({'reset': True, 'ai': 'good'})
def add(name, domain, city, category):
    return sql(f"insert into sales_companies (name, domain, website, country, city, category, source, source_ref, status) values ('{name}', '{domain}', 'https://{domain}/', 'US', '{city}', '{category}', 'manual', '{domain}', 'new') returning id").split('\n')[0]
for n, d, ci, k in [('Corner Café', 'form-cafe.test', 'Boston MA', 'Cafés'), ('Robot Dental', 'robot-dental.test', 'Boston MA', 'Dentists'), ('Odd Bistro', 'odd-form.test', 'Boston MA', 'Restaurants'),
                     ('Pixel & Co', 'pixel-agency.test', 'Boston MA', 'Agencies (partners)'), ('Plain Shop', 'plain-shop.test', 'Boston MA', 'Agencies (partners)')]:
    api({'action': 'profile', 'id': int(add(n.replace("'", "''"), d, ci, k))})

print('Reading each business')
c = co('Corner Café')
check(c['status'] == 'qualified' and c['channel'] == 'form' and c['form_url'].endswith('/site/form-cafe.test/contact'), 'no published email, but a contact form: ready, through the form', json.dumps({k: c[k] for k in ['status', 'channel', 'form_url', 'profile_error']}))
r = co('Robot Dental'); check(r['status'] == 'no_email' and 'robot check' in (r['profile_error'] or ''), 'a form with a robot check is never used', r['profile_error'])
p = co('Pixel & Co'); check(p['status'] == 'qualified' and 'AGENCY' in p['sigs'] and p['plan']['offer'] == 'partner' and p['plan']['price'] == 'from $80', 'an agency: the partner offer (white-label), at your partner price: ' + str((p['plan'] or {}).get('price')))
check(co('Plain Shop')['status'] == 'skipped', 'something listed as an agency that doesn’t sell websites is skipped')

print('Writing')
api({'action': 'draft', 'id': c['id']}); api({'action': 'draft', 'id': p['id']}); api({'action': 'draft', 'id': co('Odd Bistro')['id']})
f = json.loads(sql(f"select row_to_json(o) from sales_outbox o where company_id = {c['id']}"))
check(f['channel'] == 'form' and f['contact_id'] is None and f['status'] == 'approved', 'the message is written for their contact form')
check('Just reply to this address: olaitan.test@gmail.test' in f['body'] and 'no thanks' in f['body'] and 'Olexweb (olexweb.com)' in f['body'], 'it says who it’s from, where to reply and how to say no (a form has no email footer)')
pm = json.loads(sql(f"select row_to_json(o) from sales_outbox o where company_id = {p['id']}"))
check(pm['channel'] == 'email' and 'under their own name' in pm['body'] and any('white-label' in x.get('system', '') for x in mlog('ai')), 'the agency gets the partner pitch, by email')

print('The factory fills the forms')
s, j = factory('/api/factory/forms', {}, sign=False); check(s == 401, 'without the factory’s signature: refused')
cron(); check(sql('select forms_dispatched_at is not null from sales_settings') == 't', 'with forms due, the background step starts the factory’s forms workflow')
w = worker(); out = w.stdout + w.stderr
check('sent: localhost:4570' in out, 'the worker opened the café’s contact page and sent the form', out[-400:])
post = [x for x in mlog('site') if x.get('method') == 'POST' and x['host'] == 'form-cafe.test']
form = post[-1]['form'] if post else ''
check(post and 'olaitan.test%40gmail.test' in form and 'privacy=on' in form and 'phone=&' in form + '&' and 'Olaitan' in urllib.parse.unquote_plus(form), 'filled like a person: name, reply address, subject, message, the privacy box; the phone left empty (never invented)', form[:300])
f = json.loads(sql(f"select row_to_json(o) from sales_outbox o where company_id = {c['id']}"))
check(f['status'] == 'sent' and 'thank you' in (f['held_reason'] or '').lower() and co('Corner Café')['status'] == 'contacted', 'it checked the site said thank you; the café is now “Emailed”')
o = json.loads(sql(f"select row_to_json(o) from sales_outbox o where company_id = {co('Odd Bistro')['id']}"))
check(o['status'] == 'failed' and 'required choice' in (o['error'] or '') and co('Odd Bistro')['status'] == 'no_email', 'a form with a required question it can’t answer honestly is left alone', o['error'])

print('Limits')
sql("update sales_settings set forms_cap = 1"); s, j = factory('/api/factory/forms', {})
check(s == 200 and j['jobs'] == [] and 'limit' in j.get('why', ''), 'today’s limit reached: no more jobs (10 a day to start, +5 a week, up to 40)')
sql("update sales_settings set forms_cap = 40")
check(sql("select count(*) from sales_outbox where channel = 'form' and status = 'sending'") == '0', 'nothing is left half-sent')

print('Their reply')
ctl({'inbox': [{'from': 'owner@form-cafe.test', 'fromName': 'Rosa', 'subject': 'Re: ' + f['subject'], 'text': 'Hi Olaitan, thanks for the message, I would love to hear your ideas.', 'messageId': '<r1@form-cafe.test>'}]}); cron()
k = sql(f"select email from sales_contacts where company_id = {c['id']}")
a = json.loads(sql(f"select row_to_json(o) from sales_outbox o where company_id = {c['id']} and step = 9") or 'null')
check(k == 'owner@form-cafe.test' and co('Corner Café')['status'] == 'replied', 'a reply to the form message (a new email, no thread) is matched to the café by its web address')
check(a and a['channel'] == 'email' and '/book?t=' in a['body'], 'and the agent answers by email from then on, with your booking link')

print('Safety')
for i in range(10): sql(f"insert into sales_outbox (company_id, step, subject, body, status, channel, error) values ({c['id']}, 1, 'x', 'x', 'failed', 'form', 'No send button found')")
oid = sql(f"insert into sales_outbox (company_id, step, subject, body, status, channel, claimed_at) values ({c['id']}, 1, 'x', 'x', 'sending', 'form', now()) returning id").split('\n')[0]
s, j = factory('/api/factory/form-result', {'id': int(oid), 'ok': False, 'why': 'No send button found'})
check(s == 200 and 'Paused' in (sql('select forms_paused_reason from sales_settings') or ''), 'when most recent forms fail, contact forms pause themselves and tell you')
s, j = factory('/api/factory/form-result', {'id': int(oid), 'ok': True}); check(s == 409, 'a result for a job that isn’t being sent is refused')

print('Finding businesses by itself')
sql("delete from sales_companies where status in ('new', 'qualified', 'drafted') and id not in (select company_id from sales_outbox)")
sql("update sales_settings set auto_find = true, found_at = null, find_cursor = 0"); cron()
lf = json.loads(sql('select last_find from sales_settings'))
check(lf and lf['country'] == 'GB' and lf['kind'] == 'dentist' and lf['town'] == 'London' and 'added' in lf, 'with few leads waiting, it searches by itself: ' + json.dumps(lf)[:160])
sql("update sales_settings set found_at = null"); cron(); lf2 = json.loads(sql('select last_find from sales_settings'))
check(lf2['country'] == 'US' and lf2['town'] == 'Austin TX', 'next time: the next country, taking turns')
cron(); check(json.loads(sql('select last_find from sales_settings'))['country'] == 'US', 'and not again for 3 hours')

print('The simple screen')
h = page('/admin/sales')
check('Contact forms' in h and 'Agency partners' in h and 'Find businesses by itself' in h and 'Paused:' in h, 'Simple: switches for contact forms, agency partners and finding by itself (with any pause shown)')
s, j = api({'action': 'forms', 'on': True}); check(sql('select forms_paused_reason is null from sales_settings') == 't', 'switching contact forms on again resumes them')
sql("update sales_settings set enabled = false, require_approval = true, auto_find = false")
print(f'\n{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
