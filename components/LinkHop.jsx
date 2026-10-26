'use client'
// A short link: count the tap, then open the destination (WhatsApp or any website). Works without JavaScript too.
import { useEffect } from 'react'
export default function LinkHop({ slug, target }) {
  useEffect(() => {
    try { fetch('/api/p', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'tap', slug }), keepalive: true }).catch(() => {}) } catch {}
    const t = setTimeout(() => window.location.replace(target), 120); return () => clearTimeout(t)
  }, [slug, target])
  return (<main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f2efe9', color: '#0a0b0a', fontFamily: 'var(--font-mona),system-ui', padding: 24, textAlign: 'center' }}>
    <noscript><meta httpEquiv="refresh" content={'0;url=' + target} /></noscript>
    <p style={{ fontSize: 16 }}>Opening… <a href={target} style={{ color: '#0e1a0b', fontWeight: 700 }}>Tap here if nothing happens</a></p>
  </main>)
}
