# Co-hosts and muting, at the API level, against tests/meet/lk-standin.mjs (a stand-in for LiveKit's room service).
# The host makes a guest a co-host; the co-host can mute, remove, let speak and take AI notes, but can't end the
# meeting, make co-hosts, or act on the host or another co-host. A forged or missing seat key gets nothing.
import json, urllib.request, sys
sys.path.insert(0, '/home/claude/olexweb/tests/meet')
from e2e_helpers import req, session, sql, check, done
LK = 'http://localhost:7880'
def lk(path, body=None):
    r = urllib.request.Request(LK + path, data=json.dumps(body).encode() if body is not None else None, headers={'Content-Type': 'application/json'}, method='POST' if body is not None else 'GET')
    return json.loads(urllib.request.urlopen(r).read() or b'{}')

OWNER = session('owner@test.local')
s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'Co-host check', 'speakers': 'invited'}, OWNER); CODE = j['code']
s, H = req('/api/meet', {'code': CODE, 'name': 'Olaitan'}, OWNER); check(s == 200 and H.get('host') and len(H.get('seat', '')) == 32, 'the host joins and gets a seat key', H)
s, A = req('/api/meet', {'code': CODE, 'name': 'Ada'}); s2, B = req('/api/meet', {'code': CODE, 'name': 'Bola'}); s3, C = req('/api/meet', {'code': CODE, 'name': 'Chidi'})
check(A['seat'] != B['seat'] and not A.get('host'), 'every guest gets their own seat key', [A.get('seat'), B.get('seat')])
for p in (A, B, C): lk('/add', {'identity': p['identity'], 'name': p['identity'], 'canPublish': False, 'tracks': [{'sid': 'TR_' + p['identity'], 'source': 'MICROPHONE', 'type': 'AUDIO', 'muted': False}]})
me = lambda p: {'as': p['identity'], 'seat': p['seat']}
host = lambda action, who, by=None, tok=None: req('/api/meet/host', {'action': action, 'code': CODE, 'identity': who['identity'], **(me(by) if by else {})}, tok)

print('Before anyone is a co-host')
s, j = host('mute', B, A); check(s == 403, 'a guest can’t mute anyone', (s, j))
s, j = req('/api/meet/host', {'action': 'make-cohost', 'code': CODE, 'identity': A['identity']}); check(s == 403, 'a guest can’t make co-hosts', s)

print('The host makes Ada a co-host')
s, j = host('make-cohost', A, tok=OWNER); check(s == 200, 'the host makes Ada a co-host', j)
u = [x for x in lk('/log') if x['fn'] == 'UpdateParticipant'][-1]
check(u['attributes'].get('cohost') == '1' and u['permission'].get('canSubscribeMetrics') and u['permission'].get('canPublish'), 'LiveKit marks her (a server-only mark) and lets her speak', u)
check(sql(f"select cohosts::text from meetings where code='{CODE}'") == json.dumps([A['identity']]), 'the meeting remembers her as a co-host', sql(f"select cohosts from meetings where code='{CODE}'"))
s, j = host('make-cohost', A, tok=OWNER); check(s == 200 and sql(f"select jsonb_array_length(cohosts) from meetings where code='{CODE}'") == '1', 'making her again doesn’t list her twice')

print('What Ada can do now')
s, j = host('mute', B, A); check(s == 200 and j.get('muted') == 1, 'Ada mutes Bola', j)
check(any(x['fn'] == 'MutePublishedTrack' and x['identity'] == B['identity'] and x['muted'] for x in lk('/log')), 'LiveKit mutes Bola’s mic')
s, j = host('allow-speak', C, A); check(s == 200, 'Ada lets Chidi speak', j)
u = [x for x in lk('/log') if x['fn'] == 'UpdateParticipant'][-1]; check(u['permission']['canPublish'] and not u['permission'].get('canSubscribeMetrics'), 'Chidi speaks but isn’t marked a co-host', u)
s, j = host('remove', C, A); check(s == 200, 'Ada removes Chidi', j)
s, j = req('/api/meet/notes', {'action': 'notes', 'code': CODE, 'transcript': 'Ada: We agreed to launch on Monday. Bola will send the invoice.', **me(A)})
check(s == 200 and j.get('notes'), 'Ada makes AI notes', (s, str(j)[:200]))
s, j = req('/api/meet/notes?code=' + CODE + '&as=' + A['identity'] + '&seat=' + A['seat']); check(s == 200, 'Ada reads the notes', s)

print('What Ada still can’t do')
s, j = req('/api/meet/host', {'action': 'end', 'code': CODE, **me(A)}); check(s == 403 and 'host' in j.get('error', ''), 'Ada can’t end the meeting for everyone', j)
s, j = host('make-cohost', B, A); check(s == 403, 'Ada can’t make co-hosts', j)
s, j = req('/api/meet/host', {'action': 'mute', 'code': CODE, 'identity': H['identity'], **me(A)}); check(s == 400, 'Ada can’t mute or remove the host', j)
s, j = host('make-cohost', B, tok=OWNER); check(s == 200, 'the host makes Bola a co-host too')
s, j = host('remove', B, A); check(s == 403, 'Ada can’t remove another co-host', j)
s, j = host('mute', A, B); check(s == 403, 'and Bola can’t mute Ada', j)

print('Forged and stolen keys')
s, j = host('mute', B, {'identity': A['identity'], 'seat': 'x' * 32}); check(s == 403, 'a made-up seat key is refused', s)
s, j = host('mute', B, {'identity': A['identity'], 'seat': B['seat']}); check(s == 403, 'someone else’s seat key is refused', s)
s, j = req('/api/meet/notes?code=' + CODE + '&as=' + A['identity'] + '&seat=' + 'y' * 32); check(s == 403, 'notes can’t be read with a made-up key', s)

print('The host takes it back')
s, j = host('unmake-cohost', A, tok=OWNER); check(s == 200, 'the host removes Ada as co-host', j)
u = [x for x in lk('/log') if x['fn'] == 'UpdateParticipant'][-1]; check(u['attributes'].get('cohost') == '' and not u['permission'].get('canSubscribeMetrics') and u['permission']['canPublish'], 'her mark goes; she can still speak', u)
s, j = host('mute', B, A); check(s == 403, 'and she can’t mute anyone any more', s)
s, j = req('/api/meet/notes', {'action': 'notes', 'code': CODE, 'transcript': 'x', **me(A)}); check(s == 403, 'or make notes', s)
s, j = req('/api/meet/host', {'action': 'end', 'code': CODE}, OWNER); check(s == 200, 'the host ends the meeting')
s, j = host('mute', A, B); check(s >= 400, 'nobody acts in an ended meeting', s)
done()
