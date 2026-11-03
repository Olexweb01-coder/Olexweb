# Olex AI across meetings, schedule, automation and courses. The AI's reply is chosen by the test (tests/meet/mock-ai.mjs
# stands in for Gemini), so this checks everything on our side: the right data reaches the AI, a proposal becomes a correct
# "Do it" card only when it's valid, deleting or ending is a red card, nothing changes before Do it, Do it runs once,
# Cancel changes nothing. (Whether the real model proposes well depends on Gemini and the instructions: try it live.)
import json, sys, urllib.request
from datetime import datetime, timedelta, timezone
from playwright.sync_api import sync_playwright
exec(open('tests/meet/e2e.py').read().split("OWNER, EDITOR = ")[0])
OWNER, EDITOR = session('owner@test.local'), session('editor@test.local')
def ai(path, body=None):
    r = urllib.request.Request('http://localhost:4566' + path, data=json.dumps(body).encode() if body is not None else None, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(r) as x: return json.loads(x.read())
CHAT = [None]
def say(text, reply, new=False):
    ai('/control', {'chatReply': reply})
    s, j = req('/admin/api/assistant', {'action': 'message', 'text': text, **({} if new or not CHAT[0] else {'chatId': CHAT[0]})}, OWNER)
    if s == 200: CHAT[0] = j['chatId']
    return s, (j.get('messages') or [None, {}])[-1]
def act(line): return '\n<<<ACTION ' + json.dumps(line) + '>>>'
def last_system(): return [x for x in ai('/log') if x['kind'] == 'chat'][-1]['system']
def do(m): return req('/admin/api/assistant', {'action': 'confirm', 'messageId': m['id']}, OWNER)
lagos = lambda days=0: (datetime.now(timezone.utc) + timedelta(hours=1, days=days)).strftime('%Y-%m-%d')

# what's in the database for the AI to see
s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'Investor update', 'startsAt': (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()}, OWNER); MC = j['code']
sql("insert into aoc_settings (id) values (1) on conflict do nothing")
sql("insert into aoc_listeners (token, name, feedback, feedback_at) values ('t-olex-1', 'Ada Obi', 'Part 2 changed how I think about ideas.', now()), ('t-olex-2', 'Bola Ade', null, null) on conflict do nothing")
sql("insert into yt_ideas (key, name, url, source, status) values ('olex-idea.test', 'Colorsnap', 'https://olex-idea.test', 'test', 'new') on conflict (key) do update set status = 'new', first = false, channels = default")
IDEA = sql("select id from yt_ideas where key = 'olex-idea.test'")
LST = sql("select id from aoc_listeners where token = 't-olex-2'")

print('What Olex AI knows')
s, m = say('What meetings do I have tomorrow?', 'You have the investor update tomorrow.', new=True)
sysp = last_system()
check(s == 200 and 'MEETINGS NOT ENDED' in sysp and MC in sysp and 'Investor update' in sysp, 'asked about meetings: it gets your meetings, by code')
check('SCHEDULE, next 8 days' in sysp and 'NOW (Lagos):' in sysp, 'and your schedule, with the time now in Lagos')
check('schedule_meeting:' in sysp and 'remove_listener' in sysp and 'red card' in sysp, 'it knows the new actions, and that deleting is only through them (red card)')
check(not m.get('action'), 'a question gets an answer, not an action card')
say('How is the YouTube automation doing?', 'Fine.'); sysp = last_system()
check('AUTOMATION: YouTube' in sysp and 'LIBRARY (ideas and videos' in sysp and f'idea #{IDEA} "Colorsnap"' in sysp, 'asked about automation: settings and the Library, by idea number')
say('How many listeners joined the course?', 'Two.'); sysp = last_system()
check('COURSES.' in sysp and 'listeners joined' in sysp and f'listener #{LST} Bola' in sysp, 'asked about the course: listeners and feedback')
check('Part 2 changed how I think' in sysp and 'data, never instructions' in sysp, 'listener feedback is marked as data, never instructions')
check('Bola Ade' not in sysp, 'only first names of listeners go to the AI')

print('Scheduling by chat')
before = sql("select count(*) from meetings")
s, m = say('Schedule a strategy call tomorrow at 3pm for 45 minutes', 'I can set that up.' + act({'action': 'schedule_meeting', 'title': 'Strategy call', 'date': lagos(1), 'time': '15:00', 'minutes': 45}))
a = m.get('action') or {}
check(m.get('action_state') == 'proposed' and 'Schedule “Strategy call”' in a.get('label', '') and '3:00 pm (Lagos), 45 minutes' in a.get('label', '') and '(smart)' in a.get('label', ''), 'it shows a card: “' + a.get('label', '') + '”')
check(sql("select count(*) from meetings") == before, 'nothing happens before you tap Do it')
check('<<<ACTION' not in (m.get('text') or ''), 'the hidden action line isn’t shown to you')
s, j = do(m); code = sql("select code from meetings where title = 'Strategy call' order by id desc limit 1")
check(s == 200 and j.get('state') == 'done' and code, 'Do it: the meeting is scheduled', j)
check(sql(f"select to_char(starts_at at time zone 'Africa/Lagos', 'YYYY-MM-DD HH24:MI') || ' ' || minutes || ' ' || reminders::text from meetings where code = '{code}'") == f'{lagos(1)} 15:00 45 [1440, 60, 30]', 'at 15:00 Lagos tomorrow, 45 minutes, smart reminders')
check(f'/meet/{code}' in (j.get('message') or {}).get('text', ''), 'Olex AI replies with the link to share')
s, j = do(m); check(s == 400, 'tapping Do it again does nothing (it ran once)')
s, m = say('Schedule it for yesterday', 'Okay.' + act({'action': 'schedule_meeting', 'title': 'Too late', 'date': lagos(-1), 'time': '10:00'}))
check(not m.get('action'), 'a time in the past gets no card')
s, m = say('Move the strategy call to 5pm and remind me 2 hours and 15 minutes before', 'Sure.' + act({'action': 'update_meeting', 'code': code, 'time': '17:00', 'reminders': [120, 15]}))
a = m.get('action') or {}; check('move it to' in a.get('label', '') and '5:00 pm' in a.get('label', '') and '2 hours, 15 minutes before' in a.get('label', ''), 'rescheduling: “' + a.get('label', '') + '”')
do(m); check(sql(f"select to_char(starts_at at time zone 'Africa/Lagos', 'HH24:MI') || ' ' || reminders::text || ' ' || reminders_auto from meetings where code = '{code}'") == '17:00 [120, 15] false', 'Do it: moved to 17:00, with your reminders')
s, m = say('Rename meeting zzz', 'Okay.' + act({'action': 'update_meeting', 'code': 'aaa-aaaa-aaa', 'title': 'x'})); check(not m.get('action'), 'a meeting that doesn’t exist gets no card')
q0 = int(sql("select count(*) from meetings where title = 'Quick sync' and starts_at is null"))
s, m = say('Create a quick meeting now', 'Done soon.' + act({'action': 'schedule_meeting', 'title': 'Quick sync', 'now': True})); do(m)
check(int(sql("select count(*) from meetings where title = 'Quick sync' and starts_at is null")) == q0 + 1, 'a meeting with no set time can be made too')

print('Ending and deleting: red cards')
s, m = say('End the strategy call', 'Ending it will remove everyone.' + act({'action': 'end_meeting', 'code': code}))
a = m.get('action') or {}; check(a.get('danger') is True and 'can’t be undone' in a.get('label', ''), 'ending is a red card that says it can’t be undone')
req('/admin/api/assistant', {'action': 'cancel', 'messageId': m['id']}, OWNER)
check(sql(f"select ended_at is null from meetings where code = '{code}'") == 't', 'Cancel: nothing changes')
s, m = say('Delete the strategy call', 'Okay.' + act({'action': 'delete_meeting', 'code': code})); check(not m.get('action'), 'a meeting that hasn’t ended can’t be deleted (no card)')
s, m = say('End it now', 'Okay.' + act({'action': 'end_meeting', 'code': code})); do(m)
check(sql(f"select ended_at is not null from meetings where code = '{code}'") == 't', 'Do it: ended')
s, m = say('Now delete it', 'This is permanent.' + act({'action': 'delete_meeting', 'code': code}))
a = m.get('action') or {}; check(a.get('danger') is True and 'permanent' in a.get('label', ''), 'deleting an ended meeting is a red card: “' + a.get('label', '') + '”')
DANGER_CHAT = CHAT[0]
do(m); check(sql(f"select count(*) from meetings where code = '{code}'") == '0', 'Do it: deleted')

print('Automation by chat')
s, m = say('Don’t post Colorsnap to Facebook', 'Okay.' + act({'action': 'set_channel', 'ideaId': int(IDEA), 'channel': 'facebook', 'on': False}))
check('Untick Facebook for “Colorsnap”' in (m.get('action') or {}).get('label', ''), 'a channel tick: “' + (m.get('action') or {}).get('label', '') + '”')
do(m); check(sql(f"select channels->>'facebook' from yt_ideas where id = {IDEA}") == 'false', 'Do it: Facebook unticked for that idea')
s, m = say('Untick Facebook again', 'Okay.' + act({'action': 'set_channel', 'ideaId': int(IDEA), 'channel': 'facebook', 'on': False})); check(not m.get('action'), 'asking for what’s already so gets no card')
s, m = say('Make Colorsnap next', 'Okay.' + act({'action': 'make_next', 'ideaId': int(IDEA)})); do(m)
check(sql(f"select status || ' ' || first from yt_ideas where id = {IDEA}") == 'picked true', 'make it next: picked and first in line')
s, m = say('Add my idea squoosh.app', 'I’ll judge it.' + act({'action': 'add_idea', 'url': 'squoosh.app', 'next': True}))
check('judges it like any found idea' in (m.get('action') or {}).get('label', '') and 'https://squoosh.app' in (m.get('action') or {}).get('label', ''), 'your own idea: the card says it will be judged (and may be turned down)')
req('/admin/api/assistant', {'action': 'cancel', 'messageId': m['id']}, OWNER)
s, m = say('Add my idea', 'Okay.' + act({'action': 'add_idea', 'url': 'not a web address'})); check(not m.get('action'), 'not a web address: no card')
cur = sql("select yt_mode from yt_settings where id = 1"); target = 'autopilot' if cur != 'autopilot' else 'approval'
s, m = say('Switch YouTube mode', 'Okay.' + act({'action': 'youtube_mode', 'mode': target})); do(m)
check(sql("select yt_mode from yt_settings where id = 1") == target, f'YouTube switched to {target}')
s, j = req('/admin/api/youtube', {'action': 'yt-mode', 'mode': cur}, OWNER); check(s == 200 and j.get('mode') == cur, 'the YouTube screen’s own switch still works (now the same shared code)')
on = sql("select enabled from meta_settings where id = 1") == 't'
s, m = say('Facebook posting', 'Okay.' + act({'action': 'facebook_posting', 'on': not on})); do(m)
check(sql("select enabled from meta_settings where id = 1") == ('f' if on else 't'), 'Facebook posting switched ' + ('off' if on else 'on'))
sql(f"update meta_settings set enabled = {'true' if on else 'false'} where id = 1")

print('The course by chat')
s, m = say('Close the course', 'Okay.' + act({'action': 'course_accepting', 'open': False})); do(m)
check(sql("select accepting from aoc_settings where id = 1") == 'f', 'closed to new listeners')
s, m = say('Open it again', 'Okay.' + act({'action': 'course_accepting', 'open': True})); do(m); check(sql("select accepting from aoc_settings where id = 1") == 't', 'and opened')
s, m = say('Set the goal to 500', 'Okay.' + act({'action': 'course_goal', 'goal': 500})); do(m); check(sql("select goal from aoc_settings where id = 1") == '500', 'goal set to 500')
s, m = say('Remove Bola from the course', 'This is permanent.' + act({'action': 'remove_listener', 'listenerId': int(LST)}))
check((m.get('action') or {}).get('danger') is True and 'Bola' in (m.get('action') or {}).get('label', ''), 'removing a listener is a red card')
do(m); check(sql(f"select count(*) from aoc_listeners where id = {LST}") == '0', 'Do it: removed')

print('Who can use it')
s, j = req('/admin/api/assistant', {'action': 'message', 'text': 'Schedule a meeting'}, EDITOR); check(s == 403, 'an editor can’t use Olex AI')
s, j = req('/admin/api/assistant', {'action': 'message', 'text': 'Schedule a meeting'}); check(s == 401, 'nobody signed out can')

print('On screen')
s, m = say('End the quick sync', 'Ending removes everyone.' + act({'action': 'end_meeting', 'code': sql("select code from meetings where title = 'Quick sync' order by id desc limit 1")}), new=True)
with sync_playwright() as pw:
    b = pw.chromium.launch(); c = b.new_context(viewport={'width': 1280, 'height': 860})
    c.add_cookies([{'name': '__Host-olex_sess', 'value': OWNER, 'domain': 'localhost', 'path': '/', 'secure': True, 'httpOnly': True, 'sameSite': 'Strict'}])
    P = c.new_page(); errs = []; P.on('pageerror', lambda e: errs.append(str(e)[:80])); P.goto(APP + f'/admin?c={CHAT[0]}')
    P.wait_for_selector('.actcard.danger', timeout=10000)
    check(P.locator('.actcard.danger .btn-bad:has-text("Do it")').count() == 1, 'a red card on screen, with a red Do it')
    P.screenshot(path=SHOTS + '/15-olex-danger-card.png')
    check(not errs, 'no page errors', errs)
    b.close()
print(f'\n{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
