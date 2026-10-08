'use client'
// "Start my project": a choice between WhatsApp (the same pre-written message) and the short form.
// Only buttons that say "Start my project" open it; every other WhatsApp link opens WhatsApp directly.
// Without JavaScript, the button simply opens WhatsApp as before.
import { useEffect, useRef, useState } from 'react'

export default function StartChoice() {
  const [open, setOpen] = useState(null), panel = useRef(null), back = useRef(null)
  useEffect(() => {
    if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/start')) return
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = e.target.closest && e.target.closest('a[href*="wa.me/2347011726321"]')
      if (!a || a.hasAttribute('data-choice') || (a.textContent || '').replace(/\s+/g, ' ').trim() !== 'Start my project') return
      e.preventDefault(); e.stopPropagation(); back.current = a
      setOpen({ wa: a.href, from: location.pathname.slice(0, 120) })
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'
    const first = panel.current && panel.current.querySelector('a, button'); if (first) first.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close() }
      if (e.key === 'Tab' && panel.current) {                               // keep the keyboard inside the panel
        const f = [...panel.current.querySelectorAll('a, button')]; if (!f.length) return
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus() }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey) }
  }, [open])
  function close() { setOpen(null); const b = back.current; if (b && b.focus) setTimeout(() => b.focus(), 0) }
  if (!open) return null
  return (<div className="sc-wrap" onClick={(e) => { if (e.target === e.currentTarget) close() }}>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div className="sc" role="dialog" aria-modal="true" aria-labelledby="scT" ref={panel}>
      <button type="button" className="sc-x" aria-label="Close" onClick={close}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
      <h2 id="scT">How would you like to start?</h2>
      <p className="sc-sub">Both reach Olaitan directly. You’ll get a reply within a day.</p>
      <a className="sc-opt sc-wa" data-choice="" href={open.wa} onClick={() => setTimeout(close, 300)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" /></svg>
        <span><b>Message on WhatsApp</b><small>Chat now. Your first message is already written.</small></span></a>
      <a className="sc-opt sc-form" href={'/start?from=' + encodeURIComponent(open.from)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 4h8M6 4h12a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM8 10h8M8 14h8M8 18h5" /></svg>
        <span><b>Fill a short form</b><small>Share your project details. It takes about two minutes.</small></span></a>
    </div>
  </div>)
}
const CSS = `
.sc-wrap{position:fixed;inset:0;z-index:2147483000;background:rgba(5,6,5,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;animation:scFade .2s ease-out}
.sc{position:relative;width:100%;max-width:520px;box-sizing:border-box;background:#111311;color:var(--paper,#f2efe9);border:1px solid rgba(242,239,233,.12);border-bottom:0;border-radius:26px 26px 0 0;padding:26px 20px calc(22px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:12px;animation:scUp .28s cubic-bezier(.2,.8,.2,1)}
.sc h2{margin:0 44px 0 0;font-family:var(--display);font-weight:800;font-stretch:90%;font-size:26px;line-height:1.1}
.sc-sub{margin:0 0 4px;color:var(--paper-dim,rgba(242,239,233,.66));font-size:15px;line-height:1.5}
.sc-x{position:absolute;top:16px;right:16px;width:40px;height:40px;border-radius:50%;border:1px solid rgba(242,239,233,.16);background:transparent;color:inherit;display:grid;place-items:center;cursor:pointer}
.sc-opt{display:flex;align-items:center;gap:14px;padding:16px;border-radius:18px;text-decoration:none;color:inherit;border:1px solid rgba(242,239,233,.14);background:rgba(242,239,233,.03);transition:border-color .2s,background .2s}
.sc-opt svg{width:26px;height:26px;flex:none}
.sc-opt span{display:flex;flex-direction:column;gap:3px}.sc-opt b{font-size:16.5px}.sc-opt small{font-size:13.5px;color:var(--paper-dim,rgba(242,239,233,.66));line-height:1.4}
.sc-wa{background:var(--green,#8fe36a);border-color:var(--green,#8fe36a);color:#0b0c0b}.sc-wa small{color:rgba(11,12,11,.72)}
.sc-opt:hover{border-color:var(--green,#8fe36a)}.sc-form:hover{background:rgba(143,227,106,.06)}
.sc-opt:focus-visible,.sc-x:focus-visible{outline:2px solid var(--green,#8fe36a);outline-offset:3px}
@media (min-width:700px){.sc-wrap{align-items:center}.sc{border-radius:26px;border-bottom:1px solid rgba(242,239,233,.12);padding:30px 26px 26px}}
@keyframes scUp{from{transform:translateY(24px);opacity:.4}to{transform:none;opacity:1}}@keyframes scFade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.sc,.sc-wrap{animation:none}}
`
