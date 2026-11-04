// Recording a meeting on the host's own device (no server, no storage cost).
// Video: the stage is drawn into a 1280×720 frame 15 times a second (video tiles, or initials, names, the speaker's green
// edge, a shared screen large with people below). Audio: every voice, including the host's, mixed into one track.
// Every 2 seconds the newest piece is written to the browser's storage (IndexedDB), so a long meeting doesn't fill the
// memory and a crash or closed tab loses nothing: pendingRecordings() finds unsaved ones and saveRecording() rebuilds the file.
// Format: WebM where the browser can record it (Chrome, Edge, Firefox): it hands over a piece every 2 seconds, which is
// what makes it crash-safe (Chrome's MP4 recording holds everything until the end). MP4 is the fallback (Safari).
// Browsers don't write a WebM's length into the file, so players couldn't seek; saveRecording() writes it in.
// For AI notes, a second small audio-only recording (32 kbps) runs alongside and is saved as complete 5-minute files
// (store 'notes', by meeting code), each small enough to transcribe on its own; Admin → Meetings turns them into notes.

const DB = 'olexweb-meet-rec'
function open() {
  return new Promise((ok, no) => {
    const r = indexedDB.open(DB, 2)
    r.onupgradeneeded = () => {
      const d = r.result, has = (n) => d.objectStoreNames.contains(n)
      if (!has('recs')) d.createObjectStore('recs', { keyPath: 'id' })
      if (!has('chunks')) d.createObjectStore('chunks', { keyPath: ['rec', 'seq'] })
      if (!has('notes')) d.createObjectStore('notes', { keyPath: ['code', 'rec', 'part'] })   // added for AI notes
    }
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error)
  })
}
const done = (t) => new Promise((ok, no) => { t.oncomplete = () => ok(); t.onerror = t.onabort = () => no(t.error) })
const all = async (store) => { const d = await open(), t = d.transaction(store), r = t.objectStore(store).getAll(); await done(t); d.close(); return r.result }
async function put(store, value) { const d = await open(); const t = d.transaction(store, 'readwrite'); t.objectStore(store).put(value); await done(t); d.close() }

export async function pendingRecordings() {
  try {
    const d = await open(), t = d.transaction('recs'), all = await new Promise((ok, no) => { const r = t.objectStore('recs').getAll(); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error) })
    d.close(); return all.sort((a, b) => a.startedAt - b.startedAt)
  } catch { return [] }
}
export async function discardRecording(id) {
  const d = await open(), t = d.transaction(['recs', 'chunks'], 'readwrite')
  t.objectStore('recs').delete(id); t.objectStore('chunks').delete(IDBKeyRange.bound([id, 0], [id, Infinity]))
  await done(t); d.close()
}
const ext = (mime) => (/^audio\/mp4/.test(mime) ? 'm4a' : /mp4/.test(mime) ? 'mp4' : 'webm')
export function fileName(rec) {
  const d = new Date(rec.startedAt), p = (n) => String(n).padStart(2, '0')
  const t = String(rec.title || 'Meeting').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Meeting'
  return `${t} ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}${rec.audioOnly ? ' (audio)' : ''}.${ext(rec.mime)}`
}
// rebuilds the file from its pieces, hands it to the browser as a download, then clears it from storage
export async function saveRecording(id) {
  const d = await open(), t = d.transaction(['recs', 'chunks'])
  const rec = await new Promise((ok) => { const r = t.objectStore('recs').get(id); r.onsuccess = () => ok(r.result) })
  const parts = await new Promise((ok) => { const r = t.objectStore('chunks').getAll(IDBKeyRange.bound([id, 0], [id, Infinity])); r.onsuccess = () => ok(r.result) })
  d.close()
  if (!rec || !parts.length) { await discardRecording(id).catch(() => {}); return null }
  parts.sort((a, b) => a.seq - b.seq)
  const blobs = parts.map((x) => x.blob)
  if (/webm/.test(rec.mime)) {                                       // the length goes into the first piece's header
    const ms = Math.max(1000, (parts[parts.length - 1].at || Date.now()) - rec.startedAt - (rec.pausedMs || 0))   // paused time isn't in the file
    blobs[0] = new Blob([withDuration(await blobs[0].arrayBuffer(), ms)], { type: rec.mime })
  }
  const blob = new Blob(blobs, { type: rec.mime })
  const url = URL.createObjectURL(blob), a = document.createElement('a')
  a.href = url; a.download = fileName(rec); a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 120_000)
  await discardRecording(id)
  return { name: a.download, bytes: blob.size }
}

// ---------- writing the length into a WebM (EBML): Segment → Info gets a Duration (float, in milliseconds) ----------
function vint(b, i) {                                                // a size: 1–8 bytes, the first byte says how many
  const f = b[i]; let len = 1, mask = 0x80
  while (len <= 8 && !(f & mask)) { mask >>= 1; len++ }
  if (len > 8 || i + len > b.length) return null
  let v = f & (mask - 1); for (let k = 1; k < len; k++) v = v * 256 + b[i + k]
  return { len, v, unknown: v === 2 ** (7 * len) - 1 }
}
function eid(b, i) {                                                 // an element id: 1–4 bytes
  const f = b[i], len = f & 0x80 ? 1 : f & 0x40 ? 2 : f & 0x20 ? 3 : f & 0x10 ? 4 : 0
  if (!len || i + len > b.length) return null
  let id = 0; for (let k = 0; k < len; k++) id = id * 256 + b[i + k]
  return { len, id }
}
export function withDuration(buf, ms) {
  const b = new Uint8Array(buf)
  let e = eid(b, 0), s = e && vint(b, e.len)
  if (!e || e.id !== 0x1a45dfa3 || !s) return buf                    // not WebM: leave it as it is
  let p = e.len + s.len + s.v
  e = eid(b, p); s = e && vint(b, p + e.len)
  if (!e || e.id !== 0x18538067 || !s) return buf
  p += e.len + s.len                                                 // inside the Segment
  while (p < b.length) {
    const id = eid(b, p), sz = id && vint(b, p + id.len)
    if (!id || !sz) return buf
    const head = id.len + sz.len, end = p + head + sz.v
    if (id.id === 0x1549a966) {                                      // Info
      if (sz.unknown || end > b.length) return buf
      for (let q = p + head; q < end;) { const c = eid(b, q), cs = c && vint(b, q + c.len); if (!c || !cs) return buf; if (c.id === 0x4489) return buf; q += c.len + cs.len + cs.v }
      const dur = new Uint8Array(11); dur.set([0x44, 0x89, 0x88]); new DataView(dur.buffer).setFloat64(3, ms)
      const size = new Uint8Array(8); size[0] = 0x01; for (let k = 7, v = sz.v + 11; k >= 1; k--) { size[k] = v % 256; v = Math.floor(v / 256) }
      const out = new Uint8Array(b.length + 11 + 8 - sz.len)
      let o = 0
      out.set(b.subarray(0, p + id.len), o); o += p + id.len
      out.set(size, o); o += 8
      out.set(b.subarray(p + head, end), o); o += sz.v
      out.set(dur, o); o += 11
      out.set(b.subarray(end), o)
      return out.buffer
    }
    if (sz.unknown) return buf
    p = end
  }
  return buf
}

function pickMime(audioOnly) {
  const list = audioOnly ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4']
    : ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4']
  return list.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || ''
}
export const canRecord = () => typeof window !== 'undefined' && !!window.MediaRecorder && !!window.indexedDB && !!(window.AudioContext || window.webkitAudioContext)

// a timer that keeps ticking when the tab is in the background (browsers slow normal timers there to once a second)
function ticker(ms, fn) {
  const src = URL.createObjectURL(new Blob(['let t;onmessage=e=>{clearInterval(t);if(e.data)t=setInterval(()=>postMessage(0),e.data)}'], { type: 'text/javascript' }))
  const w = new Worker(src); URL.revokeObjectURL(src)
  w.onmessage = fn; w.postMessage(ms)
  return () => { w.postMessage(0); w.terminate() }
}

// ---------- the audio kept for AI notes ----------
export async function notesAudio() {                                 // { code: [parts in order] }
  try {
    const by = {}
    for (const x of await all('notes')) (by[x.code] = by[x.code] || []).push(x)
    for (const k in by) by[k].sort((a, b) => a.startedAt - b.startedAt || a.part - b.part)
    return by
  } catch { return {} }
}
export const keepNotesText = (part) => put('notes', part)               // a transcribed part keeps its text, so a retry skips it
export async function dropNotesAudio(code) {
  const d = await open(), t = d.transaction('notes', 'readwrite')
  t.objectStore('notes').delete(IDBKeyRange.bound([code, '', 0], [code, '\uffff', Infinity])); await done(t); d.close()
}
const NOTES_MS = () => (typeof window !== 'undefined' && window.__olexNotesPieceMs) || 5 * 60_000   // tests use a few seconds

const W = 1280, H = 720, PAD = 16, GAP = 12, FOOT = 34
export class MeetRecorder {
  constructor({ room, title, audioOnly, stage, code, notesOnly = false }) { Object.assign(this, { room, title, audioOnly: audioOnly || notesOnly, stage, code, notesOnly }); this.sources = new Map(); this.writes = []; this.seq = 0; this.part = 0 }

  async start() {
    const mime = pickMime(this.audioOnly)
    if (!mime) throw new Error('This browser can’t record. Use Chrome, Edge or Safari on a computer.')
    const AC = window.AudioContext || window.webkitAudioContext
    this.ac = new AC(); await this.ac.resume().catch(() => {})
    this.dest = this.ac.createMediaStreamDestination()
    this.syncAudio()
    let tracks = [...this.dest.stream.getAudioTracks()]
    if (!this.audioOnly) {
      this.canvas = document.createElement('canvas'); this.canvas.width = W; this.canvas.height = H
      this.ctx = this.canvas.getContext('2d')
      this.font = (getComputedStyle(document.documentElement).getPropertyValue('--font-hubot') || '').trim() || 'system-ui, sans-serif'
      this.draw()
      tracks = [...this.canvas.captureStream(15).getVideoTracks(), ...tracks]
    }
    this.id = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    if (this.notesOnly) {                                                     // the AI note taker alone: only the 5-minute notes pieces, no file kept
      this.meta = { id: this.id, notesOnly: true, startedAt: Date.now() }
      this.mr = { state: 'recording', pause() { this.state = 'paused' }, resume() { this.state = 'recording' } }
      this.notesMime = this.code ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) : ''
      if (!this.notesMime) throw new Error('This browser can’t take AI notes. Use Chrome, Edge or Safari.')
      this.notesPiece()
      let k = 0
      this.stopTick = ticker(500, () => { if (++k % 2 === 0) { this.syncAudio(); if (this.nr && !this.paused && Date.now() - this.nrAt - (this.nrPaused || 0) >= NOTES_MS()) this.notesPiece() } })
      return this.meta
    }
    this.meta = { id: this.id, title: this.title, mime, audioOnly: !!this.audioOnly, startedAt: Date.now() }
    await put('recs', this.meta)
    this.mr = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: 900_000, audioBitsPerSecond: 64_000 })
    this.mr.ondataavailable = (e) => { if (e.data && e.data.size) this.writes.push(put('chunks', { rec: this.id, seq: this.seq++, blob: e.data, at: Date.now() }).catch(() => {})) }
    this.stopped = new Promise((ok) => { this.mr.onstop = ok })
    this.mr.start(2000)
    this.notesMime = this.code ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) : ''
    if (this.notesMime) this.notesPiece()
    let n = 0
    this.stopTick = ticker(this.audioOnly ? 500 : 1000 / 15, () => {
      if (!this.audioOnly) this.draw()
      if (++n % (this.audioOnly ? 1 : 8) === 0) { this.syncAudio(); if (this.nr && !this.paused && Date.now() - this.nrAt - (this.nrPaused || 0) >= NOTES_MS()) this.notesPiece() }
    })
    return this.meta
  }

  // one complete audio file per 5 minutes for the notes: the current one is closed (and saved) as the next starts
  // pause: nothing from now on goes into the recording or the notes, until resume (for a bad patch of network, say)
  pause() {
    if (!this.mr || this.paused) return
    this.paused = Date.now()
    if (this.mr.state === 'recording') this.mr.pause()
    if (this.nr && this.nr.state === 'recording') this.nr.pause()
  }
  resume() {
    if (!this.mr || !this.paused) return
    const gap = Date.now() - this.paused; this.paused = 0
    this.meta.pausedMs = (this.meta.pausedMs || 0) + gap; this.nrPaused = (this.nrPaused || 0) + gap
    if (!this.notesOnly) put('recs', this.meta).catch(() => {})
    if (this.mr.state === 'paused') this.mr.resume()
    if (this.nr && this.nr.state === 'paused') this.nr.resume()
  }
  notesPiece() {
    const old = this.nr
    if (old && old.state !== 'inactive') old.stop()
    const nr = new MediaRecorder(new MediaStream(this.dest.stream.getAudioTracks()), { mimeType: this.notesMime, audioBitsPerSecond: 32_000 })
    const part = this.part++, startedAt = Date.now()
    nr.ondataavailable = (e) => { if (e.data && e.data.size) this.writes.push(put('notes', { code: this.code, rec: this.id, part, blob: e.data, mime: this.notesMime, title: this.title, startedAt, at: Date.now() }).catch(() => {})) }
    nr.stopped = new Promise((ok) => { nr.onstop = ok })
    nr.start(); this.nr = nr; this.nrAt = startedAt; this.nrPaused = 0
  }

  // stops, writes the last piece, and downloads the file. Returns { name, bytes, notes } (notes: pieces kept for AI notes).
  async stop() {
    if (!this.mr) return null
    if (this.paused) this.resume()                                           // so the last piece is written and the length is right
    if (this.stopTick) this.stopTick()
    if (this.notesOnly) { this.mr.state = 'inactive' } else if (this.mr.state !== 'inactive') { this.mr.stop(); await this.stopped }
    if (this.nr && this.nr.state !== 'inactive') { this.nr.stop(); await this.nr.stopped }
    await Promise.all(this.writes)
    for (const s of this.sources.values()) s.disconnect()
    this.sources.clear(); this.ac.close().catch(() => {}); this.mr = null; this.nr = null
    if (this.notesOnly) return { name: null, bytes: 0, notes: this.part }
    const f = await saveRecording(this.id)
    return f && { ...f, notes: this.notesMime ? this.part : 0 }
  }

  // everyone's voice (and the host's own mic) into the mix; people who join or leave are added or dropped
  syncAudio() {
    const r = this.room, live = new Set()
    if (!r) return
    const add = (pub) => {
      const t = pub && pub.track && pub.track.mediaStreamTrack
      if (!t || t.readyState !== 'live') return
      live.add(t.id)
      if (!this.sources.has(t.id)) { const s = this.ac.createMediaStreamSource(new MediaStream([t])); s.connect(this.dest); this.sources.set(t.id, s) }
    }
    for (const pub of r.localParticipant.audioTrackPublications.values()) add(pub)
    for (const p of r.remoteParticipants.values()) for (const pub of p.audioTrackPublications.values()) add(pub)
    for (const [id, s] of this.sources) if (!live.has(id)) { s.disconnect(); this.sources.delete(id) }
  }

  // one frame of the stage, read from what the host sees (so it matches the meeting exactly)
  draw() {
    const c = this.ctx, st = this.stage
    c.fillStyle = '#0a0b0a'; c.fillRect(0, 0, W, H)
    if (!st) return
    const share = st.querySelector('.mt-share video')
    const tiles = [...st.querySelectorAll('.mt-grid .mt-tile[data-name]')]
    const area = { x: PAD, y: PAD, w: W - PAD * 2, h: H - PAD * 2 - FOOT }
    if (share && share.videoWidth) {
      const stripH = tiles.length ? Math.round(area.h * 0.2) : 0
      this.video(share, area.x, area.y, area.w, area.h - (stripH ? stripH + GAP : 0), false)
      const n = Math.min(tiles.length, 5), tw = Math.min((stripH * 16) / 9, (area.w - GAP * (n - 1)) / Math.max(1, n))
      tiles.slice(0, n).forEach((el, i) => this.tile(el, area.x + i * (tw + GAP), area.y + area.h - stripH, tw, stripH))
    } else if (tiles.length) {
      const n = tiles.length, cols = n === 1 ? 1 : n <= 4 ? 2 : 3, rows = Math.ceil(n / cols)
      let tw = (area.w - GAP * (cols - 1)) / cols, th = (tw * 9) / 16
      if (th * rows + GAP * (rows - 1) > area.h) { th = (area.h - GAP * (rows - 1)) / rows; tw = (th * 16) / 9 }
      const gx = area.x + (area.w - (tw * cols + GAP * (cols - 1))) / 2, gy = area.y + (area.h - (th * rows + GAP * (rows - 1))) / 2
      tiles.forEach((el, i) => {
        const row = Math.floor(i / cols), inRow = Math.min(cols, n - row * cols), off = ((cols - inRow) * (tw + GAP)) / 2   // a short last row is centred
        this.tile(el, gx + off + (i % cols) * (tw + GAP), gy + row * (th + GAP), tw, th)
      })
    }
    c.font = `600 15px ${this.font}`; c.fillStyle = 'rgba(242,239,233,.55)'; c.textBaseline = 'middle'
    c.textAlign = 'left'; c.fillText(this.title || 'Meeting', PAD + 4, H - FOOT / 2 - 2)
    c.textAlign = 'right'; c.fillText('olexweb.com', W - PAD - 4, H - FOOT / 2 - 2); c.textAlign = 'left'
  }
  round(x, y, w, h, r) { const c = this.ctx; c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h) }
  video(v, x, y, w, h, cover) {
    const c = this.ctx, vw = v.videoWidth, vh = v.videoHeight
    c.save(); this.round(x, y, w, h, 18); c.fillStyle = '#000'; c.fill(); c.clip()
    const s = cover ? Math.max(w / vw, h / vh) : Math.min(w / vw, h / vh), dw = vw * s, dh = vh * s
    try { c.drawImage(v, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh) } catch {}
    c.restore()
  }
  tile(el, x, y, w, h) {
    const c = this.ctx, v = el.querySelector('video')
    if (v && v.videoWidth) this.video(v, x, y, w, h, true)
    else {
      c.save(); this.round(x, y, w, h, 18); c.fillStyle = '#151815'; c.fill(); c.restore()
      const r = Math.min(w, h) * 0.2
      c.beginPath(); c.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2); c.fillStyle = el.dataset.tone || '#2b3a2a'; c.fill()
      c.font = `750 ${Math.round(r * 0.8)}px ${this.font}`; c.fillStyle = '#f2efe9'; c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText(el.dataset.initials || '?', x + w / 2, y + h / 2 + 1); c.textAlign = 'left'
    }
    if (el.classList.contains('mt-speaking')) { c.save(); this.round(x + 1.5, y + 1.5, w - 3, h - 3, 17); c.lineWidth = 3; c.strokeStyle = 'rgba(143,227,106,.9)'; c.stroke(); c.restore() }
    const label = (el.dataset.name || 'Guest') + (el.dataset.host ? '  Host' : ''), fs = h < 160 ? 12 : 14
    c.font = `600 ${fs}px ${this.font}`
    const lw = Math.min(c.measureText(label).width + 20, w - 16), lh = fs + 12
    c.save(); this.round(x + 8, y + h - lh - 8, lw, lh, lh / 2); c.fillStyle = 'rgba(10,11,10,.68)'; c.fill(); c.clip()
    c.fillStyle = '#f2efe9'; c.textBaseline = 'middle'; c.fillText(label, x + 18, y + h - 8 - lh / 2 + 1); c.restore()
  }
}
