'use client'
// Celebrations (Install 58): each achievement is celebrated once. Two or three at once is a Double or Triple win.
// The first visit after this release unlocks everything someone had already earned, in one welcome.
import { useMemo, useState } from 'react'
import { I } from './icons'
import { shareText, site } from './ui'

const COMBO = ['', '', 'Double win', 'Triple win']
export default function Celebrate({ c, me, onClose }) {
  const [msg, setMsg] = useState('')
  const bits = useMemo(() => Array.from({ length: 36 }, (_, i) => ({ left: (i * 97) % 100, delay: (i % 12) * 0.25, dur: 2.6 + (i % 5) * 0.5, color: ['#8fe36a', '#e9c46a', '#f2efe9', '#c9f2a8'][i % 4] })), [])
  const badges = c.badges || [], one = badges[0]
  const combo = c.kind === 'badges' && badges.length >= 2 ? (COMBO[badges.length] || `${badges.length} wins`) : ''
  const title = c.kind === 'welcome' ? 'Welcome to the new Meet' : c.kind === 'level' ? `Level ${c.level.level}: ${c.level.title}` : combo ? `${combo}!` : one ? one.name : 'Well done'
  const text = c.kind === 'welcome' ? (badges.length ? `You’ve already earned ${badges.length} achievement${badges.length === 1 ? '' : 's'}. They’re yours now, on your profile.` : 'Host meetings to earn achievements, levels and rewards. Every milestone is celebrated here.')
    : c.kind === 'level' ? `You reached level ${c.level.level}. ${c.level.toNext ? `${c.level.toNext.toLocaleString()} XP to the next one.` : 'The top level. Legendary.'}` : combo ? 'You unlocked these together.' : one ? one.desc + '.' : ''
  async function share() {
    const what = c.kind === 'level' ? `I reached level ${c.level.level} (${c.level.title}) on Olexweb Meet` : one ? `I earned “${one.name}” on Olexweb Meet` : 'I’m on the new Olexweb Meet'
    const url = me.handle && me.public && one && c.kind !== 'level' ? `${location.origin}/meet/h/${me.handle}/a/${one.id}` : site()
    const r = await shareText(what, url); if (r === 'copied') setMsg('Copied. Paste it anywhere.')
  }
  return (<div className="cele on" role="dialog" aria-modal="true" aria-label={title}>
    <div className="cele-card">
      <div className="conf" aria-hidden="true">{bits.map((b, i) => <i key={i} style={{ left: b.left + '%', background: b.color, animationDelay: b.delay + 's', animationDuration: b.dur + 's' }} />)}</div>
      <div className="rays" aria-hidden="true" />
      {combo ? <span className="combo-tag"><I n="star" />{combo}</span> : null}
      <div className="medal">{c.kind === 'level' ? c.level.level : c.kind === 'welcome' ? <I n="rocket" /> : <I n="trophy" />}</div>
      <h2>{title}</h2><p>{text}</p>
      {badges.slice(0, 6).map((b) => <div key={b.id} className="perk"><span className="ni bg-y"><I n="trophy" /></span><span><b>{b.name}</b><br /><small>{b.desc}</small></span><span className="xp">+100 XP</span></div>)}
      {badges.length > 6 ? <p className="dim">and {badges.length - 6} more on your profile</p> : null}
      {c.kind === 'welcome' && c.level ? <div className="perk"><span className="ni bg-g"><I n="star" /></span><span><b>Level {c.level.level}: {c.level.title}</b><br /><small>{c.level.xp.toLocaleString()} XP from everything you’ve hosted</small></span></div> : null}
      <div className="row"><button className="btn go" onClick={onClose}>{c.kind === 'welcome' ? 'Let’s go' : 'Keep going'}</button><button className="btn w" onClick={share}><I n="out" />Share</button>
        {one && c.kind === 'badges' && badges.length === 1 ? <a className="btn" href={`/api/meet/card?b=${one.id}`} download style={{ color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>Save card</a> : null}</div>
      {msg ? <p style={{ margin: '10px 0 0' }}>{msg}</p> : null}
    </div></div>)
}
