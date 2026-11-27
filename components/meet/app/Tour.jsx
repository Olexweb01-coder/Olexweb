'use client'
// Install 65: the guided "how to use" tour. One section at a time is lit up with a short note, Next / Back / Skip, until it
// finishes. It shows once on each device after the welcome and What's new (remembered in the browser, so no database
// change), and Help has "Take the tour" to see it again. On phones the menu slides open for the menu steps.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const KEY = 'meet-tour-v1'
const ALL = [
  { at: '.sb .newbtn', menu: true, t: 'Start or schedule a meeting', d: 'Start a video meeting or an audio call right now, open your own room, or schedule one for later and share the invite.' },
  { at: '.sb a[href="#home"]', menu: true, t: 'Home', d: 'Your meetings coming up, your progress and quick things to do next.' },
  { at: '.sb a[href="#meetings"]', menu: true, t: 'Meetings', d: 'Every meeting you made: copy the link, edit it, see who signed up and who came.' },
  { at: '.sb a[href="#room"]', menu: true, t: 'My room', d: 'Your own meeting link that never changes. Tap it to go in, and the link is copied for you.' },
  { at: '.sb a[href="#notes"]', menu: true, t: 'Recordings and notes', d: 'Recordings, transcripts and AI notes from your meetings.' },
  { at: '.sb a[href="#profile"]', menu: true, t: 'My profile', d: 'Your photo, your badges and your public page that people can follow.' },
  { at: '.sb a[href="#leaders"]', menu: true, t: 'Leaderboard', d: 'The top hosts this month. Winners get Pro days and the spotlight.' },
  { at: '.sb a[href="#earn"]', menu: true, t: 'Earn', d: 'Sell tickets, course bundles, one-on-one sessions and memberships, and earn from people you invite.' },
  { at: '.sb a[href="#billing"]', menu: true, t: 'Billing', d: 'Your plan, buying Pro, your free Pro meetings and your payments.' },
  { at: '.sb a[href="#help"]', menu: true, t: 'Help', d: 'Ask Olex AI anything about Meet, or send a question to the Olexweb team.' },
  { at: '.sb a[href="#settings"]', menu: true, t: 'Settings', d: 'Light or dark look, installing the app, signing out and your account.' },
  { at: '.top .search', t: 'Join with a code', d: 'Got a meeting code or link from someone? Type it here to join.' },
  { at: '.top button[aria-label*="otification"]', t: 'Notifications', d: 'New badges, rewards, payments and meetings starting soon show up here.' },
]
// the steps for this screen: the menu ones always (on phones the menu opens), the others only if they're showing
const forScreen = () => ALL.filter((s) => { if (s.menu) return true; const el = document.querySelector(s.at); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
let openNow = null                                         // Help's "Take the tour" button calls this
export function startTour() { if (openNow) openNow() }

export default function Tour({ ready, setDrawer }) {
  const [i, setI] = useState(-1), [box, setBox] = useState(null), dir = useRef(1), [STEPS, setSteps] = useState(ALL)
  const begin = () => { dir.current = 1; setSteps(forScreen()); setI(0) }
  useEffect(() => {
    openNow = () => { setDrawer(false); begin() }
    return () => { openNow = null }
  }, [setDrawer])
  useEffect(() => {                                        // first time on this device: start once everything else is closed
    if (!ready || i >= 0) return
    let seen = '1'; try { seen = localStorage.getItem(KEY) || '' } catch {}
    if (!seen) { const t = setTimeout(begin, 700); return () => clearTimeout(t) }
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps
  const phone = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches
  const shown = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' }
  useLayoutEffect(() => {
    if (i < 0) return
    const s = STEPS[i]
    if (phone()) setDrawer(!!s.menu)
    let alive = true
    const place = () => {
      if (!alive) return
      const el = document.querySelector(s.at)
      if (!shown(el) && !(s.menu && phone())) { setBox(null); return }
      if (!el) { setBox(null); return }
      const r = el.getBoundingClientRect()
      setBox({ x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 })
    }
    const go = setTimeout(() => {                          // the menu slides in on phones first
      const el = document.querySelector(s.at)
      if (!shown(el)) { next(dir.current); return }                   // not on this screen size: skip it
      el.scrollIntoView({ block: 'nearest' }); place()
    }, phone() && s.menu ? 420 : 60)
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true)
    return () => { alive = false; clearTimeout(go); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (i < 0) return
    const k = (e) => { if (e.key === 'Escape') end(); if (e.key === 'ArrowRight') next(1); if (e.key === 'ArrowLeft' && i > 0) next(-1) }
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k)
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps
  function end() { try { localStorage.setItem(KEY, 'done') } catch {} setI(-1); setBox(null); setDrawer(false) }
  function next(d) { dir.current = d; setI((n) => { const m = n + d; if (m >= STEPS.length) { setTimeout(end, 0); return n } return Math.max(0, m) }) }
  if (i < 0) return null
  const s = STEPS[i], last = i === STEPS.length - 1
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1000, vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const W = Math.min(340, vw - 32)
  let card = { left: 16, bottom: 16 }
  if (box) {
    const right = box.x + box.w + 14, below = box.y + box.h + 12
    if (vw > 700 && right + W < vw - 8) card = { left: right, top: Math.max(12, Math.min(box.y, vh - 240)) }
    else if (below + 200 < vh) card = { left: Math.max(16, Math.min(box.x, vw - W - 16)), top: below }
    else card = { left: Math.max(16, Math.min(box.x, vw - W - 16)), bottom: Math.max(12, vh - box.y + 12) }
  }
  return (<div className="tour" role="dialog" aria-modal="true" aria-label="How to use Olexweb Meet">
    <div className="tour-block" onClick={(e) => e.stopPropagation()} />
    {box ? <div className="tour-hole" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} /> : <div className="tour-dim" />}
    <div className="tour-card" style={{ ...card, width: W }}>
      <small className="dim">{i + 1} of {STEPS.length}</small>
      <h3>{s.t}</h3><p>{s.d}</p>
      <div className="tour-btns"><button className="btn sm quiet" onClick={end}>Skip</button><span style={{ flex: 1 }} />
        {i > 0 ? <button className="btn sm" onClick={() => next(-1)}>Back</button> : null}
        <button className="btn sm go" onClick={() => (last ? end() : next(1))} autoFocus>{last ? 'Finish' : 'Next'}</button></div>
    </div>
  </div>)
}
