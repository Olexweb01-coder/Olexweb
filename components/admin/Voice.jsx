'use client'
// Speak instead of typing: records on this device, then Olex AI turns it into text (Whisper on Groq, Cloudflare as backup).
// The words go into the message box for you to check; nothing is sent until you tap Send. Audio is not kept.
import { useEffect, useRef, useState } from 'react'
import { Icon } from './icons'
import { toast } from './ui'

const MAX_S = 180                                                          // 3 minutes: well inside Vercel's upload limit
const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
const mm = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function Voice({ onText, disabled }) {
  const [ok, setOk] = useState(false), [state, setState] = useState('idle'), [secs, setSecs] = useState(0)
  const rec = useRef(null), chunks = useRef([]), timer = useRef(0), cancelled = useRef(false), stream = useRef(null)
  useEffect(() => { setOk(typeof window !== 'undefined' && !!(navigator.mediaDevices && window.MediaRecorder)) }, [])
  useEffect(() => () => { clearInterval(timer.current); stream.current && stream.current.getTracks().forEach((t) => t.stop()) }, [])
  if (!ok) return null

  async function start() {
    let s
    try { s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }) }
    catch { toast('Allow the microphone for this site to speak to Olex AI.'); return }
    stream.current = s; chunks.current = []; cancelled.current = false
    const type = TYPES.find((t) => MediaRecorder.isTypeSupported(t))
    const r = new MediaRecorder(s, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32000 })
    r.ondataavailable = (e) => { if (e.data && e.data.size) chunks.current.push(e.data) }
    r.onstop = () => { s.getTracks().forEach((t) => t.stop()); clearInterval(timer.current); if (!cancelled.current) send(new Blob(chunks.current, { type: r.mimeType || type || 'audio/webm' })); else setState('idle') }
    rec.current = r; r.start(1000); setSecs(0); setState('rec')
    timer.current = setInterval(() => setSecs((x) => { if (x + 1 >= MAX_S) stop(); return x + 1 }), 1000)
  }
  function stop() { if (rec.current && rec.current.state !== 'inactive') rec.current.stop() }
  function cancel() { cancelled.current = true; stop() }
  async function send(blob) {
    if (blob.size < 1500) { setState('idle'); toast('That was too short to hear. Try again.'); return }
    setState('busy')
    const fd = new FormData(); fd.append('audio', blob, 'voice.' + (/mp4/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : 'webm'))
    try {
      const r = await fetch('/admin/api/transcribe', { method: 'POST', body: fd, credentials: 'same-origin' })
      if (r.status === 401) { window.location.assign('/admin/login'); return }
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Olex AI couldn’t turn that into text. Try again.')
      if (j.text) onText(j.text); else toast('No words were heard. Try again closer to the mic.')
    } catch (e) { toast(e.message || 'No connection. Try again.') } finally { setState('idle') }
  }

  if (state === 'rec') return (<span className="rec" role="status" aria-live="polite">
    <button type="button" className="icon-btn" onClick={cancel} aria-label="Cancel the recording">{Icon.close}</button>
    <span className="rec-dot" aria-hidden="true" /><span className="rec-t">{mm(secs)}</span>
    <button type="button" className="icon-btn rec-stop" onClick={stop} aria-label="Stop and turn into text">{Icon.stop}</button>
  </span>)
  return <button type="button" className={'icon-btn mic' + (state === 'busy' ? ' busy' : '')} onClick={start} disabled={disabled || state === 'busy'} aria-label={state === 'busy' ? 'Turning your words into text' : 'Speak your message'} title="Speak your message">{Icon.mic}</button>
}
