# Scheduled meetings and reminders: smart defaults, your own reminders, rescheduling, the 10-minute run (time passing is
# simulated by moving the start time), the guest's start time and Add to calendar, Copy invite, and the admin screens.
# Run by run.sh after e2e.py (the site, LiveKit and Postgres are already up).
import json, os, subprocess, sys, urllib.request
from datetime import datetime, timedelta, timezone
from playwright.sync_api import sync_playwright
exec(open('tests/meet/e2e.py').read().split("OWNER, EDITOR = ")[0])          # the same helpers: check, session, req, sql
OWNER, EDITOR = session('owner@test.local'), session('editor@test.local')
SECRET = os.environ.get('CRON_SECRET', '')
def tick():
    r = urllib.request.Request(APP + '/api/assistant/cron?run=due', headers={'authorization': 'Bearer ' + SECRET})
    with urllib.request.urlopen(r, timeout=60) as x: return json.loads(x.read())
def iso(minutes): return (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat()
def row(code): return json.loads(sql(f"select row_to_json(m) from (select reminders, reminders_auto, reminded, start_notified_at, starts_at, minutes, title, speakers from meetings where code = '{code}') m"))
def mine(rep, code): return [x for x in (rep.get('meetings') or []) if x['code'] == code]

print('Scheduling')
s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'Client call', 'startsAt': iso(25 * 60), 'minutes': 45}, OWNER); C1 = j.get('code', '')
check(s == 200 and j['reminders'] == [1440, 60, 30], 'more than a day away: smart reminders 1 day, 1 hour and 30 minutes before', j)
check(row(C1)['reminders_auto'] is True and row(C1)['minutes'] == 45, 'they’re marked smart, and the length is kept')
s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'Today', 'startsAt': iso(3 * 60)}, OWNER); C2 = j.get('code', '')
check(j.get('reminders') == [60, 30], 'later today: 1 hour and 30 minutes before', j)
s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'Very soon', 'startsAt': iso(40)}, OWNER)
check(j.get('reminders') == [30], 'in 40 minutes: just the 30-minute one', j)
s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'Any minute', 'startsAt': iso(15)}, OWNER)
check(j.get('reminders') == [5], 'in 15 minutes: a short one, 5 minutes before', j)
s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'Mine', 'startsAt': iso(4 * 24 * 60), 'reminders': [2880, 120, 15, 15]}, OWNER); C3 = j.get('code', '')
check(j.get('reminders') == [2880, 120, 15] and row(C3)['reminders_auto'] is False, 'your own reminders are kept as you set them (repeats dropped)', j)
for body, what in (({'startsAt': iso(-5)}, 'a time in the past'), ({'startsAt': iso(400 * 24 * 60)}, 'more than a year ahead'), ({'startsAt': 'soon'}, 'not a time'),
                   ({'startsAt': iso(120), 'minutes': 5}, 'a 5-minute meeting'), ({'startsAt': iso(120), 'reminders': list(range(1, 10))}, '9 reminders')):
    s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'x', **body}, OWNER); check(s == 400, f'{what} is refused: “{j.get("error")}”')
s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'Now'}, OWNER)
check(s == 200 and row(j['code'])['starts_at'] is None, 'Start now still works as before (no set time)')
s, j = req('/admin/api/meetings', {'action': 'update', 'code': C1, 'startsAt': iso(90)}, EDITOR); check(s == 403, 'an editor can’t reschedule')

print('Rescheduling')
s, j = req('/admin/api/meetings', {'action': 'update', 'code': C1, 'startsAt': iso(100)}, OWNER)
check(s == 200 and j['reminders'] == [60, 30], 'moving a meeting recalculates smart reminders for its new time', j)
s, j = req('/admin/api/meetings', {'action': 'update', 'code': C3, 'startsAt': iso(5 * 24 * 60)}, OWNER)
check(j.get('reminders') == [2880, 120, 15], 'your own reminders move with the meeting, unchanged', j)
s, j = req('/admin/api/meetings', {'action': 'update', 'code': C3, 'reminders': 'smart'}, OWNER)
check(j.get('reminders') == [1440, 60, 30] and j['remindersAuto'] is True, '“Use smart reminders” switches back', j)
s, j = req('/admin/api/meetings', {'action': 'update', 'code': C3, 'title': 'Renamed <i>call</i>', 'speakers': 'invited', 'minutes': 90}, OWNER)
r = row(C3); check(r['title'] == 'Renamed call' and r['speakers'] == 'invited' and r['minutes'] == 90, 'the name, who can speak and length can change', r)
s, j = req('/admin/api/meetings', {'action': 'update', 'code': C3, 'startsAt': None}, OWNER)
check(row(C3)['starts_at'] is None and row(C3)['reminders'] == [], 'it can go back to having no set time (no reminders)')

print('Reminders, every 10 minutes')
sql(f"update meetings set starts_at = now() + interval '25 hours', reminders = '[1440, 60, 30]', reminded = '[]', start_notified_at = null where code = '{C1}'")
check(not mine(tick(), C1), 'a day and an hour before: nothing yet')
sql(f"update meetings set starts_at = now() + interval '23 hours 55 minutes' where code = '{C1}'")
rep = mine(tick(), C1); check(len(rep) == 1 and rep[0]['before'] == 1440 and 'tomorrow at' in rep[0]['text'], 'one day before: “' + (rep[0]['text'] if rep else '') + '”', rep)
check(not mine(tick(), C1), 'the next run doesn’t send it again')
sql(f"update meetings set starts_at = now() + interval '25 minutes' where code = '{C1}'")      # the pinger was down for hours
rep = mine(tick(), C1)
check(len(rep) == 1 and rep[0]['before'] == 30 and 'in 25 minutes' in rep[0]['text'], 'after a long gap, only the latest reminder goes (no burst of old ones)', rep)
check(sorted(row(C1)['reminded']) == [30, 60, 1440], 'the missed 1-hour one is marked done, not sent late', row(C1)['reminded'])
sql(f"update meetings set starts_at = now() - interval '1 minute' where code = '{C1}'")
rep = mine(tick(), C1); check(len(rep) == 1 and rep[0]['before'] == 0 and 'starts now' in rep[0]['text'], 'at the start time: “' + (rep[0]['text'] if rep else '') + '”')
check(not mine(tick(), C1), 'and that one is sent once too')
sql(f"update meetings set starts_at = now() + interval '20 minutes', reminders = '[30]', reminded = '[]', start_notified_at = null, started_at = now() where code = '{C2}'")
rep = mine(tick(), C2); sql(f"update meetings set starts_at = now() - interval '1 minute' where code = '{C2}'"); rep += mine(tick(), C2)
check(not rep, 'no reminders once you’ve already started the meeting', rep)
sql(f"update meetings set starts_at = now() + interval '50 minutes', reminders = '[60, 30]', reminded = '[]', start_notified_at = null, started_at = null where code = '{C2}'")
tick(); s, j = req('/admin/api/meetings', {'action': 'update', 'code': C2, 'startsAt': iso(55)}, OWNER)
check(row(C2)['reminded'] == [], 'rescheduling clears what was sent, so reminders go out again at the new time')
sql(f"update meetings set ended_at = now(), starts_at = now() + interval '20 minutes', reminders = '[30]', reminded = '[]' where code = '{C2}'")
check(not mine(tick(), C2), 'an ended meeting sends nothing')
s, j = req('/admin/api/notify', {'action': 'status'}, OWNER)
check(s == 200 and j.get('prefs', {}).get('meeting') is True, 'Meeting reminders is a notification kind (on unless you switch it off)', j.get('prefs'))

print('Calendar file')
s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'Design review, Q4; final', 'startsAt': iso(3 * 24 * 60), 'minutes': 45}, OWNER); C4 = j['code']
with urllib.request.urlopen(APP + f'/api/meet?calendar=1&code={C4}') as x:
    ics, ctype, disp = x.read().decode(), x.headers.get('Content-Type'), x.headers.get('Content-Disposition')
check('text/calendar' in ctype and 'attachment' in disp, 'Add to calendar downloads a calendar file')
check('BEGIN:VEVENT' in ics and 'SUMMARY:Design review\\, Q4\\; final' in ics and f'/meet/{C4}' in ics and ics.count('BEGIN:VALARM') == 2 and '\r\n' in ics,
      'it has the meeting, its link, and two reminders built in (commas and semicolons escaped)', ics[:300])
start = datetime.fromisoformat(json.loads(sql(f"select to_json(starts_at) from meetings where code = '{C4}'")))
check(f"DTSTART:{start.astimezone(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}" in ics and f"DTEND:{(start + timedelta(minutes=45)).astimezone(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}" in ics, 'start and end times are exact (UTC)')
try: urllib.request.urlopen(APP + '/api/meet?calendar=1&code=' + C3); bad = 200
except urllib.error.HTTPError as e: bad = e.code
check(bad == 404, 'a meeting with no set time has no calendar file')

print('In the browser')
with sync_playwright() as pw:
    b = pw.chromium.launch()
    host = b.new_context(viewport={'width': 1366, 'height': 900}, permissions=['clipboard-read', 'clipboard-write'], timezone_id='Africa/Lagos')
    host.add_cookies([{'name': '__Host-olex_sess', 'value': OWNER, 'domain': 'localhost', 'path': '/', 'secure': True, 'httpOnly': True, 'sameSite': 'Strict'}])
    guest = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, timezone_id='Europe/London')
    errs = []
    A = host.new_page(); A.on('pageerror', lambda e: errs.append(str(e)[:80])); A.goto(APP + '/admin/meetings')
    A.fill('#mg-title', 'Board meeting'); A.click('.mg-new .seg button:has-text("Schedule")')
    check(A.locator('.mg-new input[type=date]').count() == 1 and A.locator('.mg-new input[type=time]').count() == 1, 'Schedule shows date, time (Lagos) and length')
    A.fill('.mg-new input[type=date]', (datetime.now(timezone.utc) + timedelta(days=2, hours=1)).strftime('%Y-%m-%d')); A.fill('.mg-new input[type=time]', '15:00')
    chips = A.locator('.mg-new .mg-chip').all_inner_texts()
    check([c.replace('×', '').strip() for c in chips] == ['1 day before', '1 hour before', '30 min before'], 'smart reminders show up front', chips)
    A.click('.mg-new .mg-chip:has-text("30 min") button'); A.select_option('.mg-new .mg-addrem select', '2880')
    chips = [c.replace('×', '').strip() for c in A.locator('.mg-new .mg-chip').all_inner_texts()]
    check(chips == ['2 days before', '1 day before', '1 hour before'], 'remove one, add “2 days before”: they become yours', chips)
    A.screenshot(path=SHOTS + '/13-admin-schedule.png', full_page=True)
    A.click('.mg-new button:has-text("Schedule meeting")'); A.wait_for_selector('.mg-list li:has-text("Board meeting") .mg-at', timeout=8000)
    li = A.locator('.mg-list li:has-text("Board meeting")')
    check('3:00 pm' in li.inner_text() and '2 days, 1 day and 1 hour before' in li.inner_text(), 'the meeting shows its time and reminders', li.inner_text()[:200])
    code5 = sql("select code from meetings where title = 'Board meeting' order by id desc limit 1")
    check(sql(f"select reminders::text from meetings where code = '{code5}'") == '[2880, 1440, 60]' and sql(f"select to_char(starts_at at time zone 'Africa/Lagos', 'HH24:MI') from meetings where code = '{code5}'") == '15:00', 'saved as 15:00 Lagos with your reminders')
    li.locator('button:has-text("Copy invite")').click(); A.wait_for_timeout(300); inv = A.evaluate('navigator.clipboard.readText()')
    check(inv.startswith('You’re invited: Board meeting') and '3:00 pm (Lagos time)' in inv and f'/meet/{code5}' in inv, 'Copy invite gives a ready message for WhatsApp', inv)
    li.locator('button:has-text("Edit")').click(); A.wait_for_selector('.sheet #mg-etitle')
    A.fill('.sheet input[type=time]', '17:30'); A.click('.sheet button:has-text("Use smart reminders")'); A.click('.sheet-foot button:has-text("Save")')
    A.wait_for_selector('.mg-list li:has-text("Board meeting"):has-text("5:30 pm")', timeout=8000)   # (the admin's security policy blocks wait_for_function)
    check(sql(f"select reminders::text from meetings where code = '{code5}'") == '[1440, 60, 30]', 'Edit: moved to 17:30, back to smart reminders')
    A.goto(APP + f'/admin/meetings#meet-{code5}'); A.wait_for_selector(f'#mg-{code5}.mg-fresh', timeout=5000); check(True, 'a reminder’s link highlights that meeting')
    G = guest.new_page(); G.on('pageerror', lambda e: errs.append(str(e)[:80])); G.goto(APP + f'/meet/{code5}')
    G.wait_for_selector('.mt-when-at b', timeout=5000)
    w = G.locator('.mt-when').inner_text()
    check('5:30 pm' in w and 'Lagos time' in w and '4:30 pm' in w and 'your time' in w, 'a guest in London sees Lagos time and their own time', w)
    left_h = float(sql(f"select extract(epoch from starts_at - now()) / 3600 from meetings where code = '{code5}'"))   # worked out from the real time, so any time of day works
    check(f'Starts in {int(left_h // 24)} day' in w, 'and how long until it starts', w)
    check(G.locator('.mt-cal a:has-text("Google Calendar")').get_attribute('href').startswith('https://calendar.google.com/calendar/render?action=TEMPLATE'), 'Add to Google Calendar is offered')
    with G.expect_download() as d: G.click('.mt-cal a:has-text("Apple or Outlook")')
    check('BEGIN:VCALENDAR' in open(d.value.path()).read(), 'and the Apple or Outlook file downloads')
    G.screenshot(path=SHOTS + '/14-guest-scheduled-phone.png')
    H = host.new_page(); H.goto(APP + f'/meet/{code5}'); H.wait_for_selector('.mt-when-at b', timeout=5000)
    check(H.locator('.mt-cal').count() == 0 and H.locator('button[type=submit]:has-text("Start the meeting")').count() == 1, 'the host sees the time and can start early (no calendar buttons)')
    check(not errs, 'no page errors (dates never mismatch between server and browser)', errs)
    b.close()

print(f'\n{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
