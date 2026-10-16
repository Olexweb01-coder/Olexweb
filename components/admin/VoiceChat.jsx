'use client'
// Talk with Olex AI: a hands-free voice conversation. You speak, it listens (words appear live), you pause, it answers
// out loud sentence by sentence, then listens again. Tap the orb to interrupt or to send early.
// Listening uses the browser's speech recognition, or (where that's missing) records and transcribes on the server.
// Speaking uses the voices built into this device, so it's free and instant; pick one under Voice.
// Everything said is saved in the chat as normal messages.
import { useEffect, useRef, useState } from 'react'
import { Icon } from './icons'

const MARK = 'FULL VERSION FOR THE CHAT:'
const SILENCE_MS = 1300
const RATES = [['Slower', 0.9], ['Normal', 1.05], ['Faster', 1.25]]
const store = { get: (k) => { try { return localStorage.getItem(k) } catch { return null } }, set: (k, v) => { try { localStorage.setItem(k, v) } catch {} } }
// What gets read aloud: never code, links, Markdown symbols or the hidden action line.
const speakable = (t) => String(t || '').split(MARK)[0].split('<<<')[0]
  .replace(/```[\s\S]*?(```|$)/g, ' ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/https?:\/\/\S+/g, 'the link')
  .replace(/[*_#>`|~]/g, '').replace(/^\s*[-•]\s+/gm, '').replace(/\s+/g, ' ')

export default function VoiceChat({ chatId: startId, first, onClose }) {
  const [phase, setPhase] = useState('starting'), [heard, setHeard] = useState(''), [said, setSaid] = useState(''), [note, setNote] = useState('')
  const [voices, setVoices] = useState([]), [voiceName, setVoiceName] = useState(''), [rate, setRate] = useState(1.05), [panel, setPanel] = useState(false)
  const R = useRef({}).current                                         // everything the loop needs without re-rendering
  const canvas = useRef(null)
  const set = (p) => { R.phase = p; setPhase(p) }

  // ---------- voices on this device ----------
  useEffect(() => {
    if (!('speechSynthesis' in window)) { setNote('This browser can’t speak replies aloud. You’ll still see them.'); return }
    const load = () => {
      const all = speechSynthesis.getVoices()
      const sorted = [...all].sort((a, b) => (/^en/i.test(b.lang) - /^en/i.test(a.lang)) || (/NG|GB|US/.test(b.lang) - /NG|GB|US/.test(a.lang)) || a.name.localeCompare(b.name))
      setVoices(sorted)
      const saved = store.get('olex_voice'), pick = sorted.find((v) => v.name === saved) || sorted.find((v) => /en-NG/i.test(v.lang)) || sorted.find((v) => /^en/i.test(v.lang) && /natural|google|online/i.test(v.name)) || sorted.find((v) => /^en/i.test(v.lang)) || sorted[0]
      if (pick) { setVoiceName(pick.name); R.voice = pick }
    }
    load(); speechSynthesis.addEventListener('voiceschanged', load)
    const r = Number(store.get('olex_rate')); if (r) { setRate(r); R.rate = r } else R.rate = 1.05
    return () => speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])
  function chooseVoice(name) { const v = voices.find((x) => x.name === name); setVoiceName(name); R.voice = v; store.set('olex_voice', name); sample() }
  function chooseRate(r) { setRate(r); R.rate = r; store.set('olex_rate', String(r)); sample() }
  function sample() { if (!('speechSynthesis' in window) || R.phase === 'speaking') return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(`Hi ${first}, this is how I sound.`); if (R.voice) u.voice = R.voice; u.rate = R.rate || 1.05; speechSynthesis.speak(u) }

  // ---------- start and stop ----------
  useEffect(() => {
    R.chatId = startId; R.added = []; R.closed = false; R.level = 0; R.pulse = 0
    start()
    const key = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('keydown', key); cleanup() }
  }, [])
  async function start() {
    if ('speechSynthesis' in window) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u) }   // unlocks speech on phones
    try { R.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }) }
    catch { set('error'); setNote('Allow the microphone for this site, then open voice chat again.'); return }
    try { const AC = window.AudioContext || window.webkitAudioContext; R.ac = new AC(); const src = R.ac.createMediaStreamSource(R.mic); R.an = R.ac.createAnalyser(); R.an.fftSize = 512; src.connect(R.an); R.buf = new Uint8Array(R.an.fftSize) } catch {}
    R.SR = window.SpeechRecognition || window.webkitSpeechRecognition
    draw(); listen()
  }
  function cleanup() {
    R.closed = true; clearTimeout(R.silence); cancelAnimationFrame(R.raf)
    try { R.sr && R.sr.abort() } catch {}
    try { R.rec && R.rec.state !== 'inactive' && R.rec.stop() } catch {}
    if ('speechSynthesis' in window) speechSynthesis.cancel()
    if (R.mic) R.mic.getTracks().forEach((t) => t.stop())
    if (R.ac) R.ac.close().catch(() => {})
  }
  function close() { cleanup(); onClose(R.chatId, R.added) }

  // ---------- listening ----------
  function listen() {
    if (R.closed) return
    set('listening'); setHeard(''); R.heard = ''; R.turnSent = false
    if (R.SR && !R.noSR) listenSR(); else listenVAD()
  }
  function listenSR() {
    const sr = new R.SR(); R.sr = sr
    sr.continuous = true; sr.interimResults = true; sr.lang = navigator.language || 'en-NG'
    sr.onresult = (ev) => {
      let t = ''; for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript
      R.heard = t.trim(); setHeard(R.heard)
      clearTimeout(R.silence); R.silence = setTimeout(() => endTurn(), SILENCE_MS)   // a pause means you've finished
    }
    sr.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'language-not-supported') { R.noSR = true; if (R.phase === 'listening') { try { sr.abort() } catch {} listenVAD() } }
    }
    sr.onend = () => { if (R.sr === sr && R.phase === 'listening' && !R.closed && !R.turnSent) { try { sr.start() } catch {} } }   // browsers stop after a while; keep going
    try { sr.start() } catch { R.noSR = true; listenVAD() }
  }
  // Fallback: record while you speak, stop after a pause, transcribe on the server.
  function listenVAD() {
    R.vad = { recording: false, loud: 0, startAt: Date.now() }
    R.chunks = []
  }
  function vadTick(level) {
    const v = R.vad; if (!v || R.phase !== 'listening' || !R.mic) return
    const now = Date.now()
    if (level > 0.045) { v.loud = now; if (!v.recording) {
      const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t))
      try { R.rec = new MediaRecorder(R.mic, type ? { mimeType: type, audioBitsPerSecond: 32000 } : {}); R.chunks = []; R.rec.ondataavailable = (e) => e.data.size && R.chunks.push(e.data)
        R.rec.onstop = () => transcribeTurn(new Blob(R.chunks, { type: R.rec.mimeType || type || 'audio/webm' })); R.rec.start(250); v.recording = true; setHeard('…') } catch {}
    } }
    if (v.recording && now - v.loud > SILENCE_MS) { v.recording = false; R.vad = null; set('thinking'); try { R.rec.stop() } catch {} }
  }
  async function transcribeTurn(blob) {
    if (R.closed) return
    if (blob.size < 2000) { listen(); return }
    const fd = new FormData(); fd.append('audio', blob, /mp4/.test(blob.type) ? 'v.m4a' : 'v.webm')
    try {
      const r = await fetch('/admin/api/transcribe', { method: 'POST', body: fd, credentials: 'same-origin' }), j = await r.json().catch(() => ({}))
      if (!r.ok || !j.text) { setNote(j.error || 'I didn’t catch that.'); listen(); return }
      setHeard(j.text); R.heard = j.text; send(j.text)
    } catch { setNote('No connection.'); listen() }
  }
  function endTurn() {
    clearTimeout(R.silence)
    if (R.turnSent || R.phase !== 'listening') return
    const text = (R.heard || '').trim()
    if (!text) return
    R.turnSent = true; try { R.sr && R.sr.stop() } catch {}
    send(text)
  }

  // ---------- thinking and speaking ----------
  async function send(text) {
    set('thinking'); setSaid(''); setNote('')
    const myTurn = (R.turn = (R.turn || 0) + 1)
    R.queue = 0; R.streamDone = false; R.spokenTo = 0; R.full = ''
    try {
      const r = await fetch('/admin/api/assistant/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ chatId: R.chatId, text, voice: true }) })
      if (r.status === 401) { window.location.assign('/admin/login'); return }
      if (!r.ok || !r.body) throw new Error('Olex AI couldn’t answer just now.')
      const reader = r.body.getReader(), dec = new TextDecoder(); let buf = ''
      for (;;) {
        const { done, value } = await reader.read(); if (done) break
        buf += dec.decode(value, { stream: true }); let i
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2)
          const ev = (block.match(/^event: (.*)$/m) || [])[1]; let j = {}; try { j = JSON.parse((block.match(/^data: (.*)$/m) || [])[1] || '{}') } catch {}
          if (R.turn !== myTurn) continue                                       // interrupted: keep reading quietly, say nothing
          if (ev === 'delta') { R.full += j.text || ''; feed(false) }
          else if (ev === 'done') { R.chatId = j.chatId; R.added.push(...(j.messages || [])); R.streamDone = true; feed(true) }
          else if (ev === 'error') throw new Error(j.error)
        }
      }
      if (R.turn === myTurn && !R.streamDone) { R.streamDone = true; feed(true) }
    } catch (e) { if (R.turn === myTurn) { setNote(e.message || 'Something went wrong.'); speak('Sorry, I couldn’t answer just now.'); R.streamDone = true } }
  }
  // Speak each finished sentence as soon as it arrives, so the answer starts while the rest is still being written.
  function feed(final) {
    const text = speakable(R.full), rest = text.slice(R.spokenTo)
    let chunk = ''
    if (final) chunk = rest
    else { const re = /[.!?…:](?=\s)/g; let m, last = -1; while ((m = re.exec(rest))) last = m.index; if (last >= 0) chunk = rest.slice(0, last + 1) }
    if (chunk.trim()) { R.spokenTo += chunk.length; speak(chunk.trim()) } else if (final) R.spokenTo = text.length
    setSaid(text.slice(0, R.spokenTo))
    if (final && R.queue === 0) afterSpeaking()
  }
  function speak(sentence) {
    if (!('speechSynthesis' in window)) { if (R.streamDone) afterSpeaking(); return }
    const u = new SpeechSynthesisUtterance(sentence), myTurn = R.turn
    if (R.voice) u.voice = R.voice; u.rate = R.rate || 1.05; u.pitch = 1
    R.queue++
    const done = () => { if (u.__done) return; u.__done = true; clearTimeout(u.__t); R.queue = Math.max(0, R.queue - 1); if (R.turn === myTurn && R.queue === 0 && R.streamDone) afterSpeaking() }
    u.onstart = () => { if (R.turn === myTurn) set('speaking') }
    u.onboundary = () => { R.pulse = 1 }
    u.onend = done; u.onerror = done
    u.__t = setTimeout(done, 4000 + sentence.split(/\s+/).length * 600)   // some browsers forget to say they've finished
    speechSynthesis.speak(u)
  }
  function afterSpeaking() { if (R.closed) return; setTimeout(() => { if (!R.closed && (R.phase === 'speaking' || R.phase === 'thinking')) listen() }, 350) }
  function interrupt() { R.turn++; if ('speechSynthesis' in window) speechSynthesis.cancel(); R.queue = 0; listen() }

  function tapOrb() {
    if (R.phase === 'speaking' || R.phase === 'thinking') interrupt()
    else if (R.phase === 'listening') { if ((R.heard || '').trim()) endTurn() }
    else if (R.phase === 'paused') listen()
  }
  function togglePause() {
    if (R.phase === 'paused') { listen(); return }
    clearTimeout(R.silence); try { R.sr && R.sr.abort() } catch {}; R.sr = null; R.vad = null
    if ('speechSynthesis' in window) speechSynthesis.cancel(); R.turn++; set('paused')
  }

  // ---------- the orb ----------
  function draw() {
    const c = canvas.current; if (!c || R.closed) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2), size = c.clientWidth
    if (c.width !== size * dpr || c.height !== size * dpr) { c.width = size * dpr; c.height = size * dpr }
    const g = c.getContext('2d'), t = performance.now() / 1000, mid = (size * dpr) / 2
    let level = 0
    if (R.an) { R.an.getByteTimeDomainData(R.buf); let sum = 0; for (let i = 0; i < R.buf.length; i++) { const v = (R.buf[i] - 128) / 128; sum += v * v } level = Math.sqrt(sum / R.buf.length) }
    R.level = R.level * 0.8 + level * 0.2; vadTick(level)
    R.pulse *= 0.93
    const p = R.phase, reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const amp = reduce ? 0 : p === 'listening' ? Math.min(1, R.level * 9) * 26 + 3 : p === 'speaking' ? 8 + R.pulse * 18 + Math.sin(t * 7) * 3 : p === 'thinking' ? 5 : 2
    const r0 = size * dpr * 0.3 * (p === 'paused' ? 0.9 : 1)
    g.clearRect(0, 0, c.width, c.height)
    const glow = g.createRadialGradient(mid, mid, r0 * 0.6, mid, mid, r0 * 1.7)
    glow.addColorStop(0, p === 'paused' ? 'rgba(160,170,160,.25)' : 'rgba(143,227,106,.35)'); glow.addColorStop(1, 'rgba(143,227,106,0)')
    g.fillStyle = glow; g.fillRect(0, 0, c.width, c.height)
    g.beginPath()
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2
      const n = Math.sin(a * 3 + t * 1.6) * 0.5 + Math.sin(a * 5 - t * 2.3) * 0.3 + Math.sin(a * 2 + t * 0.9) * 0.2
      const r = r0 + n * amp * dpr
      const x = mid + Math.cos(a) * r, y = mid + Math.sin(a) * r
      i ? g.lineTo(x, y) : g.moveTo(x, y)
    }
    g.closePath()
    const spin = p === 'thinking' && !reduce ? t * 2.4 : t * 0.4
    const fill = g.createLinearGradient(mid + Math.cos(spin) * r0, mid + Math.sin(spin) * r0, mid - Math.cos(spin) * r0, mid - Math.sin(spin) * r0)
    if (p === 'paused') { fill.addColorStop(0, '#9aa39a'); fill.addColorStop(1, '#4f574f') }
    else { fill.addColorStop(0, '#c9f5a8'); fill.addColorStop(0.45, '#8fe36a'); fill.addColorStop(1, '#2e7d4a') }
    g.fillStyle = fill; g.fill()
    const shine = g.createRadialGradient(mid - r0 * 0.35, mid - r0 * 0.4, 0, mid - r0 * 0.35, mid - r0 * 0.4, r0)
    shine.addColorStop(0, 'rgba(255,255,255,.55)'); shine.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = shine; g.fill()
    R.raf = requestAnimationFrame(draw)
  }

  const STATUS = { starting: 'Starting…', listening: heard ? 'Listening. Pause when you’re done.' : 'Listening…', thinking: 'Thinking…', speaking: 'Speaking. Tap to interrupt.', paused: 'Paused. Tap the orb to talk.', error: 'Voice chat needs the microphone.' }
  return (<div className="vc" role="dialog" aria-modal="true" aria-label="Voice chat with Olex AI">
    <div className="vc-top">
      <span className="vc-brand"><img src="/studio/mark.png" alt="" width="18" height="21" />Olex AI voice</span>
      <button type="button" className="vc-chip" onClick={() => setPanel((x) => !x)} aria-expanded={panel}>Voice</button>
    </div>
    {panel ? <div className="vc-panel">
      <label>Voice<select className="input" value={voiceName} onChange={(e) => chooseVoice(e.target.value)}>{voices.map((v) => <option key={v.name} value={v.name}>{v.name.replace(/Microsoft |Google /, '')} ({v.lang})</option>)}</select></label>
      <div className="seg" role="group" aria-label="Speed">{RATES.map(([l, r]) => <button key={l} type="button" aria-pressed={rate === r} onClick={() => chooseRate(r)}>{l}</button>)}</div>
      <p className="vc-hint">These are the voices built into this device, so they’re free and work offline. Phones and computers have different ones.</p>
    </div> : null}
    <button type="button" className={'vc-orb ' + phase} onClick={tapOrb} aria-label={STATUS[phase]}><canvas ref={canvas} aria-hidden="true" /></button>
    <p className="vc-status" aria-live="polite">{STATUS[phase]}</p>
    <p className="vc-caption">{phase === 'speaking' || (phase === 'thinking' && said) ? said : heard ? <span className="you">{heard}</span> : phase === 'listening' ? `Go ahead, ${first}.` : ''}</p>
    {note ? <p className="vc-note">{note}</p> : null}
    <div className="vc-acts">
      <button type="button" className="vc-btn" onClick={togglePause} aria-pressed={phase === 'paused'} aria-label={phase === 'paused' ? 'Resume listening' : 'Pause'}>{phase === 'paused' ? Icon.mic : Icon.pause}</button>
      <button type="button" className="vc-btn end" onClick={close} aria-label="End voice chat">{Icon.close}</button>
    </div>
  </div>)
}
