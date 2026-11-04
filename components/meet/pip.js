'use client'
// Olexweb Meet's floating mini window, so a meeting keeps going while you use other tabs or apps.
//  - Chrome and Edge on computers: a real small window (Document Picture-in-Picture) with the speaker's video, their
//    name, and Mute, Camera, Leave and Back buttons. It can be dragged anywhere and stays on top.
//  - Elsewhere (Android, iPhone, Safari, Firefox): the speaker's video as a floating picture-in-picture video, with the
//    phone's own call buttons (Media Session: microphone, camera, hang up) where the browser offers them.
//  - Where the browser allows it (Chrome's automatic picture-in-picture for calls), it opens by itself when you switch away.
// The speaker shown follows who is talking. Audio keeps playing from the meeting page underneath.
// iPhone limit (Apple's rule for all web apps): the microphone pauses while the browser is in the background.

export const canMini = () => typeof window !== 'undefined' && ('documentPictureInPicture' in window || (document.pictureInPictureEnabled && typeof HTMLCanvasElement.prototype.captureStream === 'function'))

export class MiniWindow {
  // room: the LiveKit room; lk: livekit-client; actions: { mic(), cam(), leave(), state() → { micOn, camOn, title } }
  constructor({ room, lk, actions }) { Object.assign(this, { room, lk, actions }) }
  get open() { return !!(this.win || this.pipVideo) }

  // who to show: the person talking now, else someone with their camera on, else whoever is here
  speaker() {
    const r = this.room, S = this.lk.Track.Source
    const all = [...r.remoteParticipants.values()]
    const cam = (p) => { const pub = p.getTrackPublication(S.ScreenShare) || p.getTrackPublication(S.Camera); return pub && pub.track && !pub.isMuted ? pub.track : null }
    const talking = r.activeSpeakers.find((p) => p !== r.localParticipant)
    const p = talking || all.find((x) => cam(x)) || all[0] || r.localParticipant
    return { p, track: cam(p), name: p === r.localParticipant ? 'You' : (p.name || 'Guest') }
  }

  async show() {
    if (this.open) return
    if ('documentPictureInPicture' in window) return this.showWindow()
    return this.showVideo()
  }

  // ---- Chrome / Edge: a small window with controls ----
  async showWindow() {
    const win = await window.documentPictureInPicture.requestWindow({ width: 360, height: 260 })
    this.win = win
    const d = win.document
    d.head.innerHTML = `<meta charset="utf-8"><title>Olexweb Meet</title><style>
      *{box-sizing:border-box}html,body{margin:0;height:100%;background:#0a0b0a;color:#f2efe9;font:600 14px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden}
      .v{position:absolute;inset:0 0 54px;display:grid;place-items:center;background:#151815}video{width:100%;height:100%;object-fit:cover}
      .av{width:84px;height:84px;border-radius:50%;display:grid;place-items:center;background:#1f2a1c;color:#8fe36a;font-size:34px;font-weight:800}
      .nm{position:absolute;left:10px;bottom:62px;padding:4px 10px;border-radius:999px;background:rgba(10,11,10,.7);font-size:13px;max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .bar{position:absolute;left:0;right:0;bottom:0;height:54px;display:flex;gap:8px;align-items:center;justify-content:center;background:#0f110f}
      button{all:unset;cursor:pointer;height:38px;min-width:38px;padding:0 12px;border-radius:999px;background:#1d211d;display:grid;place-items:center;font-size:13px}
      button:hover{background:#262b26}button.off{background:#3a1e1b;color:#ff9b8f}button.leave{background:#c4473a;color:#fff}button.back{background:#8fe36a;color:#0e1a0b}
      button:focus-visible{outline:2px solid #8fe36a;outline-offset:2px}
    </style>`
    d.body.innerHTML = `<div class="v"><div class="av" id="av"></div></div><div class="nm" id="nm"></div>
      <div class="bar"><button id="mic"></button><button id="cam"></button><button class="leave" id="leave" title="Leave">Leave</button><button class="back" id="back">Back</button></div>`
    const $ = (id) => d.getElementById(id)
    $('mic').onclick = async () => { await this.actions.mic(); this.paint() }
    $('cam').onclick = async () => { await this.actions.cam(); this.paint() }
    $('leave').onclick = () => { this.close(); this.actions.leave() }
    $('back').onclick = () => { window.focus(); this.close() }
    win.addEventListener('pagehide', () => this.cleanup())
    this.tick = setInterval(() => this.paint(), 1000); this.paint()
  }
  paint() {
    const d = this.win && this.win.document; if (!d) return
    const st = this.actions.state(), sp = this.speaker(), box = d.querySelector('.v')
    d.getElementById('mic').textContent = st.micOn ? 'Mute' : 'Unmute'; d.getElementById('mic').className = st.micOn ? '' : 'off'
    d.getElementById('cam').textContent = st.camOn ? 'Camera off' : 'Camera on'
    d.getElementById('nm').textContent = sp.name
    if (sp.track !== this.shown) {
      if (this.shown && this.shownEl) { try { this.shown.detach(this.shownEl) } catch {} }
      box.innerHTML = ''; this.shown = sp.track; this.shownEl = null
      if (sp.track) { const v = d.createElement('video'); v.autoplay = true; v.muted = true; v.playsInline = true; sp.track.attach(v); box.appendChild(v); this.shownEl = v }
      else { const a = d.createElement('div'); a.className = 'av'; a.textContent = (sp.name || '?').trim()[0].toUpperCase(); box.appendChild(a) }
    }
  }

  // ---- elsewhere: a picture-in-picture video of the speaker (drawn on a canvas so a name card works too) ----
  async showVideo() {
    const c = document.createElement('canvas'); c.width = 640; c.height = 360
    const g = c.getContext('2d'), v = document.createElement('video'), src = document.createElement('video')
    src.muted = true; src.playsInline = true; src.autoplay = true
    const draw = () => {
      const sp = this.speaker()
      if (sp.track !== this.shown) { if (this.shown) { try { this.shown.detach(src) } catch {} } this.shown = sp.track; if (sp.track) sp.track.attach(src) }
      g.fillStyle = '#151815'; g.fillRect(0, 0, 640, 360)
      if (sp.track && src.videoWidth) {
        const k = Math.max(640 / src.videoWidth, 360 / src.videoHeight), w = src.videoWidth * k, h = src.videoHeight * k
        g.drawImage(src, (640 - w) / 2, (360 - h) / 2, w, h)
      } else {
        g.fillStyle = '#1f2a1c'; g.beginPath(); g.arc(320, 165, 62, 0, Math.PI * 2); g.fill()
        g.fillStyle = '#8fe36a'; g.font = '800 58px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((sp.name || '?').trim()[0].toUpperCase(), 320, 168)
      }
      g.fillStyle = 'rgba(10,11,10,.7)'; g.fillRect(0, 312, 640, 48); g.fillStyle = '#f2efe9'; g.font = '600 24px system-ui,sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(sp.name, 18, 336)
    }
    draw(); this.tick = setInterval(draw, 100)                                  // 10 frames a second is plenty for a mini window
    v.muted = true; v.playsInline = true; v.srcObject = c.captureStream(10)
    v.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;bottom:0;left:0'
    document.body.appendChild(v); await v.play()
    this.pipVideo = v; this.srcVideo = src
    v.addEventListener('leavepictureinpicture', () => this.cleanup())
    await v.requestPictureInPicture()
  }

  close() {
    if (this.win) { try { this.win.close() } catch {} }
    if (this.pipVideo && document.pictureInPictureElement === this.pipVideo) document.exitPictureInPicture().catch(() => {})
    this.cleanup()
  }
  cleanup() {
    clearInterval(this.tick); this.tick = null
    if (this.shown) { try { this.shown.detach() } catch {} } this.shown = null; this.shownEl = null
    if (this.pipVideo) { const v = this.pipVideo; this.pipVideo = null; try { v.srcObject && v.srcObject.getTracks().forEach((t) => t.stop()) } catch {} v.remove() }
    this.win = null
    this.onClose && this.onClose()
  }
}

// the phone's and browser's own call controls (Media Session), and opening the mini window by itself when you switch away
export function callControls({ title, mic, cam, leave, mini }) {
  const ms = typeof navigator !== 'undefined' && navigator.mediaSession; if (!ms) return () => {}
  try { ms.metadata = new MediaMetadata({ title: title || 'Meeting', artist: 'Olexweb Meet', artwork: [{ src: '/meet/icon-512.png', sizes: '512x512', type: 'image/png' }] }) } catch {}
  const set = (a, f) => { try { ms.setActionHandler(a, f) } catch {} }
  set('togglemicrophone', mic); set('togglecamera', cam); set('hangup', leave)
  set('enterpictureinpicture', mini)                                         // Chrome: automatic picture-in-picture for calls
  return () => { for (const a of ['togglemicrophone', 'togglecamera', 'hangup', 'enterpictureinpicture']) set(a, null) }
}
export function callState(micOn, camOn) {
  const ms = typeof navigator !== 'undefined' && navigator.mediaSession; if (!ms) return
  try { ms.setMicrophoneActive && ms.setMicrophoneActive(micOn); ms.setCameraActive && ms.setCameraActive(camOn) } catch {}
}
