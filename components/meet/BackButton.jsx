'use client'
// "Back": to the page you came from on Olexweb Meet, or to Meet's home when you arrived from outside (Install 58d).
export default function BackButton({ home = '/meet', className = 'pb-back', label = 'Back' }) {
  function go(e) {
    e.preventDefault()
    let same = false; try { same = !!document.referrer && new URL(document.referrer).origin === location.origin } catch {}
    if (same && history.length > 1) history.back(); else location.assign(home)
  }
  return <a href={home} className={className} onClick={go} aria-label={label}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg><span>{label}</span></a>
}
