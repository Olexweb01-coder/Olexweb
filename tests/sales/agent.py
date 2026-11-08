# Olex Sales, Install 18: the agent's playbook and read of each business (price level from evidence, only ever up; the offer
# and price in their currency), France (emails in French, replies in English, French opt-outs), Germany never, official
# documents (rate card, invoice with bank details), the rate card attached when someone asks the price, and the simple screen.
import json, re, sys, urllib.request
exec(open('tests/meet/e2e.py').read().split("OWNER, EDITOR = ")[0])            # helpers: session, req, sql, check, APP
OWNER = session('owner@test.local')
SECRET = 'test-cron-secret-0123456789'
def api(body): return req('/admin/api/sales', body, OWNER)
def ctl(body): urllib.request.urlopen(urllib.request.Request('http://localhost:4570/control', data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'}))
def mlog(kind=None): l = json.loads(urllib.request.urlopen('http://localhost:4570/log').read()); return [x for x in l if not kind or x['kind'] == kind]
def cron(): urllib.request.urlopen(urllib.request.Request(APP + '/api/assistant/cron?run=due', headers={'authorization': 'Bearer ' + SECRET}), timeout=120).read()
def page(path):
    r = urllib.request.Request(APP + path, headers={'Cookie': '__Host-olex_sess=' + OWNER})
    try:
        with urllib.request.urlopen(r) as x: return x.status, x.read().decode()
    except urllib.error.HTTPError as e: return e.code, ''
def company(name): return json.loads(sql(f"select row_to_json(x) from (select c.*, (select string_agg(code, ',' order by code) from sales_signals s where s.company_id = c.id) as sigs from sales_companies c where name = '{name}') x"))
sql("delete from sales_docs; delete from sales_replies; delete from sales_outbox; delete from sales_contacts; delete from sales_signals; delete from sales_companies; delete from sales_dnc")
sql("update sales_settings set enabled = true, require_approval = false, daily_cap = 20, start_date = '2026-01-01', postal_address = '12 Example Street, Lagos', countries = 'GB,US,FR', bank = null, paused_reason = null, imap_uid = 0")
ctl({'reset': True, 'ai': 'good'})

print('Where it looks')
s, j = api({'action': 'find', 'source': 'manual', 'country': 'DE', 'text': 'Berlin Studio, berlin.test'}); check(s == 400 and 'consent' in j.get('error', ''), 'Germany is refused (its law needs consent even for business emails)')
s, j = api({'action': 'find', 'source': 'manual', 'country': 'FR', 'text': 'Salon Lumière, paris-salon.test, Paris\nCafé des Arts, lyon-cafe.test, Lyon'}); check(s == 200 and j['added'] == 2, 'French businesses can be added')
s, j = api({'action': 'find', 'source': 'manual', 'country': 'GB', 'text': 'Harper and Cole Solicitors, bigfirm-law.test, London'}); check(s == 200 and j['added'] == 1, 'and UK ones as before')
s, j = api({'action': 'countries', 'list': ['GB', 'US']}); s2, j2 = api({'action': 'find', 'source': 'manual', 'country': 'FR', 'text': 'X, x-fr.test'})
check(s == 200 and s2 == 400 and 'switched off' in j2.get('error', ''), 'a country switched off on the Sales screen isn’t searched')
api({'action': 'countries', 'list': ['GB', 'US', 'FR']})

print('The agent’s read of each business')
for n in ['Salon Lumière', 'Café des Arts', 'Harper and Cole Solicitors']: api({'action': 'profile', 'id': company(n)['id']})
law = company('Harper and Cole Solicitors'); p = law['plan']
check(law['tier'] == 'premium' and p['tierLabel'] == 'Premium', 'a law firm with offices in two cities and a team of 40 is read as Premium', json.dumps(p.get('reasons')))
check('CUE_LOCATIONS' in law['sigs'] and 'CUE_TEAM' in law['sigs'], 'from evidence on its own site (two offices, a team of 40)')
check(p['offer'] == 'signature' and p['price'].startswith('from £') and p['currency'] == 'GBP', 'so it offers a Signature experience, in pounds: ' + p['offerName'] + ', ' + p['price'])
sal = company('Salon Lumière'); ps = sal['plan']
check(sal['status'] == 'qualified' and ps['language'] == 'fr' and ps['currency'] == 'EUR' and '€' in ps['price'], 'the French salon: language French, prices in euros: ' + ps['offerName'] + ', ' + ps['price'])
check(sal['tier'] == 'growth' and 'more than one location' in json.dumps(ps['reasons']), 'its 3 salons (“Nos 3 salons”) raise it to Growth')
caf = company('Café des Arts'); check(caf['tier'] == 'starter' and caf['plan']['offer'] == 'redesign', 'a small café without a mobile layout: Starter, a redesign: ' + caf['plan']['price'])

print('French businesses: emails in French, replies in English')
cron()
sql(f"update sales_outbox set send_after = now() + interval '30 days' where company_id = {company('Café des Arts')['id']}")   # the salon's email goes first (one email every 12 minutes)
sent = [m for m in mlog('gmail') if 'paris-salon' in json.dumps(m)]
fr_ai = [x for x in mlog('ai') if 'Salon Lumi' in x.get('prompt', '')]
check(fr_ai and 'natural, polite French' in fr_ai[-1].get('system', ''), 'the writer is told to write in French (vous)')
body = sql(f"select body from sales_outbox where company_id = {sal['id']} and step = 1")
check('Je vous écris en français, mais je travaille en anglais' in body and 'mes réponses seront en anglais' in body, 'every French email says the replies will be in English, and that French or English is fine')
cron(); cron()
mail = [m for m in mlog('gmail') if 'bonjour@paris-salon.test' in json.dumps(m)]
check(mail and 'Répondez « non merci »' in json.dumps(mail[-1], ensure_ascii=False), 'it goes out with the opt-out line in French', json.dumps(mlog('gmail'))[:300])

print('Replies')
sid = sal['id']; mid = sql(f"select message_id from sales_outbox where company_id = {sid} and step = 1")
ctl({'inbox': [{'from': 'bonjour@paris-salon.test', 'subject': 'Re: salon', 'text': 'Bonjour. What would the price be for a new site? We have a budget of €3,000 for our 3 salons.', 'messageId': '<fr1@paris.test>', 'inReplyTo': mid}]})
cron()
sal2 = company('Salon Lumière')
check(sal2['tier'] == 'premium' and sal2['plan']['raised'], 'a budget in the thousands raises it to Premium (and it never goes back down)', json.dumps(sal2['plan']['reasons']))
ans = sql(f"select body from sales_outbox where company_id = {sid} and step = 9")
link = re.search(r'https://olexweb\.com/doc/([\w-]+)', ans or '')
check(link is not None and 'My current rates:' in ans, 'they asked the price: the answer carries your official rate card', ans[:300])
if link:
    s, h = page('/doc/' + link.group(1))
    check(s == 200 and 'Rate card' in h and 'Premium' in h and '€' in h and 'Signature experience' in h and 'noindex' in h, 'the rate card: Premium, in euros, with the bigger builds, never indexed')
lyon = company('Café des Arts'); lmid = sql(f"select message_id from sales_outbox where company_id = {lyon['id']} and step = 1")
if lmid:
    ctl({'inbox': [{'from': 'bonjour@lyon-cafe.test', 'subject': 'Re: café', 'text': 'Non merci, ne m’écrivez plus.', 'messageId': '<fr2@lyon.test>', 'inReplyTo': lmid}]}); cron()
    check(company('Café des Arts')['status'] == 'opted_out', 'a French “non merci” is understood: never emailed again')
else:
    check(True, '(the café’s email hadn’t gone out yet in this run)')

print('Official documents')
s, j = api({'action': 'doc-ratecard', 'country': 'GB', 'tier': 'starter', 'client': 'Ledger Accountants'})
s2, h = page(j.get('path', '/x'))
check(s == 200 and j['number'].startswith('RC-') and 'Ledger Accountants' in h and '£' in h and 'Landing page' in h and 'Signature experience' not in h, 'a Starter rate card in pounds, prepared for a client (no bigger builds at Starter)')
s, j = api({'action': 'doc-invoice', 'client': {'name': 'Ledger Accountants'}, 'items': [{'desc': 'Landing page', 'qty': 1, 'amount': 80}], 'currency': 'GBP'})
check(s == 400 and 'bank details' in j.get('error', ''), 'no invoice without your bank details')
s, j = api({'action': 'bank', 'account_name': 'Olaitan Adebayo', 'bank_name': 'Test Bank', 'account_number': '0123456789', 'swift': 'TESTNGLA'}); check(s == 200, 'bank details saved')
s, j = api({'action': 'doc-invoice', 'client': {'name': 'Ledger Accountants', 'email': 'a@ledger.test'}, 'items': [{'desc': 'Landing page', 'qty': 1, 'amount': 80}, {'desc': 'Care plan (first month)', 'qty': 1, 'amount': 20}], 'currency': 'GBP', 'dueDays': 7})
s2, h = page(j.get('path', '/x'))
check(s == 200 and j['number'].startswith('INV-') and '£100.00' in h and '0123456789' in h and 'TESTNGLA' in h and j['number'] in h, 'an invoice: items, the £100.00 total, your bank details and its number as the reference')
check(page('/doc/not-a-real-token-123456789')[0] == 404, 'a made-up link finds nothing')

print('The simple screen')
s, h = page('/admin/sales'); h = h.replace('<!-- -->', '')
check(s == 200 and 'aria-pressed="true">Simple' in h and 'The agent is working.' in h and 'Worth your time</h2>' in h and 'Official documents</h2>' in h and 'Your bank details</h2>' in h, 'Simple: the agent, the pipeline, who’s worth your time, documents, bank details')
check('Premium' in h and 'Salon Lumière' in h and 'Never Germany or Austria' in h, 'each lead with its level and price; the countries it never emails')
check('Outbox' in h or 'outbox' in h, 'the detailed screen is still there')
sql("update sales_settings set enabled = false, require_approval = true, bank = null")
print(f'\n{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
