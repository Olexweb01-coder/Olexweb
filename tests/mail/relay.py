# The own-server programs (scripts/mailserver): the relay builds a correct email and hands it to Postfix; the bounce
# reader turns a bounce notice into a report. Postfix is replaced by tests/mail/fake-sendmail.sh.
import json, subprocess, sys, time, urllib.request, email, email.policy, os
passed = failed = 0
def check(ok, label, extra=''):
    global passed, failed
    if ok: passed += 1; print('  ✓', label)
    else: failed += 1; print('  ✗', label, extra)
TOKEN = 'x' * 40
env = {**os.environ, 'MAIL_TOKEN': TOKEN, 'MAIL_HOST': 'mail.olexweb.com', 'SENDMAIL': os.path.abspath('tests/mail/fake-sendmail.sh'), 'PORT': '8125'}
p = subprocess.Popen(['node', 'scripts/mailserver/relay.mjs'], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE); time.sleep(1)
def send(body, token=TOKEN):
    r = urllib.request.Request('http://127.0.0.1:8125/send', data=json.dumps(body).encode(), headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.loads(x.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read())
print('The relay')
check(json.loads(urllib.request.urlopen('http://127.0.0.1:8125/health').read()) == {'ok': True}, 'it answers a health check')
s, j = send({'to': 'a@example.com'}, token='wrong'); check(s == 401, 'without the secret token it refuses')
msg = {'from': 'Olexweb Meet <meet@olexweb.com>', 'to': 'ada@example.com', 'reply_to': 'info@olexweb.com', 'subject': '482915 is your Olexweb Meet code — welcome, Adé',
       'html': '<h1>Confirm your email</h1><p>Code: <b>482915</b></p>', 'text': 'Confirm your email. Code: 482915'}
s, j = send(msg); check(s == 200 and j.get('id'), 'it accepts an email and answers with its id')
args = open('/tmp/fake-sendmail.args').read().split()
check(args[:2] == ['-i', '-f'] and args[2] == f"bounces+{j['id']}@mail.olexweb.com" and args[-1] == 'ada@example.com', 'it hands it to Postfix with a bounce address carrying the id: ' + args[2])
m = email.message_from_bytes(open('/tmp/fake-sendmail.eml', 'rb').read(), policy=email.policy.default)
check(m['From'] == 'Olexweb Meet <meet@olexweb.com>' and m['To'] == 'ada@example.com' and m['Reply-To'] == 'info@olexweb.com', 'From, To and Reply-To are right')
check(str(m['Subject']) == msg['subject'], 'the subject survives, accents and all: ' + str(m['Subject']))
check(m['Message-ID'] == f"<{j['id']}@mail.olexweb.com>" and m['Date'], 'it has a Message-ID on your domain and a date')
parts = {pt.get_content_type(): pt.get_content() for pt in m.walk() if not pt.is_multipart()}
check(m.get_content_type() == 'multipart/alternative' and parts.get('text/plain') == msg['text'] and parts.get('text/html') == msg['html'], 'it carries both the HTML and the plain-text version')
s, j = send({**msg, 'subject': 'Hi\r\nBcc: victim@example.com'}); m2 = email.message_from_bytes(open('/tmp/fake-sendmail.eml', 'rb').read(), policy=email.policy.default)
check(s == 200 and m2['Bcc'] is None and 'Bcc' not in open('/tmp/fake-sendmail.eml').read().split('\r\n\r\n')[0].replace('Subject: Hi Bcc', ''), 'a subject trying to sneak in extra headers can’t (header injection blocked)')
s, j = send({**msg, 'to': 'not-an-address'}); check(s == 422, 'a bad address is refused (Olexweb Mail then stops, as it should)')
os.environ['SENDMAIL'] = '/bin/false'; p.terminate(); p.wait()
env2 = {**env, 'SENDMAIL': '/bin/false', 'PORT': '8127'}; p = subprocess.Popen(['node', 'scripts/mailserver/relay.mjs'], env=env2, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)   # its own port
r = urllib.request.Request('http://127.0.0.1:8127/send', data=json.dumps(msg).encode(), headers={'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json'})
try: urllib.request.urlopen(r); s = 200
except urllib.error.HTTPError as e: s = e.code
check(s == 503, 'if Postfix can’t take it, it says so (Olexweb Mail then uses the next pipe)'); p.terminate()
print('The bounce reader')
DSN = """From: MAILER-DAEMON@mail.olexweb.com
To: bounces+lk3j2.ab12cd34ef56@mail.olexweb.com
Subject: Undelivered Mail Returned to Sender
Content-Type: multipart/report; report-type=delivery-status; boundary="B"

--B
Content-Type: text/plain

I'm sorry to have to inform you that your message could not be delivered.

--B
Content-Type: message/delivery-status

Reporting-MTA: dns; mail.olexweb.com

Final-Recipient: rfc822; Ghost@Example.com
Original-Recipient: rfc822;ghost@example.com
Action: failed
Status: 5.1.1
Diagnostic-Code: smtp; 550 5.1.1 The email account that you tried to reach does not exist.

Final-Recipient: rfc822; full@example.com
Action: delayed
Status: 4.2.2
Diagnostic-Code: smtp; 452 4.2.2 Mailbox full

--B--
"""
out = subprocess.run(['node', '-e', "import('./scripts/mailserver/bounce.mjs').then(m => console.log(JSON.stringify(m.parseBounce(require('fs').readFileSync(0,'utf8'), process.argv[1]))))", 'bounces+lk3j2.ab12cd34ef56@mail.olexweb.com'], input=DSN, capture_output=True, text=True).stdout
ev = json.loads(out)
check(ev[0] == {'email': 'ghost@example.com', 'kind': 'bounce', 'id': 'lk3j2.ab12cd34ef56', 'detail': ev[0]['detail']} and '5.1.1' in ev[0]['detail'], 'a permanent bounce (5.1.1, no such account) is read, with the message id')
check(ev[1]['email'] == 'full@example.com' and ev[1]['kind'] == 'soft', 'a temporary one (4.2.2, mailbox full) is marked as temporary')
print(f'\n{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
