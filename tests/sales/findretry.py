# Olex Sales: when the free map search is busy, the agent tries the same search again 30 minutes later (not 3 hours),
# moves on after 3 failures in a row, and searches every hour while there's little to work on.
import json, sys, urllib.request
exec(open('tests/meet/e2e.py').read().split("OWNER, EDITOR = ")[0])
SECRET = 'test-cron-secret-0123456789'
def ctl(body): urllib.request.urlopen(urllib.request.Request('http://localhost:4570/control', data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'}))
def mlog(kind): return [x for x in json.loads(urllib.request.urlopen('http://localhost:4570/log').read()) if x['kind'] == kind]
def cron(): urllib.request.urlopen(urllib.request.Request(APP + '/api/assistant/cron?run=due', headers={'authorization': 'Bearer ' + SECRET}), timeout=120).read()
def st(): return json.loads(sql("select json_build_object('cursor', find_cursor, 'last', last_find, 'mins', round(extract(epoch from now() - found_at) / 60)) from sales_settings where id = 1"))
sql("delete from sales_previews; delete from sales_docs; delete from sales_bookings; delete from sales_replies; delete from sales_outbox; delete from sales_contacts; delete from sales_signals; delete from sales_companies")
sql("update sales_settings set enabled = true, auto_find = true, forms_enabled = false, found_at = null, find_cursor = 0, last_find = null, countries = 'US'")
ctl({'reset': True, 'ai': 'good', 'mapsBusy': True})
cron(); s = st()
check(len(mlog('serper-busy')) == 1 and s['last'].get('error') and s['last']['tries'] == 1 and s['cursor'] == 0, 'a busy search is noted, and the same search is kept', s)
check(29 <= s['mins'] <= 31, 'it’s set to try again in 30 minutes (not 3 hours)', s['mins'])
cron(); check(len(mlog('serper-busy')) == 1, 'not before then')
sql("update sales_settings set found_at = now() - interval '61 minutes'"); cron(); s = st()
check(len(mlog('serper-busy')) == 2 and s['last']['tries'] == 2 and s['cursor'] == 0, 'after 30 minutes it tries the same search again', s)
sql("update sales_settings set found_at = now() - interval '61 minutes'"); cron(); s = st()
check(s['last']['tries'] == 3 and s['cursor'] == 1, 'after 3 failures in a row it moves on to the next search', s)
ctl({'mapsBusy': False}); sql("update sales_settings set found_at = now() - interval '61 minutes'"); cron(); s = st()
check(not s['last'].get('error') and s['cursor'] == 2 and s['last'].get('added', 0) >= 1, 'when the server answers, businesses are found and it moves on', s['last'])
n = int(sql("select count(*) from sales_companies where status in ('new','qualified','drafted')"))
sql("update sales_settings set found_at = now() - interval '61 minutes'"); before = len(mlog('serper-places')); cron()
check(n < 10 and len(mlog('serper-places')) == before + 1, 'with fewer than 10 businesses to work on, it searches again after an hour', n)
sql("update sales_settings set enabled = false, auto_find = false, countries = 'GB,US,FR'")
print(f'\n{passed} passed, {failed} failed'); sys.exit(1 if failed else 0)
