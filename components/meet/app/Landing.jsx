'use client'
// The Meet home for visitors (Install 58g: the new website). Short on purpose: what Meet is, join with a code (never
// needs an account), the main features, who it is for, earning, and sign in. Each topic has its own page for more.
import { useEffect, useMemo, useState } from 'react'
import { I } from './icons'
import EmailSignIn from '../EmailSignIn'
import { pathFor, Sheet, homePath } from './ui'
import Site, { Section, Head, Final, at, startHref } from '../site/Site'
import { Stage, Calc, Notes, Poll, Signal, Rooms, Lock } from '../site/Bits'

const PROVIDER_ICON = {
  google: <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" /><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" /><path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z" /><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5L6.4 10C7.2 7.7 9.4 5.9 12 5.9z" /></svg>,
  microsoft: <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path fill="#F25022" d="M3 3h8.5v8.5H3z" /><path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5z" /><path fill="#00A4EF" d="M3 12.5h8.5V21H3z" /><path fill="#FFB900" d="M12.5 12.5H21V21h-8.5z" /></svg>,
  linkedin: <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><rect x="2" y="2" width="20" height="20" rx="4" fill="#0A66C2" /><path fill="#fff" d="M7.4 10H5v7.6h2.4V10zM6.2 6.4a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zM18.9 13.3c0-2.3-1.2-3.5-3-3.5-1.2 0-2 .6-2.4 1.2V10h-2.3v7.6h2.4v-4.2c0-1.1.5-1.8 1.4-1.8s1.2.7 1.2 1.7v4.3h2.7v-4.3z" /></svg>,
  github: <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path fill="currentColor" d="M12 2.5a9.5 9.5 0 0 0-3 18.5c.5.1.7-.2.7-.5v-1.8c-2.6.6-3.2-1.2-3.2-1.2-.4-1.1-1-1.4-1-1.4-.9-.6 0-.6 0-.6 1 .1 1.5 1 1.5 1 .8 1.5 2.3 1 2.8.8.1-.6.3-1 .6-1.3-2.1-.2-4.3-1-4.3-4.7 0-1 .4-1.9 1-2.6-.1-.2-.4-1.2.1-2.5 0 0 .8-.3 2.6 1a9 9 0 0 1 4.8 0c1.8-1.3 2.6-1 2.6-1 .5 1.3.2 2.3.1 2.5.6.7 1 1.6 1 2.6 0 3.7-2.3 4.5-4.4 4.7.4.3.7.9.7 1.8v2.7c0 .3.2.6.7.5A9.5 9.5 0 0 0 12 2.5z" /></svg>,
  facebook: <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><circle cx="12" cy="12" r="10" fill="#1877F2" /><path fill="#fff" d="M13.4 21.9v-7h2.3l.4-2.7h-2.7v-1.7c0-.8.2-1.3 1.3-1.3h1.4V6.8a19 19 0 0 0-2.1-.1c-2.1 0-3.5 1.3-3.5 3.6v2h-2.3v2.7h2.3v7a10 10 0 0 0 2.9 0z" /></svg>,
}
const safeNext = (n) => (typeof n === 'string' && /^\/(?!\/)[^\s]{0,300}$/.test(n) ? n : '/')
const PANELS = [
  ['school', 'Schools and teachers', 'cert', 'Classes that feel like a classroom', 'Teach live, take attendance automatically and hand out certificates.', ['Attendance and sign-up details, collected for you', 'Polls, quizzes and Q&A', 'Breakout rooms for group work', 'Certificates with a code anyone can check']],
  ['church', 'Churches', 'users', 'Fellowship from anywhere', 'Bible study, prayer meetings and services that work on any phone.', ['Audio meetings that are light on data', 'Only the people you allow can speak', 'Free MP3 recordings to share after', 'Members-only meetings for your community']],
  ['coach', 'Coaches and mentors', 'star', 'Coaching that pays', 'Book one-on-one sessions, sell course bundles and grow a paying community.', ['Your own booking page with your hours', 'Course bundles with early-bird prices', 'Monthly memberships', 'Get found in Find a mentor']],
  ['team', 'Teams', 'rocket', 'Teams that move faster', 'Stand-ups, reviews and interviews without the friction.', ['Your own room link that never changes', 'AI notes with decisions and next steps', 'Screen sharing and encryption', 'No time limit, ever']],
]
const WHO = ['Classes', 'Bible study', 'Coaching', 'Team stand-ups', 'Webinars', 'Mentorship', 'Communities', 'Interviews']

export default function Landing({ providers, emailOn, spotlight = null, notice = '', base = '/meet' }) {
  const [sheet, setSheet] = useState(null), [code, setCode] = useState(''), [toast, setToast] = useState(notice || '')
  const found = useMemo(() => (code.match(/[a-hj-km-np-z]{3}-[a-hj-km-np-z]{4}-[a-hj-km-np-z]{3}/) || [])[0] || null, [code])
  useEffect(() => {
    const r = new URLSearchParams(location.search).get('ref'); if (r && /^[a-z0-9]{4,12}$/.test(r)) document.cookie = `meet_ref=${r}; Max-Age=${30 * 86400}; Path=/; SameSite=Lax; Secure`
    if (location.hash === '#signin') setSheet({ next: safeNext(new URLSearchParams(location.search).get('next')) })   // "Sign in" links from other pages
    if (notice) history.replaceState(null, '', homePath())
    // the Sign in and Start free links on this page open the sign-in box here, without reloading
    const onClick = (e) => { const a = e.target.closest && e.target.closest('a[href*="#signin"]'); if (!a) return
      let u; try { u = new URL(a.href) } catch { return }
      if (u.origin !== location.origin || u.pathname !== location.pathname) return
      e.preventDefault(); setSheet({ next: safeNext(u.searchParams.get('next')) }) }
    document.addEventListener('click', onClick); return () => document.removeEventListener('click', onClick)
  }, [notice])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 6000); return () => clearTimeout(t) }, [toast])
  const winners = spotlight ? Object.values(spotlight.winners || {}).slice(0, 3) : []
  const join = (e) => { e.preventDefault(); if (found) location.assign(pathFor(found)); else setToast('That isn’t a meeting code. It looks like abc-defg-hij.') }
  return (<Site base={base} active="/">
    <header className="hero"><div className="glow" style={{ width: 520, height: 520, background: '#2f7d3a', right: -140, top: -120 }} /><div className="glow" style={{ width: 380, height: 380, background: '#8fe36a', left: -180, top: 320, opacity: 0.16 }} />
      <div className="wrap hgrid">
        <div>
          <span className="pill"><i />Free · no time limit · built for mobile data</span>
          <h1>{['Meet,', 'teach', 'and'].map((w, i) => <span key={w}><span className="w1" style={{ animationDelay: `${0.05 + i * 0.1}s` }}>{w}</span> </span>)}<span className="w1 grad" style={{ animationDelay: '.38s' }}>grow.</span></h1>
          <p className="lede">Audio and video meetings for classes, churches, coaches and teams. Guests join with one tap, no app and no account. Free recordings, AI notes, and ways to get paid for what you teach.</p>
          <div className="cta"><a className="btn go" href={startHref(base)}>Start a free meeting<I n="arrow" className="ico" /></a>
            <form className="join" onSubmit={join}><I n="link" className="ico" /><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Have a code? Join here" aria-label="Meeting code or link" autoComplete="off" spellCheck="false" /><button className="btn" style={{ minHeight: 38, padding: '6px 14px' }}>Join</button></form></div>
          <div className="trust"><span><I n="check" className="ico" />No account to join</span><span><I n="check" className="ico" />Encrypted</span><span><I n="check" className="ico" />Up to 100 people free</span></div>
        </div>
        <Stage />
      </div></header>
    <div className="mq" aria-hidden="true"><div>{[...WHO, ...WHO].map((w, i) => <span key={i}>{w}</span>)}</div></div>

    <Section><div className="facts">
      <div className="fact rv"><span className="num" data-count="100">100</span><span>people in a free meeting</span></div>
      <div className="fact rv d1"><span className="num">No limit</span><span>on how long you meet</span></div>
      <div className="fact rv d2"><span className="num">1 tap</span><span>for guests: no app, no account</span></div>
      <div className="fact rv d3"><span className="num">Weekly</span><span>payouts to your bank when you sell</span></div>
    </div></Section>

    <Section tight>
      <Head eyebrow="Features" title="Everything a real meeting needs. Nothing it doesn’t." text="Built for phones and everyday networks, so it keeps going when the signal doesn’t." />
      <div className="bento">
        <div className="bx s4 rv"><div><h3>AI notes, written for you</h3><p>Olex AI turns your meeting into a summary, decisions and next steps, and can email them to everyone who came.</p></div><Notes /></div>
        <div className="bx s2 lime rv d1"><div><h3>Data saver</h3><p>Hear everyone and see shared screens without the cost of cameras. Voice always comes first.</p></div><Signal /></div>
        <div className="bx s2 rv"><div><h3>Polls and Q&amp;A</h3><p>Ask the room. See answers live.</p></div><Poll /></div>
        <div className="bx s2 rv d1"><div><h3>Breakout rooms</h3><p>Split into groups, bring everyone back with one tap.</p></div><Rooms /></div>
        <div className="bx s2 gold rv d2"><div><h3>End-to-end encrypted</h3><p>Turn it on and only the people in the meeting can see and hear it.</p></div><Lock /></div>
      </div>
      <div className="cta rv" style={{ justifyContent: 'center' }}><a className="btn" href={at(base, '/features')}>See every feature<I n="arrow" className="ico" /></a></div>
    </Section>

    <Section alt>
      <Head eyebrow="Made for you" title="Whoever you gather, Meet fits." />
      <div className="rv"><div className="tabs" data-tabs role="tablist" aria-label="Who it is for">{PANELS.map(([k, label], i) => <button key={k} type="button" role="tab" data-tab={k} className={i ? '' : 'on'} aria-selected={i === 0}>{label}</button>)}</div>
        {PANELS.map(([k, , icon, title, text, list], i) => <div key={k} className="panel" data-panel={k} role="tabpanel" hidden={i > 0}><div><h3>{title}</h3><p style={{ color: 'var(--dim)', fontSize: 17, margin: '10px 0 0' }}>{text}</p>
          <ul>{list.map((x) => <li key={x}>{x}</li>)}</ul><div className="cta"><a className="btn go" href={startHref(base)}>Start free</a><a className="btn" href={at(base, '/for') + '#' + k}>Learn more</a></div></div>
          <div className="art"><I n={icon} className="ico" /></div></div>)}</div>
    </Section>

    <Section>
      <div className="earnband rv"><div><span className="eyebrow" style={{ color: 'var(--gold)' }}>Earn</span><h2 style={{ fontSize: 'clamp(32px,4.4vw,54px)', margin: '12px 0 14px' }}>Get paid for what you know</h2>
        <p style={{ color: 'var(--dim)', fontSize: 18, margin: 0 }}>Sell tickets, course bundles, memberships, one-on-one sessions and certificates. Every fee is shown before you sell, and money goes to your bank every week.</p>
        <div className="cta"><a className="btn go" href={at(base, '/earn')}>See how earning works</a></div></div>
        <Calc /></div>
    </Section>

    {winners.length ? <Section tight><Head eyebrow="Spotlight" title="Hosts of the month" />
      <div className="ways">{winners.map((w, i) => <a key={w.label} className={'way rv' + (i ? ' d' + i : '')} href={'/meet/h/' + w.handle}><span className="ni bg-y"><I n="trophy" className="ico" /></span><h3>{w.name}</h3><p>{w.label}</p></a>)}</div></Section> : null}

    <Final base={base} second={<a className="btn" href={at(base, '/mentors')}>Find a mentor</a>} />
    <div style={{ height: 60 }} />

    {sheet ? <div className="ma" data-theme="dark" style={{ display: 'contents' }}><Sheet title="Sign in to Olexweb Meet" onClose={() => setSheet(null)}>
      <p className="dim" style={{ margin: 0 }}>New here? The same buttons create your free account. You need one to host; people joining your meetings never do.</p>
      {providers.length ? <div className="providers">{providers.map((p) => <a key={p.id} className="opt" href={`/api/meet/auth/${p.id}?next=${encodeURIComponent(sheet.next || '/')}`}>{PROVIDER_ICON[p.id]}<span>Continue with {p.name}</span></a>)}</div>
        : !emailOn ? <p className="dim">Sign-in isn’t available yet. Check back soon.</p> : null}
      {emailOn ? <>{providers.length ? <p className="es-or"><span>or with email</span></p> : null}<EmailSignIn next={sheet.next || '/'} /></> : null}
      <p className="dim sm">By continuing you agree to Olexweb’s <a href="https://olexweb.com/terms">terms</a> and <a href="https://olexweb.com/privacy">privacy policy</a>.</p>
    </Sheet></div> : null}
    {toast ? <div className="ma" data-theme="dark" style={{ display: 'contents' }}><p className="toast" role="status">{toast}</p></div> : null}
  </Site>)
}
