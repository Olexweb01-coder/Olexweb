'use client'
// How the admin looks on this device: glass, clay or neumorphic. Saved in a cookie, so it's right from the first paint.
import { useEffect, useState } from 'react'
import { toast } from './ui'
const LOOKS = [['glass', 'Glass', 'Frosted, see-through panels over a soft glow. The default.'], ['clay', 'Clay', 'Soft, rounded and puffy, like moulded clay.'], ['neu', 'Neumorphic', 'Raised and pressed shapes made from light and shadow.']]
export default function Appearance() {
  const [look, setLook] = useState('glass')
  useEffect(() => { const el = document.querySelector('.olex'); if (el) setLook(el.dataset.style || 'glass') }, [])
  function pick(k) {
    document.cookie = `olex_style=${k}; path=/admin; max-age=31536000; samesite=strict${location.protocol === 'https:' ? '; secure' : ''}`
    const el = document.querySelector('.olex'); if (el) el.dataset.style = k
    setLook(k); toast((LOOKS.find((l) => l[0] === k) || [])[1] + ' look on.')
  }
  return (<section aria-labelledby="lookT">
    <h2 className="section-t" id="lookT" style={{ marginTop: 0 }}>Look</h2>
    <div className="looks" role="radiogroup" aria-label="Look">{LOOKS.map(([k, label, about]) => (
      <button key={k} type="button" role="radio" aria-checked={look === k} className={'look look-' + k} onClick={() => pick(k)}>
        <span className="look-sw" aria-hidden="true"><i /><i /></span><b>{label}</b><span>{about}</span>
      </button>))}</div>
    <p className="note">Saved on this device only, so your phone and laptop can look different.</p>
  </section>)
}
