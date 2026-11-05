'use client'
// Uploads for Pages & links: audio in 3 MB pieces (with progress and retries), and photos through a chest-up 4:5 crop frame.
import { useRef, useState } from 'react'

export function AudioUpload({ onDone, label = 'Upload a recording' }) {
  const inp = useRef(null), [pct, setPct] = useState(null), [err, setErr] = useState('')
  async function go(file) {
    setErr(''); setPct(0)
    try {
      const s = await post('/admin/api/pages/upload', JSON.stringify({ name: file.name, mime: file.type || guess(file.name), bytes: file.size }), 'application/json')
      let url = null
      for (let n = 0; n < s.pieces; n++) {
        const blob = file.slice(n * s.pieceSize, Math.min(file.size, (n + 1) * s.pieceSize))
        for (let t = 0; ; t++) {                              // up to 5 tries per piece, waiting longer each time
          try { const r = await post(`/admin/api/pages/upload?id=${s.id}&n=${n}`, blob, 'application/octet-stream'); url = r.url || url; break }
          catch (e) { if (t >= 4 || /Upload an audio|up to 300|Unknown|Sign in|Only Olaitan/.test(e.message)) throw e; await new Promise((ok) => setTimeout(ok, 1500 * (t + 1))) }
        }
        setPct(Math.round(((n + 1) / s.pieces) * 100))
      }
      const minutes = await new Promise((ok) => { const a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = () => ok(Math.max(1, Math.round(a.duration / 60))); a.onerror = () => ok(null); a.src = URL.createObjectURL(file) })
      onDone(url, minutes); setPct(null)
    } catch (e) { setErr(e.message); setPct(null) }
  }
  return (<span className="up-wrap">
    <input ref={inp} type="file" accept="audio/*,.m4a,.mp3,.aac,.wav,.ogg" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) go(f) }} />
    <button type="button" className="btn btn-line" disabled={pct != null} onClick={() => inp.current.click()}>{pct != null ? `Uploading ${pct}%` : label}</button>
    {pct != null ? <span className="up-bar"><i style={{ transform: `scaleX(${pct / 100})` }} /></span> : null}
    {err ? <span className="up-err" role="alert">{err}</span> : null}
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
  </span>)
}

// ratio: 4/5 for people (chest-up), 1.91 for link previews
export function PhotoUpload({ onDone, ratio = 4 / 5, label = 'Upload a photo', hint = 'Frame from the chest up: face, shoulders and some of the body.' }) {
  const inp = useRef(null), [img, setImg] = useState(null), [z, setZ] = useState(1), [pos, setPos] = useState({ x: 0, y: 0 }), [busy, setBusy] = useState(false), [err, setErr] = useState(''), drag = useRef(null)
  const W = 300, H = Math.round(W / ratio)
  function load(file) { setErr(''); const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { setImg(im); setZ(1); setPos({ x: 0, y: 0 }) }; im.onerror = () => setErr('That file isn’t a photo this browser can open.'); im.src = u }
  const base = img ? Math.max(W / img.width, H / img.height) : 1, s = base * z, dw = img ? img.width * s : 0, dh = img ? img.height * s : 0
  const clamp = (p) => ({ x: Math.min(0, Math.max(W - dw, p.x)), y: Math.min(0, Math.max(H - dh, p.y)) })
  const at = img ? clamp({ x: (W - dw) / 2 + pos.x, y: (H - dh) / 2 + pos.y }) : { x: 0, y: 0 }
  async function save() {
    setBusy(true); setErr('')
    try {
      const outW = ratio < 1 ? 960 : 1200, outH = Math.round(outW / ratio), c = document.createElement('canvas'); c.width = outW; c.height = outH
      const k = outW / W, g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, at.x * k, at.y * k, dw * k, dh * k)
      const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9)), fd = new FormData(); fd.append('file', blob, 'photo.jpg'); fd.append('kind', 'photo')
      const r = await fetch('/admin/api/upload', { method: 'POST', body: fd, credentials: 'same-origin' }), j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'The photo didn’t upload. Try again.')
      onDone(j.url); setImg(null)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (<span className="up-wrap">
    <input ref={inp} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) load(f) }} />
    <button type="button" className="btn btn-line" onClick={() => inp.current.click()}>{label}</button>
    {err && !img ? <span className="up-err" role="alert">{err}</span> : null}
    {img ? <div className="up-ov" role="dialog" aria-modal="true" aria-label="Crop the photo"><div className="up-dl">
      <b>Frame the photo</b><p>{hint} Drag to move, slide to zoom.</p>
      <div className="up-frame" style={{ width: W, height: H }} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, p: pos } }}
        onPointerMove={(e) => { if (!drag.current) return; const d = drag.current; setPos({ x: d.p.x + e.clientX - d.x, y: d.p.y + e.clientY - d.y }) }} onPointerUp={() => { drag.current = null; setPos((p) => { const c = clamp({ x: (W - dw) / 2 + p.x, y: (H - dh) / 2 + p.y }); return { x: c.x - (W - dw) / 2, y: c.y - (H - dh) / 2 } }) }}>
        <img src={img.src} alt="" draggable={false} style={{ width: dw, height: dh, transform: `translate(${at.x}px, ${at.y}px)` }} />
        {ratio < 1 ? <svg className="up-guide" viewBox="0 0 100 125" aria-hidden="true"><ellipse cx="50" cy="38" rx="17" ry="21" /><path d="M14 125c3-26 17-40 36-40s33 14 36 40" /></svg> : null}
      </div>
      <label className="up-z">Zoom<input type="range" min="1" max="3" step="0.01" value={z} onChange={(e) => setZ(Number(e.target.value))} /></label>
      {err ? <span className="up-err" role="alert">{err}</span> : null}
      <div className="up-bt"><button type="button" className="btn btn-line" onClick={() => setImg(null)}>Cancel</button><button type="button" className="btn btn-green" disabled={busy} onClick={save}>{busy ? 'Uploading…' : 'Use this photo'}</button></div>
    </div></div> : null}
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
  </span>)
}
async function post(url, body, type) {
  const r = await fetch(url, { method: 'POST', body, headers: { 'Content-Type': type }, credentials: 'same-origin' }), j = await r.json().catch(() => ({}))
  if (r.status === 401) { window.location.assign('/admin/login'); throw new Error('Sign in again.') }
  if (!r.ok) throw new Error(j.error || 'Upload failed.'); return j
}
const guess = (n) => ({ m4a: 'audio/mp4', mp3: 'audio/mpeg', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg' }[String(n).split('.').pop().toLowerCase()] || '')
const CSS = `.up-wrap{display:inline-grid;gap:6px;justify-items:start}.up-bar{width:220px;height:6px;border-radius:99px;background:rgba(242,239,233,.1);overflow:hidden}.up-bar i{display:block;height:100%;background:var(--green);transform-origin:left;transition:transform .3s}
.up-err{font-size:12.5px;color:#ff8a8a;max-width:420px}.up-ov{position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.7);display:grid;place-items:center;padding:16px}.up-dl{display:grid;gap:12px;justify-items:center;padding:20px;border-radius:22px;background:var(--raise);border:1px solid var(--line);max-width:96vw}
.up-dl>p{margin:0;font-size:13.5px;color:var(--dim);text-align:center;max-width:300px}.up-frame{position:relative;overflow:hidden;border-radius:18px;background:#000;touch-action:none;cursor:grab}.up-frame img{position:absolute;left:0;top:0;user-select:none;max-width:none}
.up-guide{position:absolute;inset:0;width:100%;height:100%;fill:none;stroke:rgba(143,227,106,.75);stroke-width:.8;stroke-dasharray:2 2;pointer-events:none}.up-z{display:flex;gap:10px;align-items:center;font-size:13px;color:var(--dim);width:300px}.up-z input{flex:1}.up-bt{display:flex;gap:10px}`
