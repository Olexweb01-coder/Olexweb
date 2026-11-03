'use client'
// Olexweb Meet's home, laid out like Google Meet's: New meeting (start now or schedule: needs an account) next to
// Join with a code or link (never needs one), then your meetings. Times show in the visitor's own time zone and are
// rendered only in the browser (servers format dates slightly differently). Installs as an app on the Meet address.
import { useEffect, useMemo, useRef, useState } from 'react'

const CODE_RE = /[a-hj-km-np-z]{3}-[a-hj-km-np-z]{4}-[a-hj-km-np-z]{3}/
const onMeetApp = () => typeof location !== 'undefined' && location.hostname.startsWith('meet.')
const pathFor = (code) => (onMeetApp() ? '/' : '/meet/') + code
const linkFor = (code) => location.origin + pathFor(code)
const homePath = () => (onMeetApp() ? '/' : '/meet')
const ICON = {
  plus: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>,
  cal: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>,
  bolt: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" /></svg>,
  key: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6.5" width="18" height="11" rx="3" /><path d="M7 12h.01M11 12h.01M15 12h2" /></svg>,
  wave: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h2M8 8v8M12 5v14M16 8v8M20 11v2" /></svg>,
  chat: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 12a7.8 7.8 0 0 1-11.3 7L4 20l1.1-4.6A8.5 8.5 0 1 1 20.5 12z" /></svg>,
  rec: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3.5" className="mh-fill" /></svg>,
  bell: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0" /></svg>,
  down: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10.5 12 15.5l5-5M5 20h14" /></svg>,
}
const PROVIDER_ICON = {
  google: <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" /><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" /><path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z" /><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5L6.4 10C7.2 7.7 9.4 5.9 12 5.9z" /></svg>,
  microsoft: <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#F25022" d="M3 3h8.5v8.5H3z" /><path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5z" /><path fill="#00A4EF" d="M3 12.5h8.5V21H3z" /><path fill="#FFB900" d="M12.5 12.5H21V21h-8.5z" /></svg>,
  github: <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5a9.5 9.5 0 0 0-3 18.5c.5.1.7-.2.7-.5v-1.8c-2.6.6-3.2-1.2-3.2-1.2-.4-1.1-1-1.4-1-1.4-.9-.6 0-.6 0-.6 1 .1 1.5 1 1.5 1 .8 1.5 2.3 1 2.8.8.1-.6.3-1 .6-1.3-2.1-.2-4.3-1-4.3-4.7 0-1 .4-1.9 1-2.6-.1-.2-.4-1.2.1-2.5 0 0 .8-.3 2.6 1a9 9 0 0 1 4.8 0c1.8-1.3 2.6-1 2.6-1 .5 1.3.2 2.3.1 2.5.6.7 1 1.6 1 2.6 0 3.7-2.3 4.5-4.4 4.7.4.3.7.9.7 1.8v2.7c0 .3.2.6.7.5A9.5 9.5 0 0 0 12 2.5z" /></svg>,
  facebook: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#1877F2" /><path fill="#fff" d="M13.4 21.9v-7h2.3l.4-2.7h-2.7v-1.7c0-.8.2-1.3 1.3-1.3h1.4V6.8a19 19 0 0 0-2.1-.1c-2.1 0-3.5 1.3-3.5 3.6v2h-2.3v2.7h2.3v7a10 10 0 0 0 2.9 0z" /></svg>,
}
async function call(body) {
  const r = await fetch('/api/meet/mine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(j.error || 'That didn’t work. Try again.'), { status: r.status })
  return j
}
const tzName = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ') } catch { return 'your time' } }
const fmt = (iso) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const fmtLong = (iso) => new Date(iso).toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })
const pad = (n) => String(n).padStart(2, '0')
function nextSlot() { const d = new Date(Date.now() + 90 * 60e3); d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0); return [`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, `${pad(d.getHours())}:${pad(d.getMinutes())}`] }
function calLinks(m) {
  const z = (x) => new Date(x).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''), t = new Date(m.startsAt).getTime(), url = linkFor(m.code)
  return { google: 'https://calendar.google.com/calendar/render?' + new URLSearchParams({ action: 'TEMPLATE', text: m.title, dates: `${z(t)}/${z(t + (m.minutes || 60) * 60e3)}`, details: 'Join the meeting: ' + url, location: url }), ics: '/api/meet?calendar=1&code=' + m.code }
}

export default function MeetHome({ user, providers, meetings: initial, notice }) {
  const [ready, setReady] = useState(false), [list, setList] = useState(initial || []), [code, setCode] = useState(''), [menu, setMenu] = useState(false)
  const [sheet, setSheet] = useState(null), [busy, setBusy] = useState(''), [toast, setToast] = useState(notice || ''), [install, setInstall] = useState(null), [ios, setIos] = useState(false)
  const menuRef = useRef(null)
  useEffect(() => {
    setReady(true)
    if (onMeetApp() && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    const p = (e) => { e.preventDefault(); setInstall(e) }; window.addEventListener('beforeinstallprompt', p)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone
    setIos(onMeetApp() && /iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone)
    if (notice) history.replaceState(null, '', homePath())
    return () => window.removeEventListener('beforeinstallprompt', p)
  }, [notice])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 6000); return () => clearTimeout(t) }, [toast])
  useEffect(() => { if (!menu) return; const c = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false) }; const k = (e) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('pointerdown', c); document.addEventListener('keydown', k); return () => { document.removeEventListener('pointerdown', c); document.removeEventListener('keydown', k) } }, [menu])
  const found = useMemo(() => (code.match(CODE_RE) || [])[0] || null, [code])
  const upcoming = list.filter((m) => !m.endedAt), past = list.filter((m) => m.endedAt).slice(0, 8)

  function join(e) { e.preventDefault(); if (found) location.assign(pathFor(found)); else setToast('That isn’t a meeting code. It looks like abc-defg-hij.') }
  function needAccount(next) { setMenu(false); setSheet({ kind: 'signin', next }) }
  async function startNow() {
    setMenu(false); if (!user) return needAccount('/?then=start')
    setBusy('start')
    try { const r = await call({ action: 'create', title: `${user.name.split(' ')[0] || 'My'}’s meeting` }); location.assign(pathFor(r.code)) }
    catch (e) { setToast(e.message); setBusy('') }
  }
  function openSchedule(m = null) {
    setMenu(false); if (!user) return needAccount('/?then=schedule')
    const [d, t] = m && m.startsAt ? (() => { const x = new Date(m.startsAt); return [`${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`, `${pad(x.getHours())}:${pad(x.getMinutes())}`] })() : nextSlot()
    setSheet({ kind: 'schedule', edit: m, title: m ? m.title : '', date: d, time: t, minutes: m ? m.minutes || 60 : 60, speakers: m ? m.speakers : 'everyone', done: null })
  }
  async function saveSchedule(e) {
    e.preventDefault(); const s = sheet, startsAt = new Date(`${s.date}T${s.time}:00`)                // the visitor's own time zone
    if (!Number.isFinite(startsAt.getTime())) { setToast('Choose a date and time.'); return }
    setBusy('schedule')
    try {
      const body = { title: s.title, startsAt: startsAt.toISOString(), minutes: s.minutes, speakers: s.speakers }
      const r = s.edit ? await call({ action: 'update', code: s.edit.code, ...body }) : await call({ action: 'create', ...body })
      const code = s.edit ? s.edit.code : r.code, m = { code, title: s.title || 'Meeting', startsAt: startsAt.toISOString(), minutes: s.minutes }
      setSheet({ ...s, done: m }); refresh()
    } catch (err) { setToast(err.message) } finally { setBusy('') }
  }
  async function refresh() { try { setList((await call({ action: 'list' })).meetings) } catch {} }
  async function act(m, action) {
    if (action === 'end' && !confirm(`End “${m.title}” for everyone? The link stops working.`)) return
    if (action === 'delete' && !confirm(`Delete “${m.title}”? This can’t be undone.`)) return
    setBusy(action + m.code); try { await call({ action, code: m.code }); await refresh(); setToast(action === 'end' ? 'Meeting ended.' : 'Deleted.') } catch (e) { setToast(e.message) } finally { setBusy('') }
  }
  async function copy(m) {
    const text = m.startsAt ? `You’re invited: ${m.title}\n${fmtLong(m.startsAt)} (${tzName()} time)\nJoin: ${linkFor(m.code)}` : `Join my meeting: ${linkFor(m.code)}`
    try { await navigator.clipboard.writeText(text); setToast(m.startsAt ? 'Invite copied.' : 'Link copied.') } catch { prompt('Copy this:', text) }
  }
  async function signOut() { await fetch('/api/meet/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'sign-out' }) }).catch(() => {}); location.assign(homePath()) }
  // after signing in from "New meeting", carry on with what they wanted
  useEffect(() => { if (!user) return; const t = new URLSearchParams(location.search).get('then'); if (!t) return; history.replaceState(null, '', homePath()); if (t === 'start') startNow(); if (t === 'schedule') openSchedule() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  return (<div className="mh">
    <header className="mh-top">
      <a className="mh-brand" href={homePath()}><img src="/meet/logo-96.png" alt="" width="40" height="40" /><span>Olexweb <b>Meet</b></span></a>
      <div className="mh-top-end">
        {install ? <button className="mh-btn mh-ghost" onClick={async () => { install.prompt(); await install.userChoice.catch(() => {}); setInstall(null) }}>{ICON.down}<span>Install app</span></button> : null}
        {user ? <details className="mh-me"><summary aria-label="Your account">{user.picture ? <img src={user.picture} alt="" width="34" height="34" referrerPolicy="no-referrer" /> : <i>{(user.name || '?')[0].toUpperCase()}</i>}</summary>
          <div className="mh-me-menu"><b>{user.name}</b>{user.email ? <small>{user.email}</small> : null}{user.role === 'owner' ? <a href="https://olexweb.com/admin">Open the admin</a> : null}<button onClick={signOut}>Sign out</button></div></details>
          : <button className="mh-btn mh-ghost" onClick={() => setSheet({ kind: 'signin', next: '/' })}>Sign in</button>}
      </div>
    </header>

    <main className="mh-main">
      <section className="mh-hero">
        <h1>Meetings that keep working, even on a weak connection.</h1>
        <p>Free video meetings from Olexweb. Voice comes first, so calls stay clear on mobile data. Anyone with the link can join, no account needed.</p>
        <div className="mh-actions">
          <div className="mh-new" ref={menuRef}>
            <button className="mh-btn mh-go" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu((x) => !x)} disabled={busy === 'start'}>{ICON.plus}{busy === 'start' ? 'Starting…' : 'New meeting'}</button>
            {menu ? <div className="mh-menu" role="menu">
              <button role="menuitem" onClick={startNow}>{ICON.bolt}<span><b>Start a meeting now</b><small>Get a link and go in</small></span></button>
              <button role="menuitem" onClick={() => openSchedule()}>{ICON.cal}<span><b>Schedule a meeting</b><small>Pick a time, share the invite</small></span></button>
            </div> : null}
          </div>
          <form className="mh-join" onSubmit={join}>
            <span className="mh-key">{ICON.key}</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter a code or link" aria-label="Meeting code or link" autoComplete="off" spellCheck="false" />
            <button className="mh-btn mh-link" disabled={!found}>Join</button>
          </form>
        </div>
        {!user ? <p className="mh-fine">Creating or scheduling needs a free account. Joining never does.</p> : null}
      </section>

      {user ? <section className="mh-mine" aria-label="Your meetings">
        <h2>Your meetings</h2>
        {upcoming.length ? <ul className="mh-list">{upcoming.map((m) => <li key={m.code}>
          <div className="mh-li-main"><b>{m.title}</b><span>{ready ? (m.startedAt ? 'Happening now' : m.startsAt ? fmt(m.startsAt) : 'Ready when you are') : '\u00a0'}<em>{m.code}</em></span></div>
          <div className="mh-li-acts">
            <a className="mh-btn mh-go mh-sm" href={pathFor(m.code)}>{m.startedAt ? 'Join' : 'Start'}</a>
            <button className="mh-btn mh-sm" onClick={() => copy(m)}>{m.startsAt ? 'Copy invite' : 'Copy link'}</button>
            {!m.startedAt ? <button className="mh-btn mh-sm" onClick={() => openSchedule(m)}>{m.startsAt ? 'Change' : 'Schedule'}</button> : null}
            <button className="mh-btn mh-sm mh-quiet" disabled={!!busy} onClick={() => act(m, 'end')}>End</button>
          </div></li>)}</ul>
          : <p className="mh-empty">No meetings yet. Start one now, or schedule one and share the invite.</p>}
        {past.length ? <><h3>Ended</h3><ul className="mh-list mh-past">{past.map((m) => <li key={m.code}><div className="mh-li-main"><b>{m.title}</b><span>{ready ? 'Ended ' + fmt(m.endedAt) : '\u00a0'}{m.joins ? `, ${m.joins} join${m.joins === 1 ? '' : 's'}` : ''}</span></div>
          <div className="mh-li-acts"><button className="mh-btn mh-sm mh-quiet" disabled={!!busy} onClick={() => act(m, 'delete')}>Delete</button></div></li>)}</ul></> : null}
      </section> : null}

      <section className="mh-features" aria-label="What you get">
        {[[ICON.wave, 'Clear on weak networks', 'Voice is protected first; video adjusts by itself. Data saver turns cameras off.'],
          [ICON.chat, 'Chat, reactions, screen share', 'Emoji, raised hands, and letting people speak when you choose.'],
          [ICON.rec, 'Record to your device', 'Saved on your phone or computer. Nothing is stored on our servers.'],
          [ICON.bell, 'Schedule with invites', 'Guests add it to their calendar in one tap, with reminders built in.']].map(([i, t, d]) => <div key={t} className="mh-feat">{i}<b>{t}</b><span>{d}</span></div>)}
      </section>
      {ios ? <p className="mh-fine mh-ios">On iPhone: tap Share, then <b>Add to Home Screen</b> to install Meet as an app.</p> : null}
    </main>

    <footer className="mh-foot"><a href="https://olexweb.com">Part of Olexweb</a><a href="https://olexweb.com/privacy">Privacy</a><a href="https://olexweb.com/terms">Terms</a></footer>

    {sheet ? <div className="mh-modal" role="dialog" aria-modal="true" aria-labelledby="mh-sheet-h" onPointerDown={(e) => { if (e.target === e.currentTarget) setSheet(null) }}>
      <div className="mh-card">
        {sheet.kind === 'signin' ? <>
          <h2 id="mh-sheet-h">Sign in to Olexweb Meet</h2>
          <p>Sign in to create and schedule meetings. People joining your meetings never need an account.</p>
          {providers.length ? <div className="mh-providers">{providers.map((p) => <a key={p.id} className="mh-provider" href={`/api/meet/auth/${p.id}?next=${encodeURIComponent(sheet.next || '/')}`}>{PROVIDER_ICON[p.id]}<span>Continue with {p.name}</span></a>)}</div>
            : <p className="mh-note">Sign-in isn’t available yet. Check back soon.</p>}
          <p className="mh-fine">By continuing you agree to Olexweb’s <a href="https://olexweb.com/terms">terms</a> and <a href="https://olexweb.com/privacy">privacy policy</a>.</p>
          <button className="mh-btn mh-quiet mh-close" onClick={() => setSheet(null)}>Not now</button>
        </> : sheet.done ? <>
          <h2 id="mh-sheet-h">{sheet.edit ? 'Meeting updated' : 'Meeting scheduled'}</h2>
          <p><b>{sheet.done.title}</b><br />{fmtLong(sheet.done.startsAt)} ({tzName()} time)</p>
          <div className="mh-linkbox"><code>{linkFor(sheet.done.code)}</code></div>
          <div className="mh-row"><button className="mh-btn mh-go" onClick={() => copy(sheet.done)}>Copy invite</button>
            <a className="mh-btn" href={calLinks(sheet.done).google} target="_blank" rel="noopener">Add to Google Calendar</a><a className="mh-btn" href={calLinks(sheet.done).ics} download="meeting.ics">Apple or Outlook</a></div>
          <p className="mh-fine">Guests can add it to their calendar from the link too, with reminders built in.</p>
          <button className="mh-btn mh-quiet mh-close" onClick={() => setSheet(null)}>Done</button>
        </> : <form onSubmit={saveSchedule}>
          <h2 id="mh-sheet-h">{sheet.edit ? 'Change the meeting' : 'Schedule a meeting'}</h2>
          <label className="mh-f"><span>Name</span><input value={sheet.title} maxLength={80} onChange={(e) => setSheet({ ...sheet, title: e.target.value })} placeholder="Team catch-up" /></label>
          <div className="mh-dt">
            <label className="mh-f"><span>Date</span><input type="date" value={sheet.date} onChange={(e) => setSheet({ ...sheet, date: e.target.value })} /></label>
            <label className="mh-f"><span>Time ({ready ? tzName() : 'your time'})</span><input type="time" value={sheet.time} step={300} onChange={(e) => setSheet({ ...sheet, time: e.target.value })} /></label>
            <label className="mh-f"><span>Length</span><select value={sheet.minutes} onChange={(e) => setSheet({ ...sheet, minutes: Number(e.target.value) })}>{[15, 30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m < 60 ? m + ' minutes' : m === 60 ? '1 hour' : m / 60 + ' hours'}</option>)}</select></label>
          </div>
          <div className="mh-f"><span>Who can speak</span><div className="mh-seg" role="group" aria-label="Who can speak">
            <button type="button" aria-pressed={sheet.speakers === 'everyone'} onClick={() => setSheet({ ...sheet, speakers: 'everyone' })}>Everyone</button>
            <button type="button" aria-pressed={sheet.speakers === 'invited'} onClick={() => setSheet({ ...sheet, speakers: 'invited' })}>Only people I let speak</button></div></div>
          <div className="mh-row"><button className="mh-btn mh-go" disabled={busy === 'schedule'}>{busy === 'schedule' ? 'Saving…' : sheet.edit ? 'Save' : 'Schedule'}</button><button type="button" className="mh-btn mh-quiet" onClick={() => setSheet(null)}>Cancel</button></div>
        </form>}
      </div>
    </div> : null}
    {toast ? <p className="mh-toast" role="status">{toast}</p> : null}
  </div>)
}
