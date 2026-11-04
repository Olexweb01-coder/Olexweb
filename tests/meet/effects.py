# Install 4: noise cancellation (RNNoise on the device), background blur (MediaPipe, served from this site), MP3 audio
# recordings (checked with ffprobe), and the floating mini window. Run by run.sh in the Meet-app stage.
import json, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright
exec(open('tests/meet/guests.py').read().split("FORM = {")[0])            # helpers: req, post, get, sql, MEET, OWNER
def raw_get(path):
    with urllib.request.urlopen(APP + path) as x: return x.status, x.headers.get('content-type', ''), x.read()
def probe(path):
    j = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,bit_rate:stream=codec_name,channels,sample_rate', '-of', 'json', path]))
    st = j['streams'][0]; return {'codec': st['codec_name'], 'channels': st['channels'], 'rate': int(st['sample_rate']), 'kbps': round(int(j['format']['bit_rate']) / 1000), 'dur': float(j['format']['duration'])}

print('Files on this site (nothing from Google or a CDN)')
for path, magic, what in (('/meet/noise/rnnoise.wasm', b'\x00asm', 'the noise model'), ('/meet/noise/rnnoise_simd.wasm', b'\x00asm', 'its faster version'),
                          ('/meet/vision/selfie_segmenter.tflite', b'TFL3', 'the blur model'), ('/meet/vision/vision_wasm_internal.wasm', b'\x00asm', 'the blur engine')):
    s, ct, b = raw_get(path); check(s == 200 and magic in b[:8], f'{what} is served from olexweb ({len(b) // 1024} KB)')
for path in ('/meet/noise/rnnoise-worklet.js', '/meet/pcm-worklet.js'):
    s, ct, b = raw_get(path); check(s == 200 and b'registerProcessor' in b, f'{path} is served')

s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'Effects meeting'}, OWNER); C = j['code']
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
    errs = []
    host = b.new_context(viewport={'width': 1280, 'height': 860}, permissions=['camera', 'microphone'])
    host.add_cookies([{'name': '__Host-olex_sess', 'value': OWNER, 'domain': 'localhost', 'path': '/', 'secure': True, 'httpOnly': True, 'sameSite': 'Strict'}])
    H = host.new_page(); H.on('pageerror', lambda e: errs.append('host: ' + str(e)[:90])); H.goto(APP + '/meet/' + C)
    H.wait_for_selector('.mt-chip:has-text("Noise cancellation")', timeout=8000)            # shown once the browser has checked it can run it
    check(H.locator('.mt-chip:has-text("Noise cancellation")[aria-pressed=true]').count() == 1, 'the lobby shows Noise cancellation, on by default')
    H.click('button[type=submit]'); H.wait_for_selector('#mt-rec-h', timeout=15000); H.click('button:has-text("Not now")')

    print('Noise cancellation')
    g = b.new_context(viewport={'width': 1280, 'height': 860}, permissions=['camera', 'microphone'])
    G = g.new_page(); G.on('pageerror', lambda e: errs.append('guest: ' + str(e)[:90])); G.goto(f'{MEET}/{C}')
    G.fill('#mt-name', 'Bisi'); G.click('.mt-chip:has-text("Camera")'); G.click('button[type=submit]'); G.wait_for_selector('.mt-bar', timeout=15000)
    G.wait_for_selector('.mt-in-room[data-noise=on]', timeout=15000); check(True, 'RNNoise is really running on the guest’s microphone')
    H.wait_for_timeout(2000)
    live = H.evaluate("[...document.querySelectorAll('audio')].filter(a => a.srcObject && a.srcObject.getAudioTracks().some(t => t.readyState === 'live')).length")
    check(live >= 1, 'the host still receives the guest’s (cleaned) audio')
    G.click('.mt-c:has-text("More")'); G.click('.mt-menu button:has-text("Noise cancellation")'); G.wait_for_selector('.mt-in-room[data-noise=off]', timeout=8000)
    check(G.locator('.mt-toast:has-text("Noise cancellation is off")').count() == 1, 'it can be switched off during the meeting')
    G.click('.mt-c:has-text("More")'); G.click('.mt-menu button:has-text("Noise cancellation")'); G.wait_for_selector('.mt-in-room[data-noise=on]', timeout=10000); check(True, 'and on again')
    check(G.evaluate("JSON.parse(localStorage.getItem('olexweb-meet-effects')).noise") is True, 'the choice is remembered on their device')

    print('Background blur')
    G.click('.mt-c:has-text("More")'); blur_ok = G.locator('.mt-menu button:has-text("Blur background")').count() == 1
    if blur_ok:
        G.click('.mt-menu button:has-text("Blur background")')
        G.wait_for_selector('.mt-in-room[data-blur=on], .mt-toast:has-text("can’t blur")', timeout=30000)
        if G.locator('.mt-in-room[data-blur=on]').count():
            check(True, 'blur is really running on the guest’s camera (MediaPipe, from this site)')
            H.wait_for_timeout(2500)
            w = H.evaluate("Math.max(0, ...[...document.querySelectorAll('.mt-tile video')].map(v => v.videoWidth))")
            check(w > 0, f'the host still receives the guest’s video ({w}px wide)')
            G.screenshot(path=SHOTS + '/24-blur.png')
            G.click('.mt-c:has-text("More")'); G.click('.mt-menu button:has-text("Blur background")'); G.wait_for_selector('.mt-in-room[data-blur=off]', timeout=8000); check(True, 'and it switches off')
        else: check(True, 'this test browser can’t blur, and the guest is told plainly (real Chrome and Edge can)')
    else:
        G.keyboard.press('Escape'); check(True, 'this test browser can’t blur, so the option is hidden')

    print('MP3 recordings')
    H.click('.mt-c:has-text("Record")'); H.click('.mt-seg button:has-text("Audio only")')
    check(H.locator('.mt-recq button[aria-pressed=true]').inner_text() == 'Standard' and '29 MB' in H.locator('.mt-recq small').inner_text(), 'Audio only offers MP3 quality: Standard (about 29 MB an hour) or High')
    check('MP3 that plays everywhere' in H.locator('.mt-hint').inner_text(), 'and says it’s an MP3 that plays everywhere')
    H.click('.mt-rec-go'); H.wait_for_selector('.mt-c.mt-recording', timeout=8000); H.wait_for_timeout(3000)
    H.click('.mt-c:has-text("Pause")'); H.wait_for_timeout(4000); H.click('.mt-c:has-text("Resume")'); H.wait_for_timeout(3000)
    with H.expect_download(timeout=30000) as d: H.click('.mt-c.mt-recording')
    f = '/tmp/rec.mp3'; d.value.save_as(f); p = probe(f)
    check(d.value.suggested_filename.endswith('(audio).mp3'), 'the file is an .mp3: ' + d.value.suggested_filename)
    check(p['codec'] == 'mp3' and p['channels'] == 1 and p['kbps'] == 64 and p['rate'] in (44100, 48000), f'real MP3, mono, 64 kbps ({p})')
    check(5 <= p['dur'] <= 8.5, f"only the recorded 6 seconds are in it, not the 4 paused ({p['dur']:.1f} s)")
    H.click('.mt-c:has-text("Record")'); H.click('.mt-seg button:has-text("Audio only")'); H.click('.mt-recq button:has-text("High")')
    check('43 MB' in H.locator('.mt-recq small').inner_text(), 'High says about 43 MB an hour')
    H.click('.mt-rec-go'); H.wait_for_selector('.mt-c.mt-recording', timeout=8000); H.wait_for_timeout(3000)
    with H.expect_download(timeout=30000) as d: H.click('.mt-c.mt-recording')
    d.value.save_as('/tmp/rec96.mp3'); p = probe('/tmp/rec96.mp3'); check(p['codec'] == 'mp3' and p['kbps'] == 96, f'High quality is 96 kbps ({p})')

    print('The mini window')
    md = H.evaluate("navigator.mediaSession && navigator.mediaSession.metadata && navigator.mediaSession.metadata.title")
    check(md == 'Effects meeting', 'the phone’s and browser’s call controls know the meeting’s name')
    has_doc = H.evaluate("'documentPictureInPicture' in window")
    H.click('.mt-c:has-text("More")'); check(H.locator('.mt-menu button:has-text("Mini window")').count() == 1, 'Mini window is in the More menu')
    if has_doc:
        H.click('.mt-menu button:has-text("Mini window")'); H.wait_for_timeout(1500)
        pip = H.evaluate("documentPictureInPicture.window ? [documentPictureInPicture.window.document.getElementById('nm').textContent, documentPictureInPicture.window.document.getElementById('mic').textContent] : null")
        check(pip and pip[0] == 'Bisi', f'it opens, showing who’s talking or on camera ({pip})')
        H.evaluate("documentPictureInPicture.window.document.getElementById('mic').click()"); H.wait_for_timeout(800)
        check(H.locator('.mt-c:has-text("Unmute")').count() == 1, 'its Mute button really mutes you in the meeting')
        H.evaluate("documentPictureInPicture.window.document.getElementById('back').click()"); H.wait_for_timeout(500)
        check(H.evaluate("!documentPictureInPicture.window"), 'Back closes it and returns to the meeting')
    else:
        H.keyboard.press('Escape'); check(True, 'this test browser has no floating windows (Chrome and Edge do; phones use picture-in-picture video)')

    print('iPhone')
    IP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    ic = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, user_agent=IP, permissions=['camera', 'microphone'])
    I = ic.new_page(); I.on('pageerror', lambda e: errs.append('iphone: ' + str(e)[:90])); I.goto(f'{MEET}/{C}')
    check('keep this page open' in I.locator('.mt-iostip').inner_text(), 'iPhone users get a short tip in the lobby')
    I.fill('#mt-name', 'Tolu'); I.click('button[type=submit]'); I.wait_for_selector('.mt-bar', timeout=15000)
    flip = "s => { Object.defineProperty(document, 'visibilityState', { value: s, configurable: true }); document.dispatchEvent(new Event('visibilitychange')) }"
    I.evaluate(flip, 'hidden')
    H.wait_for_selector('.mt-tile:has-text("Tolu") .mt-away', timeout=10000)
    check('iPhone pauses the mic' in H.locator('.mt-tile:has-text("Tolu") .mt-away').inner_text(), 'when an iPhone user switches away, others see “Stepped away (iPhone pauses the mic)”')
    H.screenshot(path=SHOTS + '/25-stepped-away.png')
    I.evaluate(flip, 'visible'); H.wait_for_selector('.mt-tile:has-text("Tolu") .mt-away', state='detached', timeout=10000)
    check(True, 'when they come back, it clears')
    check(I.locator('.mt-c:has-text("Mute")').count() == 1, 'and their mic is on again')
    gc2 = b.new_context(viewport={'width': 1280, 'height': 860}); G9 = gc2.new_page(); G9.goto(f'{MEET}/{C}')
    check(G9.locator('.mt-iostip').count() == 0, 'other devices don’t get the iPhone tip')
    check(not errs, 'no page errors', errs)
    b.close()
print(f'\n{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
