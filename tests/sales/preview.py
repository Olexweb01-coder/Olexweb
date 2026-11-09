# Olex Sales: personal previews. Before the first email the agent makes each business a mock-up of a new homepage from its
# own site; the email offers it; a "yes" gets the link (or it goes in the first email when that switch is on). The page is
# marked as a mock-up, never indexed; real opens are counted (not Olaitan's own) and he's told the first time.
import json, re, sys, urllib.request
exec(open('tests/meet/e2e.py').read().split("OWNER, EDITOR = ")[0])            # helpers: session, req, sql, check, APP
from playwright.sync_api import sync_playwright
OWNER = session('owner@test.local')
SECRET = 'test-cron-secret-0123456789'
def api(body): return req('/admin/api/sales', body, OWNER)
def ctl(body): urllib.request.urlopen(urllib.request.Request('http://localhost:4570/control', data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'}))
def mlog(role=None): l = json.loads(urllib.request.urlopen('http://localhost:4570/log').read()); return [x for x in l if x['kind'] == 'ai' and (not role or x.get('role') == role)]
def cron(): urllib.request.urlopen(urllib.request.Request(APP + '/api/assistant/cron?run=due', headers={'authorization': 'Bearer ' + SECRET}), timeout=120).read()
def get(path, cookie=None):
    r = urllib.request.Request(APP + path, headers={'Cookie': '__Host-olex_sess=' + cookie} if cookie else {})
    try:
        with urllib.request.urlopen(r) as x: return x.status, x.read().decode()
    except urllib.error.HTTPError as e: return e.code, ''
def pub(body, ua='Mozilla/5.0 (iPhone) Safari'):
    r = urllib.request.Request(APP + '/api/preview', data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', 'Origin': APP, 'User-Agent': ua})
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.loads(x.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
def row(q): v = sql(f"select row_to_json(x) from ({q}) x"); return json.loads(v) if v else None

sql("delete from sales_previews; delete from sales_docs; delete from sales_bookings; delete from sales_replies; delete from sales_outbox; delete from sales_contacts; delete from sales_signals; delete from sales_companies; delete from sales_dnc")
sql("update sales_settings set auto_find = false, forms_enabled = false, enabled = true, require_approval = true, daily_cap = 20, start_date = '2026-01-01', postal_address = '12 Example Street, Lagos', imap_uid = 0, paused_reason = null, countries = 'GB,US,FR', previews_enabled = true, preview_in_first = false")
ctl({'reset': True, 'ai': 'good'})
def company(name, domain, cat='Dentists', country='US', city='Austin TX', sig=('SLOW_MOBILE', 34), email=None):
    cid = int(sql(f"insert into sales_companies (name, domain, country, city, category, source, source_ref, status, score, phone) values ('{name}', {('%s' % repr(domain)) if domain else 'null'}, '{country}', '{city}', '{cat}', 'manual', '{name}', 'qualified', 8, '+1 512-555-0101') returning id").split('\n')[0])
    sql(f"insert into sales_contacts (company_id, email, email_status) values ({cid}, '{email or 'info@' + (domain or re.sub(r'[^a-z]', '', name.lower()) + '.test')}', 'deliverable')")
    sql(f"insert into sales_signals (company_id, code, value_num, evidence) values ({cid}, '{sig[0]}', {sig[1] if sig[1] is not None else 'null'}, 'evidence')")
    return cid

print('Made before the first email, from their own site')
A = company('Bright Smiles Dental', 'slow-dentist.test')
s, j = api({'action': 'draft', 'id': A}); check(s == 200, 'the first email is drafted', j)
p = row(f"select * from sales_previews where company_id = {A}")
check(p and re.fullmatch(r'[A-Za-z0-9_-]{22}', p['token']), 'a mock-up was made first, with a private link', p)
d = p['data']
check(d['copy']['headline'].startswith('Bright, healthy smiles') and d['copy']['services'][0]['name'] == 'Check-ups and cleaning', 'its words come from the AI, from their own site', d['copy'])
check(d['color'] == '#0e7c86', 'their own colour is read from their site', d['color'])
check(d['phone'] == '+1 512-555-0101' and d['address'] == '40 Elm St, Austin', 'their phone and address (published on their site)', [d['phone'], d['address']])
check(any('34/100' in f for f in d['fixes']) and len(d['fixes']) <= 5, 'what it fixes comes from the real signals (slow on phones, 34/100)', d['fixes'])
w = [x for x in mlog('preview')]; check(w and 'Bright Smiles Dental' in w[-1]['prompt'] and 'Call us on 512 555 0101' in w[-1]['prompt'], 'the AI was given what their site says', w[-1]['prompt'][:200] if w else None)
o = row(f"select * from sales_outbox where company_id = {A} order by id desc limit 1")
sysw = [x for x in json.loads(urllib.request.urlopen('http://localhost:4570/log').read()) if x['kind'] == 'ai' and 'n' in x][-1]['system']
check('mock-up you already made' in sysw, 'the first email offers the mock-up (“want me to send it over?”)', sysw[-600:])
check('/preview/' not in o['body'], 'with the switch off, the first email has no link (safer for a new account)', o['body'])

print('The page')
s, html = get('/preview/' + p['token'])
check(s == 200 and 'Bright Smiles Dental' in html and 'A mock-up Olexweb made for Bright Smiles Dental' in html, 'it opens, marked as a mock-up by Olexweb', s)
check('noindex' in html and 'Bright, healthy smiles' in html, 'never indexed; their words are on it')
check('/book?t=' in html, '“Talk to Olaitan” goes to your booking page for them')
s, _ = get('/preview/' + 'x' * 22); check(s == 404, 'a made-up link finds nothing', s)
s, _ = get('/preview/abc'); check(s == 404, 'a malformed link finds nothing', s)
robots = get('/robots.txt')[1]; check('Disallow: /preview' in robots, 'robots.txt keeps search engines out', robots[:200])

print('Opens are counted, once per visit, never yours, never a link scanner')
s, j = pub({'token': p['token'], 'what': 'view'}, ua='Mozilla/5.0 (compatible; Microsoft Outlook SafeLinks)'); check(row(f"select views from sales_previews where company_id = {A}")['views'] == 0, 'a link scanner doesn’t count')
s, j = req('/api/preview', {'token': p['token'], 'what': 'view'}, OWNER); check(j.get('owner') and row(f"select views from sales_previews where company_id = {A}")['views'] == 0, 'your own look doesn’t count')
s, j = pub({'token': p['token'], 'what': 'view'}); check(s == 200 and row(f"select views, first_view_at is not null as f from sales_previews where company_id = {A}") == {'views': 1, 'f': True}, 'their look counts', j)
s, j = pub({'token': p['token'], 'what': 'click'}); check(row(f"select clicks from sales_previews where company_id = {A}")['clicks'] == 1, 'a tap on “Talk to Olaitan” is counted')
s, j = pub({'token': 'nope', 'what': 'view'}); check(s == 400, 'nonsense is refused', s)
r = urllib.request.Request(APP + '/api/preview', data=json.dumps({'token': p['token'], 'what': 'view'}).encode(), headers={'Content-Type': 'application/json', 'Origin': 'https://evil.test'})
try: urllib.request.urlopen(r); st = 200
except urllib.error.HTTPError as e: st = e.code
check(st == 403, 'other sites can’t count views', st)

print('When they say yes, the agent sends the link (once)')
sql(f"update sales_outbox set status = 'sent', sent_at = now() - interval '1 day', message_id = '<pv1@gmail.test>' where id = {o['id']}"); sql(f"update sales_companies set status = 'contacted' where id = {A}")
sql("update sales_settings set require_approval = false")
ctl({'inbox': [{'from': 'info@slow-dentist.test', 'fromName': 'Ann Lee', 'subject': 'Re: ' + o['subject'], 'text': 'Yes please, I would love to see it.', 'messageId': '<pv2@slow>', 'inReplyTo': '<pv1@gmail.test>'}]}); cron()
a = row(f"select * from sales_outbox where company_id = {A} and step = 9 order by id desc limit 1")
check(a and ('/preview/' + p['token']) in a['body'] and 'Nothing on your live site has changed' in a['body'], 'the answer carries the mock-up link', a and a['body'])
conv = [x for x in mlog('converse')][-1]['system']; check('You made them a mock-up' in conv and 'not sent yet' in conv, 'the agent knew there was a mock-up to send', conv[-500:])
check(row(f"select shared_at is not null as s from sales_previews where company_id = {A}")['s'], 'it’s marked as sent')
ctl({'inbox': [{'from': 'info@slow-dentist.test', 'fromName': 'Ann Lee', 'subject': 'Re: ' + o['subject'], 'text': 'Thanks, looks nice. Could we talk next week?', 'messageId': '<pv3@slow>', 'inReplyTo': '<pv2@slow>'}]}); cron()
b = row(f"select * from sales_outbox where company_id = {A} and step = 9 order by id desc limit 1")
check(b and b['id'] != a['id'] and '/preview/' not in b['body'], 'the next answer doesn’t send it again', b and b['body'])

print('With “link in the first email” on')
sql("update sales_settings set preview_in_first = true, require_approval = true")
B = company('Old Salon', 'old-salon.test', cat='Hair and beauty salons', sig=('NOT_MOBILE', None))
s, j = api({'action': 'draft', 'id': B}); ob = row(f"select * from sales_outbox where company_id = {B} order by id desc limit 1")
tok = row(f"select token from sales_previews where company_id = {B}")['token']
check(ob and f"The mock-up: http://localhost:3000/preview/{tok}" in ob['body'], 'the link is in the first email, under the question', ob and ob['body'])
s, j = api({'action': 'edit', 'id': ob['id'], 'subject': ob['subject'], 'body': ob['body']}); check(s == 200, 'editing that email doesn’t trip the no-links check (the line is the code’s)', j)

print('Safe words when the AI claims things; no site; French; agencies')
sql("update sales_settings set preview_in_first = false")
ctl({'ai': 'pvBad'})
C = company('No Site Barbers', None, cat='Hair and beauty salons', sig=('NO_WEBSITE', None))
s, j = api({'action': 'preview', 'id': C}); pc = row(f"select data from sales_previews where company_id = {C}")['data']
txt = json.dumps(pc['copy'])
check(s == 200 and pc['copy'].get('safe') and not re.search(r'award|rated|2,000|\$49|guarantee|cheap', txt, re.I), 'claims (awards, ratings, prices, numbers not theirs) never make it: safe words instead', txt[:300])
check(len([x for x in mlog('preview') if x['prompt'].startswith('Business: No Site Barbers')]) == 3, 'it asked the AI three times first')
check(any('easy to find online' in f for f in pc['fixes']), 'no website: “You’d be easy to find online”', pc['fixes'])
ctl({'ai': 'good'})
D = company('Salon Lumière', None, cat='Hair and beauty salons', country='FR', city='Lyon', sig=('NO_WEBSITE', None))
s, j = api({'action': 'preview', 'id': D}); pd = row(f"select data from sales_previews where company_id = {D}")['data']
check(pd['lang'] == 'fr' and pd['copy']['cta'] == 'Réserver' and 'trouver en ligne' in pd['fixes'][0], 'a French business gets a French mock-up', [pd['lang'], pd['copy']['cta'], pd['fixes'][:1]])
s, html = get('/preview/' + row(f"select token from sales_previews where company_id = {D}")['token']); check('Une maquette réalisée par Olexweb pour Salon Lumière' in html, 'with a French ribbon')
E = company('Pixel Agency', 'pixel.test', cat='Agencies (partners)', sig=('AGENCY', None))
s, j = api({'action': 'preview', 'id': E}); check(s == 400 and not row(f"select 1 as one from sales_previews where company_id = {E}"), 'agencies get the partner pitch, not a mock-up', j)
old = row(f"select token, data from sales_previews where company_id = {C}")
s, j = api({'action': 'preview', 'id': C, 'again': True}); new = row(f"select token, data from sales_previews where company_id = {C}")
check(s == 200 and new['token'] == old['token'] and not new['data']['copy'].get('safe'), 'remaking keeps the same link with better words', new['data']['copy'].get('headline'))

print('Switched off')
sql("update sales_settings set previews_enabled = false")
F = company('Modern Clinic', 'modern-clinic.test', cat='Clinics and therapists', sig=('SLOW_MOBILE', 30))
s, j = api({'action': 'draft', 'id': F}); check(s == 200 and not row(f"select 1 as one from sales_previews where company_id = {F}"), 'no mock-up, and the email offers a quick idea or a call instead')
sql("update sales_settings set previews_enabled = true")

print('Admin → Sales')
s, j = api({'action': 'simple'})
pv = j.get('previews') or {}
check(pv.get('made') == 4 and pv.get('sent') >= 2 and pv.get('opened') == 1 and pv['opens'][0]['name'] == 'Bright Smiles Dental' and pv['opens'][0]['clicks'] == 1, 'the Simple screen counts them and lists who opened theirs', {k: pv.get(k) for k in ('made', 'sent', 'opened')})
s, j = api({'action': 'companies'}); check(any(c.get('preview') and c['preview']['views'] == 1 for c in j['companies']), 'the business list shows each mock-up and its opens')

print('In a browser: phone and computer')
with sync_playwright() as pw:
    br = pw.chromium.launch()
    for name, vp in (('phone', {'width': 390, 'height': 844}), ('laptop', {'width': 1366, 'height': 820})):
        pg = br.new_page(viewport=vp); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(APP + '/preview/' + p['token']); pg.wait_for_timeout(1500)
        check(pg.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), f'{name}: nothing spills sideways')
        check(pg.locator('.pv-ribbon').is_visible() and pg.locator('h1').inner_text().replace('\xa0', ' ').strip().startswith('Bright, healthy'), f'{name}: the ribbon and their headline show')
        pg.screenshot(path=f'/tmp/pv-{name}-top.png')
        pg.locator('#book').scroll_into_view_if_needed(); pg.wait_for_timeout(900)
        pg.locator('.pv-slots button').first.click(); pg.locator('.pv-book .pv-wide').click()
        check(pg.locator('.pv-demo').is_visible(), f'{name}: the booking demo works and explains itself')
        pg.locator('.pv-olex').scroll_into_view_if_needed(); pg.wait_for_timeout(900)
        check(pg.locator('.pv-olex li').count() >= 3, f'{name}: “what this version fixes” at the end')
        pg.screenshot(path=f'/tmp/pv-{name}-full.png', full_page=True)
        check(not errs, f'{name}: no page errors', errs)
    br.close()
print(f'\n{passed} passed, {failed} failed'); sys.exit(1 if failed else 0)
