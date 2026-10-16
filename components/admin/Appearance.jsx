'use client'
// How the admin looks on this device: glass, clay or neumorphic. Saved in a cookie, so it's right from the first paint.
import { useEffect, useState } from 'react'
import { toast } from './ui'
const LOOKS = [['glass', 'Glass', 'Frosted, see-through panels over a soft glow. The default.'], ['clay', 'Clay', 'Soft, rounded and puffy, like moulded clay.'], ['neu', 'Neumorphic', 'Raised and pressed shapes made from light and shadow.']]
const MODES = [['dark', 'Dark'], ['light', 'Light'], ['system', 'Match this device']]
const save = (k, v) => { document.cookie = `${k}=${v}; path=/admin; max-age=31536000; samesite=strict${location.protocol === 'https:' ? '; secure' : ''}` }
export default function Appearance() {
  const [look, setLook] = useState('glass'), [mode, setMode] = useState('dark')
  useEffect(() => { const el = document.querySelector('.olex'); if (el) { setLook(el.dataset.style || 'glass'); setMode(el.dataset.mode || 'dark') } }, [])
  function pickMode(k) {
    save('olex_mode', k); const el = document.querySelector('.olex'); if (el) el.dataset.mode = k
    setMode(k); window.dispatchEvent(new Event('olex-look'))
  }
  function pick(k) {
    save('olex_style', k)
    const el = document.querySelector('.olex'); if (el) el.dataset.style = k
    setLook(k); window.dispatchEvent(new Event('olex-look')); toast((LOOKS.find((l) => l[0] === k) || [])[1] + ' look on.')
  }
  return (<section aria-labelledby="lookT">
    <h2 className="section-t" id="lookT" style={{ marginTop: 0 }}>Look</h2>
    <div className="seg" role="radiogroup" aria-label="Light or dark" style={{ marginBottom: 14 }}>{MODES.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={mode === k} aria-pressed={mode === k} onClick={() => pickMode(k)}>{l}</button>)}</div>
    <div className="looks" role="radiogroup" aria-label="Look">{LOOKS.map(([k, label, about]) => (
      <button key={k} type="button" role="radio" aria-checked={look === k} className={'look look-' + k} onClick={() => pick(k)}>
        <span className="look-sw" aria-hidden="true"><i /><i /></span><b>{label}</b><span>{about}</span>
      </button>))}</div>
    <p className="note">Saved on this device only, so your phone and laptop can look different.</p>
  </section>)
}
