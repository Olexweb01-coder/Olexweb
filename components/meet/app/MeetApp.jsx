'use client'
// The signed-in Olexweb Meet app (Install 58): a menu on every screen (a drawer on phones), the bell top-right,
// light and dark, celebrations for every milestone, What's new, and the pages. Everything comes from /api/meet/home.
import { useCallback, useEffect, useRef, useState } from 'react'
import { I } from './icons'
import { api, homePath, pathFor, linkFor, onMeetApp, Ring, Sheet, JoinBox } from './ui'
import HomePage from './HomePage'
import MeetingsPage from './MeetingsPage'
import EarnPage from './EarnPage'
import ProfilePage from './ProfilePage'
import LeadersPage from './LeadersPage'
import HelpPage, { SettingsPage } from './HelpPage'
import Celebrate from './Celebrate'

const PAGES = [['home', 'Home', 'home'], ['meetings', 'Meetings', 'cal'], ['room', 'My room', 'door'], ['notes', 'Recordings and notes', 'spark'],
  ['-Grow'], ['profile', 'My profile', 'user'], ['leaders', 'Leaderboard', 'trophy'], ['earn', 'Earn', 'wallet'], ['-More'], ['help', 'Help', 'help'], ['settings', 'Settings', 'gear']]
const ALIAS = { dashboard: 'home', '': 'home' }

export default function MeetApp({ user, meetings: initial, pricing, morePast = 0, notice = '' }) {
  const [page, setPage] = useState('home'), [drawer, setDrawer] = useState(false), [theme, setTheme] = useState('dark')
  const [h, setH] = useState(null), [list, setList] = useState(initial || []), [bell, setBell] = useState(false), [toast, setToast] = useState(notice || ''), [newMenu, setNewMenu] = useState(false)
  const [queue, setQueue] = useState([]), [news, setNews] = useState(null), [install, setInstall] = useState(null)
  const load = useCallback(async () => { try { setH(await api('/api/meet/home')) } catch {} }, [])
  const refresh = useCallback(async () => { try { setList((await api('/api/meet/mine', { action: 'list' })).meetings) } catch {} }, [])
  useEffect(() => {
    try { const t = localStorage.getItem('meet-theme'); if (t === 'light' || t === 'dark') setTheme(t) } catch {}
    const go = () => { const k = location.hash.slice(1); const p = ALIAS[k] ?? k; setPage(PAGES.some((x) => x[0] === p) ? p : 'home'); setDrawer(false); setBell(false) }
    go(); window.addEventListener('hashchange', go)
    load()
    const sp = new URLSearchParams(location.search)
    if (sp.get('paid')) { setToast(sp.get('paid') === '1' ? (sp.get('member') ? 'Payment received. Welcome to the community!' : 'Payment received. Thank you!') : 'The payment didn’t go through. Nothing was charged.'); history.replaceState(null, '', location.pathname + location.hash) }
    const then = sp.get('then')                                              // after signing in from "New meeting": carry on
    if (then) { history.replaceState(null, '', location.pathname); if (then === 'start') startNow(); if (then === 'start-audio') startNow('audio'); if (then === 'schedule') { location.hash = 'meetings'; setTimeout(() => window.dispatchEvent(new Event('meet:schedule')), 300) } }
    if (onMeetApp() && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    const p = (e) => { e.preventDefault(); setInstall(e) }; window.addEventListener('beforeinstallprompt', p)
    return () => { window.removeEventListener('hashchange', go); window.removeEventListener('beforeinstallprompt', p) }
  }, [load])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 6000); return () => clearTimeout(t) }, [toast])
  // celebrations first (once each), then What's new
  useEffect(() => {
    if (!h) return
    const c = h.celebrate, q = []
    if (c.welcome) q.push({ kind: 'welcome', badges: c.badges, level: h.level })
    else {
      if (c.badges.length) q.push({ kind: 'badges', badges: c.badges, level: h.level })
      if (c.level) q.push({ kind: 'level', level: h.level })
    }
    setQueue(q)
    setNews(h.news && !c.welcome ? h.news : null)
    if (c.welcome && h.news) api('/api/meet/home', { action: 'seen', news: h.news.id }).catch(() => {})   // the welcome already says what's new
  }, [h])
  function closeCelebration() {
    const c = queue[0], rest = queue.slice(1); setQueue(rest)
    api('/api/meet/home', { action: 'seen', badges: c.kind !== 'level', level: h.level.level, welcome: c.kind === 'welcome' }).catch(() => {})
  }
  function closeNews() { api('/api/meet/home', { action: 'seen', news: news.id }).catch(() => {}); setNews(null) }
  function toggleTheme() { const t = theme === 'dark' ? 'light' : 'dark'; setTheme(t); try { localStorage.setItem('meet-theme', t) } catch {} }
  async function openBell() { setBell((b) => !b); if (h && h.dash.unread) { api('/api/meet/dash', { action: 'read' }).catch(() => {}); setH({ ...h, dash: { ...h.dash, unread: 0 } }) } }
  async function openRoom() {
    setDrawer(false)
    try { const r = await api('/api/meet/mine', { action: 'room' }); try { await navigator.clipboard.writeText(location.origin + (onMeetApp() ? '/' : '/meet/r/') + r.handle) } catch {} location.assign(pathFor(r.code)) }
    catch (e) { setToast(e.message) }
  }
  async function startNow(mode = 'video') {
    setNewMenu(false)
    try { const r = await api('/api/meet/mine', { action: 'create', mode, kind: 'instant', title: `${(user.name || '').split(' ')[0] || 'My'}’s ${mode === 'audio' ? 'call' : 'meeting'}` }); location.assign(pathFor(r.code)) }
    catch (e) { setToast(e.message) }
  }
  function nav(p) { if (p === 'room') return openRoom(); location.hash = p === 'home' ? 'home' : p }
  async function signOut() { await api('/api/meet/me', { action: 'sign-out' }).catch(() => {}); location.assign(homePath()) }

  const lvl = h ? h.level : null, me = h ? h.me : { name: user.name, picture: user.picture }, unread = h ? h.dash.unread : 0
  const ctx = { user, h, me, list, setList, refresh, reload: load, setToast, nav, startNow, openRoom, pricing, morePast, newMeeting: () => setNewMenu(true), theme, toggleTheme, signOut, install, setInstall }
  return (<div className="ma" data-theme={theme}>
    <div className="mesh" aria-hidden="true" />
    <div className={'app' + (drawer ? ' drawer' : '')}>
      <div className="scrim" onClick={() => setDrawer(false)} />
      <aside className="sb" aria-label="Menu">
        <a className="brand" href={homePath()}><img src="/meet/logo-96.png" alt="" /><span>Olexweb <b>Meet</b></span></a>
        <button className="btn newbtn" onClick={() => { setDrawer(false); setNewMenu(true) }}><I n="plus" />New meeting</button>
        {PAGES.map((p) => p[0].startsWith('-') ? <div key={p[0]} className="sl">{p[0].slice(1)}</div>
          : <a key={p[0]} className={'nl' + (page === p[0] ? ' on' : '')} href={'#' + p[0]} aria-current={page === p[0] ? 'page' : undefined} onClick={(e) => { if (p[0] === 'room') { e.preventDefault(); openRoom() } else setDrawer(false) }}>
            <span className="ni"><I n={p[2]} /></span>{p[1]}{p[0] === 'leaders' && h && h.rank ? <span className="new">#{h.rank.rank}</span> : null}{p[0] === 'earn' && h && h.dash.pricing.on ? <span className="new">New</span> : null}</a>)}
        <a className="me" href="#profile" onClick={() => setDrawer(false)}><Ring pct={lvl ? lvl.pct : 0} level={lvl ? lvl.level : null} name={me.name} picture={me.picture} />
          <span><b>{me.name}</b><small>{lvl ? `${lvl.title} · ${lvl.xp.toLocaleString()} XP` : ' '}</small></span></a>
      </aside>
      <main className="main" id="main">
        <div className="top">
          <button className="ib menu-btn" aria-label="Open the menu" aria-expanded={drawer} onClick={() => setDrawer(true)}><I n="menu" /></button>
          <a className="brand tb-brand" href={homePath()}><img src="/meet/logo-96.png" alt="" />Meet</a>
          <JoinBox />
          <span className="grow" style={{ flex: 1 }} />
          <button className="ib theme-btn" aria-label={theme === 'dark' ? 'Switch to light' : 'Switch to dark'} onClick={toggleTheme}><I n="sun" /></button>
          <button className="ib" aria-label={unread ? `${unread} new notifications` : 'Notifications'} aria-expanded={bell} onClick={openBell}><I n="bell" />{unread ? <span className="dot">{unread > 9 ? '9+' : unread}</span> : null}</button>
          <a className="topav" href="#profile"><Ring pct={lvl ? lvl.pct : 0} name={me.name} picture={me.picture} /><span>{(me.name || '').split(' ')[0]}</span></a>
        </div>
        {bell ? <Notifications h={h} onClose={() => setBell(false)} nav={nav} /> : null}
        <div className="page on" key={page}>
          {page === 'home' ? <HomePage ctx={ctx} /> : page === 'meetings' || page === 'notes' ? <MeetingsPage ctx={ctx} notes={page === 'notes'} /> : page === 'earn' ? <EarnPage ctx={ctx} />
            : page === 'profile' ? <ProfilePage ctx={ctx} /> : page === 'leaders' ? <LeadersPage ctx={ctx} /> : page === 'help' ? <HelpPage ctx={ctx} /> : page === 'settings' ? <SettingsPage ctx={ctx} /> : null}
        </div>
      </main>
    </div>
    {newMenu ? <Sheet title="New meeting" onClose={() => setNewMenu(false)}>
      <button className="opt" onClick={() => startNow('video')}><span className="ni bg-g"><I n="video" /></span><span><b>Start a video meeting now</b><br /><small>Get a link and go in</small></span></button>
      <button className="opt" onClick={() => startNow('audio')}><span className="ni bg-b"><I n="mic" /></span><span><b>Start an audio call now</b><br /><small>Voices only, light on data</small></span></button>
      <button className="opt" onClick={() => { setNewMenu(false); openRoom() }}><span className="ni bg-v"><I n="door" /></span><span><b>Open my room</b><br /><small>Your own link that never changes</small></span></button>
      <button className="opt" onClick={() => { setNewMenu(false); location.hash = 'meetings'; setTimeout(() => window.dispatchEvent(new Event('meet:schedule')), 50) }}><span className="ni bg-o"><I n="cal" /></span><span><b>Schedule a meeting</b><br /><small>Pick a time, share the invite</small></span></button>
    </Sheet> : null}
    {queue.length ? <Celebrate c={queue[0]} me={me} onClose={closeCelebration} /> : null}
    {!queue.length && news ? <Sheet title="What’s new" onClose={closeNews}><div className="whatsnew"><span className="pill"><i />New</span><h2>{news.title}</h2><p>{news.body}</p>
      <button className="btn go" onClick={closeNews}>Got it</button></div></Sheet> : null}
    {toast ? <p className="toast" role="status">{toast}</p> : null}
  </div>)
}

function Notifications({ h, onClose, nav }) {
  const close = useRef(onClose); close.current = onClose
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') close.current() }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k) }, [])
  if (!h) return null
  const icon = { soon: ['clock', 'bg-o'], streak: ['flame', 'bg-y'], best: ['rocket', 'bg-g'], rank: ['trophy', 'bg-y'], spot: ['star', 'bg-v'], public: ['user', 'bg-b'] }
  return (<div className="np on" role="dialog" aria-label="Notifications">
    <h3>Notifications <button className="lnk" onClick={onClose}>Close</button></h3>
    {h.nudges.map((n, i) => <div key={'n' + i} className="nt new"><span className={'ni ' + (icon[n.kind] || ['spark', 'bg-b'])[1]}><I n={(icon[n.kind] || ['spark'])[0]} /></span><div><b>{n.title}</b><span>{n.body}</span>
      {n.code ? <div className="acts"><a className="btn go sm" href={pathFor(n.code)}>Open room</a><button className="btn sm" onClick={() => navigator.clipboard && navigator.clipboard.writeText(linkFor(n.code))}>Copy link</button></div> : null}
      {n.kind === 'public' ? <div className="acts"><button className="btn sm" onClick={() => { onClose(); nav('profile') }}>Edit profile</button></div> : null}<small>Reminder</small></div></div>)}
    {h.dash.notices.map((n) => <div key={n.id} className={'nt' + (n.read ? '' : ' new')}><span className="ni bg-b"><I n="bell" /></span><div><b>{n.title}</b>{n.body ? <span>{n.body}</span> : null}
      {n.link ? <div className="acts"><a className="btn sm" href={n.link}>Open</a></div> : null}<small>{new Date(n.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</small></div></div>)}
    {!h.nudges.length && !h.dash.notices.length ? <p className="dim" style={{ padding: 12 }}>Nothing yet.</p> : null}
  </div>)
}
