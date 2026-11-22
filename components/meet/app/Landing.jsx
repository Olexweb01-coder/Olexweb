'use client'
// The Meet home for visitors (Install 58): what Meet is, join with a code (never needs an account), sign in to host.
// Words animate in; sections fade in as you scroll (both off for people who prefer less motion).
import { useEffect, useMemo, useState } from 'react'
import { I } from './icons'
import EmailSignIn from '../EmailSignIn'
import { MeetPricing } from '../MeetDash'
import { pathFor, Sheet, homePath } from './ui'

const PROVIDER_ICON = {
  google: <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" /><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" /><path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z" /><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5L6.4 10C7.2 7.7 9.4 5.9 12 5.9z" /></svg>,
  microsoft: <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path fill="#F25022" d="M3 3h8.5v8.5H3z" /><path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5z" /><path fill="#00A4EF" d="M3 12.5h8.5V21H3z" /><path fill="#FFB900" d="M12.5 12.5H21V21h-8.5z" /></svg>,
  github: <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path fill="currentColor" d="M12 2.5a9.5 9.5 0 0 0-3 18.5c.5.1.7-.2.7-.5v-1.8c-2.6.6-3.2-1.2-3.2-1.2-.4-1.1-1-1.4-1-1.4-.9-.6 0-.6 0-.6 1 .1 1.5 1 1.5 1 .8 1.5 2.3 1 2.8.8.1-.6.3-1 .6-1.3-2.1-.2-4.3-1-4.3-4.7 0-1 .4-1.9 1-2.6-.1-.2-.4-1.2.1-2.5 0 0 .8-.3 2.6 1a9 9 0 0 1 4.8 0c1.8-1.3 2.6-1 2.6-1 .5 1.3.2 2.3.1 2.5.6.7 1 1.6 1 2.6 0 3.7-2.3 4.5-4.4 4.7.4.3.7.9.7 1.8v2.7c0 .3.2.6.7.5A9.5 9.5 0 0 0 12 2.5z" /></svg>,
  facebook: <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><circle cx="12" cy="12" r="10" fill="#1877F2" /><path fill="#fff" d="M13.4 21.9v-7h2.3l.4-2.7h-2.7v-1.7c0-.8.2-1.3 1.3-1.3h1.4V6.8a19 19 0 0 0-2.1-.1c-2.1 0-3.5 1.3-3.5 3.6v2h-2.3v2.7h2.3v7a10 10 0 0 0 2.9 0z" /></svg>,
}
const safeNext = (n) => (typeof n === 'string' && /^\/(?!\/)[^\s]{0,300}$/.test(n) ? n : '/')
export default function Landing({ providers, emailOn, pricing, faq = [], spotlight = null, notice = '' }) {
  const [theme, setTheme] = useState('dark'), [sheet, setSheet] = useState(null), [code, setCode] = useState(''), [toast, setToast] = useState(notice || '')
  const found = useMemo(() => (code.match(/[a-hj-km-np-z]{3}-[a-hj-km-np-z]{4}-[a-hj-km-np-z]{3}/) || [])[0] || null, [code])
  useEffect(() => {
    try { const t = localStorage.getItem('meet-theme'); if (t === 'light' || t === 'dark') setTheme(t) } catch {}
    const r = new URLSearchParams(location.search).get('ref'); if (r && /^[a-z0-9]{4,12}$/.test(r)) document.cookie = `meet_ref=${r}; Max-Age=${30 * 86400}; Path=/; SameSite=Lax; Secure`
    if (location.hash === '#signin') setSheet({ next: safeNext(new URLSearchParams(location.search).get('next')) })   // "Sign in" links from other Meet pages
    if (notice) history.replaceState(null, '', homePath())
    const els = document.querySelectorAll('.ma .rv')
    if (!('IntersectionObserver' in window)) { els.forEach((x) => x.classList.add('in')); return }
    const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target) } }), { threshold: 0.12 })
    els.forEach((x) => io.observe(x)); return () => io.disconnect()
  }, [notice])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 6000); return () => clearTimeout(t) }, [toast])
  const signIn = (next = '/') => setSheet({ next })
  const words = ['Meet,', 'learn,', 'grow']
  return (<div className="ma ld" data-theme={theme}>
    <div className="mesh" aria-hidden="true" />
    <div className="blob" aria-hidden="true" style={{ width: 460, height: 460, background: '#2f7d3a', right: -120, top: -60 }} /><div className="blob" aria-hidden="true" style={{ width: 320, height: 320, background: '#8fe36a', left: -160, top: 260, opacity: 0.18, animationDelay: '-5s' }} />
    <nav className="ld-nav"><a className="brand" href={homePath()}><img src="/meet/logo-96.png" alt="" /><span>Olexweb <b>Meet</b></span></a>
      <div className="links"><a href="#features">Features</a><a href="#earn">Earn</a><a href="/meet/mentors">Find a mentor</a>{pricing && pricing.on ? <a href="#pricing">Pricing</a> : null}</div>
      <div className="right"><button className="ib" aria-label={theme === 'dark' ? 'Switch to light' : 'Switch to dark'} onClick={() => { const t = theme === 'dark' ? 'light' : 'dark'; setTheme(t); try { localStorage.setItem('meet-theme', t) } catch {} }}><I n="sun" /></button>
        <button className="btn sm signin" style={{ borderColor: 'transparent' }} onClick={() => signIn('/')}>Sign in</button><button className="btn go sm" onClick={() => signIn('/?then=start')}>Start free</button></div></nav>
    <header className="hero">
      <div><span className="pill"><i />Free · no time limit · no account to join</span>
        <h1>{words.map((w, i) => <span key={w}><span className="w" style={{ animationDelay: `${0.05 + i * 0.1}s` }}>{w}</span> </span>)}<span className="w grad" style={{ animationDelay: '.35s' }}>together.</span></h1>
        <p>Audio and video meetings for classes, churches, teams and friends. Built for mobile data. Free MP3 recordings and AI notes, and ways to earn from what you teach.</p>
        <form className="joinbox" onSubmit={(e) => { e.preventDefault(); if (found) location.assign(pathFor(found)); else setToast('That isn’t a meeting code. It looks like abc-defg-hij.') }}>
          <button type="button" className="btn go" onClick={() => signIn('/?then=start')}><I n="video" />New meeting</button>
          <div className="f"><I n="door" /><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code or link" aria-label="Meeting code or link" autoComplete="off" spellCheck="false" /><button className="btn sm" disabled={!found}>Join</button></div></form>
        <p className="dim sm" style={{ marginTop: 12 }}>Hosting needs a free account. Joining never does.</p></div>
      <div className="stage" aria-hidden="true"><div className="g"><div className="tl big talk" style={{ background: 'linear-gradient(135deg,#1d4426,#0b140d)' }}><div className="av" style={{ width: 90, height: 90, fontSize: 34, background: '#8fe36a' }}>A</div><small>Ada · host</small></div>
        <div className="tl" style={{ background: '#151815' }}><div className="av" style={{ background: '#e9c46a' }}>T</div><small>Tobi</small></div><div className="tl" style={{ background: '#151815' }}><div className="av" style={{ background: '#c9f2a8' }}>K</div><small>Kemi</small></div></div>
        <div className="chip" style={{ left: -30, top: 40 }}><span className="ni bg-v"><I n="spark" /></span><span><b>AI notes ready</b>4 next steps</span></div>
        <div className="chip" style={{ right: -24, bottom: 30, animationDelay: '-2s' }}><span className="ni bg-y"><I n="trophy" /></span><span><b>Level up! Level 5</b>Host</span></div></div>
    </header>
    <section className="sec rv" id="features"><h2>Built for real life. Made to feel good.</h2><p className="sub">From a Wednesday Bible study to a 300-person class: it works on phones, on data, with people who just want the link to work.</p>
      <div className="bento"><div className="tile t1 w2"><span className="ti"><I n="mic" /></span><div><b>Audio or video, your choice</b><small>Audio calls stay light on data. Switch to video any time. Voice is protected first.</small></div></div>
        <div className="tile t4"><span className="ti"><I n="spark" /></span><div><b>AI notes</b><small>Summary, decisions, next steps.</small></div></div>
        <div className="tile t2"><span className="ti"><I n="users" /></span><div><b>Polls, Q&amp;A, breakout rooms</b><small>Classes the way they should be.</small></div></div>
        <div className="tile t3 w2"><span className="ti"><I n="trophy" /></span><div><b>Levels, achievements, leaderboards</b><small>Every meeting counts. Celebrate the milestones and share your cards.</small></div></div></div></section>
    <section className="sec rv" id="earn"><h2>Teach, mentor, host. Get paid.</h2><p className="sub">Paid meetings, course bundles, memberships, one-on-one sessions and certificates. Every fee is shown before you sell: Paystack’s fee and Olexweb’s share, to the kobo. Money goes to your bank every week.</p>
      <div className="bento"><div className="tile t2"><span className="ti"><I n="wallet" /></span><div><b>5% to Olexweb</b><small>On tickets, sessions, bundles and certificates (7% on memberships). Paystack’s fee is shown too, before you sell.</small></div></div>
        <div className="tile t3"><span className="ti"><I n="cert" /></span><div><b>Certificates anyone can check</b><small>Each one has its own code and page.</small></div></div>
        <div className="tile t4"><span className="ti"><I n="gift" /></span><div><b>Invite and earn 3%</b><small>Of a friend’s first Pro payment.</small></div></div></div>
      <p style={{ marginTop: 18 }}><a className="btn" href="/meet/mentors">Find a mentor</a></p></section>
    {spotlight ? <section className="sec rv"><h2>Hosts of the month</h2><div className="bento">{Object.values(spotlight.winners).slice(0, 3).map((w) => <a key={w.label} className="tile t3" href={'/meet/h/' + w.handle}><span className="ti"><I n="star" /></span><div><b>{w.name}</b><small>{w.label}</small></div></a>)}</div></section> : null}
    <div className="sec rv" id="pricing"><MeetPricing pricing={pricing} /></div>
    {faq.length ? <section className="sec rv faq" aria-labelledby="faq-h"><h2 id="faq-h">Questions people ask</h2>{faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section> : null}
    <footer className="ld-foot"><a href="https://olexweb.com">Part of Olexweb</a><a href="/meet/legal/earnings">Earnings and payouts</a><a href="/meet/legal/refunds">Refunds</a><a href="/meet/legal/community">Community rules</a><a href="https://olexweb.com/privacy">Privacy</a><a href="https://olexweb.com/terms">Terms</a></footer>
    {sheet ? <Sheet title="Sign in to Olexweb Meet" onClose={() => setSheet(null)}>
      <p className="dim" style={{ margin: 0 }}>Sign in to host and schedule meetings. People joining your meetings never need an account.</p>
      {providers.length ? <div className="providers">{providers.map((p) => <a key={p.id} className="opt" href={`/api/meet/auth/${p.id}?next=${encodeURIComponent(sheet.next || '/')}`}>{PROVIDER_ICON[p.id]}<span>Continue with {p.name}</span></a>)}</div>
        : !emailOn ? <p className="dim">Sign-in isn’t available yet. Check back soon.</p> : null}
      {emailOn ? <>{providers.length ? <p className="es-or"><span>or with email</span></p> : null}<EmailSignIn next={sheet.next || '/'} /></> : null}
      <p className="dim sm">By continuing you agree to Olexweb’s <a href="https://olexweb.com/terms">terms</a> and <a href="https://olexweb.com/privacy">privacy policy</a>.</p>
    </Sheet> : null}
    {toast ? <p className="toast" role="status">{toast}</p> : null}
  </div>)
}
