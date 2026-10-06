'use client'
import { useEffect, useState, useRef } from 'react'

// ---------- the notice that signs ("Published." draws the signature) ----------
export function toast(msg, signed = false) { window.dispatchEvent(new CustomEvent('olex-toast', { detail: { msg, signed } })) }
export function Toast() {
  const [t, setT] = useState(null), timer = useRef(0)
  useEffect(() => {
    const on = (e) => { setT(null); requestAnimationFrame(() => setT({ ...e.detail, k: Date.now() })); clearTimeout(timer.current); timer.current = setTimeout(() => setT(null), 2600) }
    window.addEventListener('olex-toast', on); return () => window.removeEventListener('olex-toast', on)
  }, [])
  return (<div className={'toast' + (t ? ' on' : '') + (t && t.signed ? ' signed' : '')} role="status" aria-live="polite">
    <b>{t ? t.msg : ''}</b>
    <svg viewBox="0 0 400 16" preserveAspectRatio="none" aria-hidden="true"><path d="M4 11 C 24 2, 44 2, 40 9 C 37 15, 20 15, 24 10 C 32 2, 80 7, 120 11 C 170 15, 240 5, 300 7 C 340 8, 370 6, 396 3" /></svg>
  </div>)
}

// ---------- talking to the server ----------
export async function act(payload) {
  try {
    const r = await fetch('/admin/api/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'same-origin' })
    const j = await r.json().catch(() => ({}))
    if (r.status === 401) { window.location.assign('/admin/login'); return { error: 'Sign in again.' } }
    return r.ok ? j : { error: j.error || 'Something went wrong. Try again.' }
  } catch { return { error: 'No connection. Your changes are still here; try again.' } }
}

// ---------- the editor sheet ----------
export function Sheet({ title, onClose, children, foot }) {
  useEffect(() => {
    document.body.classList.add('sheet-on')
    const esc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => { document.body.classList.remove('sheet-on'); window.removeEventListener('keydown', esc) }
  }, [onClose])
  return (<>
    <div className="sheet-bg" onClick={onClose} />
    <aside className="sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-head"><b>{title}</b><button className="btn btn-line" onClick={onClose}>Close</button></div>
      <div className="sheet-body">{children}</div>
      {foot ? <div className="sheet-foot">{foot}</div> : null}
    </aside>
  </>)
}

// ---------- images: shrunk on the phone, then re-encoded on the server ----------
async function shrink(file, kind) {
  const bmp = await createImageBitmap(file).catch(() => null)
  if (!bmp) return file                                       // the server will decide whether it is a usable image
  const maxW = kind === 'screenshot' ? 1600 : 2000, maxH = kind === 'screenshot' ? 10000 : 2000
  const scale = Math.min(1, maxW / bmp.width, maxH / bmp.height, Math.sqrt(16_000_000 / (bmp.width * bmp.height)))
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  for (const quality of [0.86, 0.74, 0.6]) {
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', quality))
    if (blob && blob.size < 3.8 * 1024 * 1024) return blob
  }
  throw new Error('too large')
}
export function ImagePicker({ value, onChange, kind = 'screenshot', label = 'Image' }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), input = useRef(null)
  async function pick(e) {
    const f = e.target.files && e.target.files[0]; e.target.value = ''
    if (!f) return
    setErr(''); setBusy(true)
    try {
      const small = await shrink(f, kind)
      const fd = new FormData(); fd.append('file', small, 'upload.jpg'); fd.append('kind', kind)
      const r = await fetch('/admin/api/upload', { method: 'POST', body: fd, credentials: 'same-origin' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Upload failed. Try again.')
      onChange(j.url)
    } catch (x) { setErr(x.message === 'too large' ? 'That image is too large. Try a smaller one.' : x.message) } finally { setBusy(false) }
  }
  const preview = value ? value.replace(/-full\.webp$/, '.webp') : ''
  return (<div className="field"><label>{label}</label>
    <div className="drop">
      {preview ? <img src={preview} alt="" /> : <div style={{ width: 120, height: 84, borderRadius: 8, background: 'var(--raise2)' }} />}
      <div>
        <button type="button" className="btn btn-line" onClick={() => input.current && input.current.click()} disabled={busy}>{busy ? 'Uploading\u2026' : value ? 'Replace image' : 'Add image'}</button>
        <p style={{ color: 'var(--dim)', fontSize: 13.5, margin: '8px 0 0' }}>{kind === 'screenshot' ? 'A full-page screenshot works best.' : 'A clear photo works best.'} It’s resized on your phone, then cleaned and converted for the web.</p>
        {err ? <p className="err" role="alert" style={{ margin: '8px 0 0' }}>{err}</p> : null}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={pick} />
    </div></div>)
}

export function Notice() {
  return <p className="read-only">Changes are saved here straight away. The public website starts showing them after the next update (Phase 4).</p>
}
