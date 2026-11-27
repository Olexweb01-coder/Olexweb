'use client'
// Install 67: the big "what's new" announcement for people who had an account before this release. Everything that
// changed, grouped into 5. It shows once a day for 3 days on each device (counted from the first time it showed), unless
// they tick "Don't show this again". New accounts don't see it: the guided tour shows them everything instead.
// Remembered in the browser only (no database change).
import { useEffect, useMemo, useState } from 'react'
import { I } from './icons'

export const ANNOUNCE = { id: 'big-update-2026-11', newFrom: '2026-11-28T00:00:00+01:00', days: 3 }
const KEY = 'meet-announce-' + ANNOUNCE.id
const GROUPS = [
  { icon: 'star', bg: 'bg-y', t: 'Pro, your way', d: 'Pro for just one meeting, a free Pro meeting at your 3rd meeting and another at 10 badges, and a new Billing page with all your payments.' },
  { icon: 'user', bg: 'bg-b', t: 'You, in every call', d: 'Your profile photo shows on the join screen and in the call, and your mic starts off so you join calmly.' },
  { icon: 'out', bg: 'bg-g', t: 'Meet on your home screen', d: 'Install Olexweb Meet like an app with one tap, with easy steps for iPhone.' },
  { icon: 'trophy', bg: 'bg-v', t: 'New badges and the spotlight', d: 'Learner and critic, Super connector and Ambassador badges, a week in the spotlight, and 15% of your friends’ Pro payments for 6 months.' },
  { icon: 'spark', bg: 'bg-o', t: 'Smarter and safer', d: 'Quiet meetings end by themselves (with a warning first), a guided tour of the app, and you can delete your account any time.' },
]
function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {} } catch { return { off: true } } }
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch {} }
// should it show now? (checked in the browser after the home data arrives)
export function announceDue(since) {
  if (!since || new Date(since) >= new Date(ANNOUNCE.newFrom)) return false   // a new account: the tour instead
  const s = load(), now = Date.now(), today = new Date(now + 3600e3).toISOString().slice(0, 10)   // Lagos day
  if (s.off) return false
  if (s.first && now - s.first > ANNOUNCE.days * 864e5) return false
  return s.day !== today
}
export default function Announce({ onClose, onTour }) {
  const [never, setNever] = useState(false)
  const bits = useMemo(() => Array.from({ length: 30 }, (_, i) => ({ left: (i * 89) % 100, delay: (i % 10) * 0.3, dur: 2.8 + (i % 4) * 0.5, color: ['#8fe36a', '#e9c46a', '#f2efe9', '#c9f2a8'][i % 4] })), [])
  useEffect(() => { const s = load(); save({ ...s, first: s.first || Date.now(), day: new Date(Date.now() + 3600e3).toISOString().slice(0, 10) }) }, [])
  function close(tour) { if (never) save({ ...load(), off: true }); onClose(); if (tour) onTour() }
  return (<div className="cele on ann" role="dialog" aria-modal="true" aria-label="What’s new in Olexweb Meet">
    <div className="cele-card ann-card">
      <div className="conf" aria-hidden="true">{bits.map((b, i) => <i key={i} style={{ left: b.left + '%', background: b.color, animationDelay: b.delay + 's', animationDuration: b.dur + 's' }} />)}</div>
      <div className="rays" aria-hidden="true" />
      <span className="combo-tag"><I n="rocket" />Big update</span>
      <h2>Meet just got better</h2>
      <p>Here’s everything new, in one place.</p>
      <div className="ann-list">{GROUPS.map((g, i) => <div key={g.t} className="perk ann-item" style={{ animationDelay: 0.15 + i * 0.09 + 's' }}><span className={'ni ' + g.bg}><I n={g.icon} /></span><span><b>{g.t}</b><br /><small>{g.d}</small></span></div>)}</div>
      <div className="row"><button className="btn go" onClick={() => close(false)}>Let’s go</button><button className="btn w" onClick={() => close(true)}><I n="spark" />Take the tour</button></div>
      <label className="ann-never"><input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} /> Don’t show this again</label>
    </div></div>)
}
