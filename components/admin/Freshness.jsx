'use client'
// Keeping the admin fresh without signing out. One controller for the whole admin (automatic refresh when you come back,
// pull to refresh on phones, the new-version notice), and Refresh buttons that ask it to refresh.
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'

const ICON = <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg>
const editorOpen = () => !!document.querySelector('.sheet')
const isPhone = () => window.matchMedia('(max-width: 820px)').matches

export function RefreshButton({ side = false }) {
  const [spin, setSpin] = useState(false)
  useEffect(() => { const f = (e) => setSpin(e.detail); window.addEventListener('olex-refreshing', f); return () => window.removeEventListener('olex-refreshing', f) }, [])
  const ask = () => window.dispatchEvent(new CustomEvent('olex-refresh'))
  return side
    ? <button type="button" className="nav-a fresh-side" onClick={ask}><span className={spin ? 'fresh-spin' : 'fresh-ic'}>{ICON}</span>Refresh</button>
    : <button type="button" className="fresh-btn" onClick={ask} aria-label="Refresh"><span className={spin ? 'fresh-spin' : 'fresh-ic'}>{ICON}</span></button>
}

export default function Freshness({ version }) {
  const router = useRouter(), [fresh, setFresh] = useState(false), [pull, setPull] = useState(0)
  const hiddenAt = useRef(0), busy = useRef(false)
  const checkVersion = useCallback(async () => {
    try { const r = await fetch('/admin/api/version', { cache: 'no-store', credentials: 'same-origin' }); if (!r.ok) return; const j = await r.json(); if (j.v && j.v !== version) setFresh(true) } catch {}
  }, [version])
  const refresh = useCallback((quiet) => {
    if (busy.current) return; busy.current = true
    window.dispatchEvent(new CustomEvent('olex-refreshing', { detail: true }))
    router.refresh(); checkVersion()                                            // fresh data; anything you're typing stays as it is
    setTimeout(() => { busy.current = false; window.dispatchEvent(new CustomEvent('olex-refreshing', { detail: false })); if (!quiet) toast('Up to date.') }, 700)
  }, [router, checkVersion])

  useEffect(() => {
    const asked = () => refresh(false)
    const vis = () => { if (document.visibilityState === 'hidden') hiddenAt.current = Date.now(); else if (hiddenAt.current && Date.now() - hiddenAt.current > 30_000) refresh(true) }
    const online = () => refresh(true)
    window.addEventListener('olex-refresh', asked); document.addEventListener('visibilitychange', vis); window.addEventListener('online', online)
    const timer = setInterval(checkVersion, 5 * 60_000); checkVersion()
    return () => { window.removeEventListener('olex-refresh', asked); document.removeEventListener('visibilitychange', vis); window.removeEventListener('online', online); clearInterval(timer) }
  }, [refresh, checkVersion])

  useEffect(() => {                                                              // pull down from the top to refresh (phones)
    let y0 = null, d = 0
    const start = (e) => { y0 = isPhone() && window.scrollY <= 0 && !editorOpen() && e.touches.length === 1 ? e.touches[0].clientY : null; d = 0 }
    const move = (e) => { if (y0 === null) return; d = e.touches[0].clientY - y0; setPull(d > 0 && window.scrollY <= 0 ? Math.min(d, 110) : 0) }
    const end = () => { if (y0 !== null && d > 80) refresh(false); y0 = null; d = 0; setPull(0) }
    window.addEventListener('touchstart', start, { passive: true }); window.addEventListener('touchmove', move, { passive: true }); window.addEventListener('touchend', end); window.addEventListener('touchcancel', end)
    return () => { window.removeEventListener('touchstart', start); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', end); window.removeEventListener('touchcancel', end) }
  }, [refresh])

  function update() {
    if (editorOpen() && !window.confirm('You have something open. Updating reloads the admin, so save your work first. Update now anyway?')) return
    window.location.reload()
  }
  return (<>
    {pull > 0 ? <div className="fresh-pull" style={{ height: pull * 0.6 }} aria-hidden="true"><span style={{ transform: `rotate(${pull * 3}deg)`, opacity: Math.min(1, pull / 80) }}>{ICON}</span></div> : null}
    {fresh ? <div className="fresh-new" role="status"><span className="fresh-long">A new version of the admin is ready.</span><span className="fresh-short">New version ready.</span><button type="button" className="btn btn-green" onClick={update}>Update now</button></div> : null}
  </>)
}
