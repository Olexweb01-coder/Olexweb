'use client'
// Install 20: "Ask Olexweb", the chat on every public page (not the admin, documents, the 3D studio, Meet or the course).
// A round button with the logo opens a panel (full screen on phones). The chat is remembered on this device, so a visitor
// can come back to it; a link from Olaitan's email (?chat=…) reopens it. While open it checks for Olaitan's replies.
// "Start my project" can open it too (window event "olex-chat-open"). Automated browsers (the factory filming our pages for
// videos) don't get it; tests turn it on with localStorage olex-chat-show = 1.
import { useEffect, useRef, useState, useCallback } from 'react'

const KEY = 'olex-chat'
const HIDE = /^\/(admin|doc|studio|meet|aoc|olex-runner|preview)(\/|$)/
const CHIPS = ['I need a website', 'How much is a website?', 'How does it work?', 'Show me your work']
const get = () => { try { return localStorage.getItem(KEY) } catch { return null } }
const put = (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY) } catch {} }
async function api(body) {
  const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.error || 'Something went wrong. Try again.'); e.status = r.status; throw e } return j
}
// links in a message: only olexweb.com and its booking page become links
function Text({ t }) {
  const parts = String(t).split(/(https:\/\/(?:meet\.)?olexweb\.com\/[\w\-/.?=&#%]*)/g)
  return parts.map((p, i) => /^https:\/\/(meet\.)?olexweb\.com\//.test(p)
    ? <a key={i} href={p} target={p.includes('meet.') ? '_blank' : undefined} rel="noopener">{p.includes('/book') ? 'Book a call with Olaitan' : p.includes('/portfolio') ? 'See the work' : p.includes('/doc/') ? 'See the rates' : p.replace('https://', '')}</a>
    : <span key={i}>{p}</span>)
}

export default function ChatWidget() {
  const [show, setShow] = useState(false), [open, setOpen] = useState(false), [msgs, setMsgs] = useState([]), [status, setStatus] = useState('open')
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [hint, setHint] = useState(false)
  const token = useRef(null), list = useRef(null), input = useRef(null), last = useRef(0), trap = useRef(null), opener = useRef(null)
  const merge = useCallback((j) => {
    if (j.token) { token.current = j.token; put(j.token) }
    if (j.status) setStatus(j.status)
    if (j.messages && j.messages.length) setMsgs((m) => { const seen = new Set(m.map((x) => x.id)); const add = j.messages.filter((x) => !seen.has(x.id) || x.id === 0); last.current = Math.max(last.current, ...j.messages.map((x) => x.id)); return [...m, ...add] })
  }, [])
  useEffect(() => {
    if (HIDE.test(location.pathname) || /^meet\./.test(location.hostname)) return
    let force = false; try { force = localStorage.getItem('olex-chat-show') === '1' } catch {}
    if (navigator.webdriver && !force) return              // automated browsers (the video factory filming our pages, bots): no chat button in the videos
    setShow(true)
    const u = new URL(location.href), fromMail = u.searchParams.get('chat')
    if (fromMail && /^[\w-]{24,40}$/.test(fromMail)) { put(fromMail); u.searchParams.delete('chat'); history.replaceState(null, '', u.pathname + u.search + u.hash); setOpen(true) }
    token.current = get()
    const onOpen = () => setOpen(true); window.addEventListener('olex-chat-open', onOpen)
    let t; try { if (!sessionStorage.getItem('olex-chat-hint')) t = setTimeout(() => { setHint(true); try { sessionStorage.setItem('olex-chat-hint', '1') } catch {} }, 9000) } catch {}
    return () => { window.removeEventListener('olex-chat-open', onOpen); clearTimeout(t) }
  }, [])
  // opening: load the remembered chat, or show the greeting (the chat itself starts with the first message)
  useEffect(() => {
    if (!open) return
    setHint(false)
    if (token.current && !msgs.length) api({ action: 'poll', token: token.current, after: 0 }).then(merge).catch((e) => { if (e.status === 404) { put(null); token.current = null } })
    const prev = document.body.style.overflow; if (window.innerWidth < 700) document.body.style.overflow = 'hidden'
    setTimeout(() => input.current && input.current.focus(), 50)
    const onKey = (e) => { if (e.key === 'Escape') close() }; document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  // while open: check for Olaitan's replies
  useEffect(() => {
    if (!open) return
    const id = setInterval(() => { if (token.current && !busy && document.visibilityState === 'visible') api({ action: 'poll', token: token.current, after: last.current }).then(merge).catch(() => {}) }, 8000)
    return () => clearInterval(id)
  }, [open, busy, merge])
  useEffect(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight }, [msgs, busy, open])
  function close() { setOpen(false); setTimeout(() => opener.current && opener.current.focus(), 0) }
  async function send(t) {
    const m = String(t ?? text).trim(); if (!m || busy) return
    setErr(''); setBusy(true); setText('')
    setMsgs((x) => [...x, { id: 'me' + Date.now(), who: 'visitor', text: m, pending: true }])
    try {
      if (!token.current) {
        const s = await fetch('/api/chat', { cache: 'no-store' }).then((r) => r.json())
        const j = await api({ action: 'start', page: location.pathname.slice(0, 120), stamp: s.stamp, website: trap.current ? trap.current.value : '' })
        if (!j.token) { setMsgs((x) => [...x.filter((y) => !y.pending)]); return }      // a bot
        token.current = j.token; put(j.token); last.current = 0
      }
      const j = await api({ action: 'send', token: token.current, text: m, after: last.current })
      setMsgs((x) => x.filter((y) => !y.pending && y.id !== 0)); merge(j)
    } catch (e) {
      setMsgs((x) => x.filter((y) => !y.pending)); setText(m)
      if (e.status === 404) { put(null); token.current = null }
      setErr(e.message === 'Failed to fetch' ? 'No connection. Try again.' : e.message)
    } finally { setBusy(false); setTimeout(() => input.current && input.current.focus(), 0) }
  }
  function fresh() { put(null); token.current = null; last.current = 0; setMsgs([]); setStatus('open'); setErr('') }
  if (!show) return null
  const shown = msgs.length ? msgs : [{ id: 0, who: 'agent', text: 'Hi, I’m Olaitan’s assistant at Olexweb. Ask me anything about a website, an app, prices or how it works. What are you working on?' }]
  return (<>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    {!open ? <button ref={opener} type="button" className="oc-fab" onClick={() => setOpen(true)} aria-label="Chat with Olexweb">
      <img src="/studio/mark.png" alt="" width="24" height="27" />{hint ? <span className="oc-hint">Questions? Ask here</span> : null}</button> : null}
    {open ? <section className="oc" role="dialog" aria-modal="false" aria-label="Chat with Olexweb">
      <header className="oc-h">
        <span className="oc-logo"><img src="/studio/mark.png" alt="" width="22" height="25" /></span>
        <div><b>Olexweb</b><small>Olaitan’s assistant · replies in seconds</small></div>
        <button type="button" className="oc-x" onClick={close} aria-label="Close the chat"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
      </header>
      <div className="oc-list" ref={list} aria-live="polite">
        {shown.map((m) => <div key={m.id} className={'oc-m oc-' + m.who}>{m.who === 'olaitan' ? <small>Olaitan</small> : null}<Text t={m.text} /></div>)}
        {busy ? <div className="oc-m oc-agent oc-typing" aria-label="Typing"><i /><i /><i /></div> : null}
        {!msgs.some((m) => m.who === 'visitor') && !busy ? <div className="oc-chips">{CHIPS.map((c) => <button key={c} type="button" onClick={() => send(c)}>{c}</button>)}</div> : null}
        {status === 'handover' ? <p className="oc-note">Olaitan has been told. He’ll reply here and by email.</p> : null}
        {status === 'closed' ? <p className="oc-note">This chat is closed. <button type="button" onClick={fresh}>Start a new one</button></p> : null}
      </div>
      {err ? <p className="oc-err" role="alert">{err}</p> : null}
      <form className="oc-f" onSubmit={(e) => { e.preventDefault(); send() }}>
        <input ref={trap} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="oc-trap" />
        <textarea ref={input} rows={1} value={text} maxLength={1000} placeholder="Type your message" aria-label="Your message" disabled={status === 'closed'}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
        <button type="submit" disabled={busy || !text.trim()} aria-label="Send"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
      </form>
      <p className="oc-small">Chats are saved so Olaitan can follow up. <a href="/privacy">Privacy</a></p>
    </section> : null}
  </>)
}
const CSS = `
.oc-fab{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:2147482000;width:58px;height:58px;border-radius:50%;border:1px solid rgba(143,227,106,.55);background:#111311;display:grid;place-items:center;cursor:pointer;box-shadow:0 14px 34px -10px rgba(0,0,0,.6),0 0 0 6px rgba(143,227,106,.08);transition:transform .2s}
.oc-fab:hover{transform:translateY(-2px)}.oc-fab:focus-visible{outline:2px solid #8fe36a;outline-offset:3px}.oc-fab img{display:block}
.oc-hint{position:absolute;right:68px;top:50%;transform:translateY(-50%);white-space:nowrap;background:#f2efe9;color:#0a0b0a;font:700 14px/1 var(--font-mona),system-ui,sans-serif;padding:10px 14px;border-radius:999px;box-shadow:0 10px 24px -10px rgba(0,0,0,.5);animation:ocIn .3s ease-out}
.oc{position:fixed;z-index:2147482001;inset:0;display:flex;flex-direction:column;background:#0d0f0d;color:#f2efe9;font-family:var(--font-mona),system-ui,sans-serif;animation:ocUp .25s cubic-bezier(.2,.8,.2,1)}
@media (min-width:700px){.oc{inset:auto 20px 20px auto;width:390px;height:min(620px,calc(100vh - 40px));border-radius:24px;border:1px solid rgba(242,239,233,.12);box-shadow:0 30px 70px -20px rgba(0,0,0,.7);overflow:hidden}}
.oc-h{display:flex;align-items:center;gap:12px;padding:calc(12px + env(safe-area-inset-top)) 14px 12px 16px;border-bottom:1px solid rgba(242,239,233,.1)}
.oc-logo{width:40px;height:40px;border-radius:12px;background:#171a17;display:grid;place-items:center;flex:none}
.oc-h div{display:grid;flex:1;min-width:0}.oc-h b{font-family:var(--font-hubot),system-ui,sans-serif;font-weight:800;font-size:17px}.oc-h small{color:rgba(242,239,233,.6);font-size:13px}
.oc-x{width:44px;height:44px;border-radius:50%;border:1px solid rgba(242,239,233,.14);background:transparent;color:inherit;display:grid;place-items:center;cursor:pointer;flex:none}
.oc-list{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}
.oc-m{max-width:86%;padding:11px 14px;border-radius:18px;font-size:15.5px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}
.oc-agent{align-self:flex-start;background:#1a1d1a;border-bottom-left-radius:6px}.oc-olaitan{align-self:flex-start;background:rgba(143,227,106,.16);border:1px solid rgba(143,227,106,.4);border-bottom-left-radius:6px}
.oc-olaitan small{display:block;font-size:12px;font-weight:800;color:#8fe36a;margin-bottom:2px}
.oc-visitor{align-self:flex-end;background:#8fe36a;color:#0b0c0b;border-bottom-right-radius:6px}
.oc-m a{color:#8fe36a;font-weight:700}.oc-visitor a{color:#0b0c0b}
.oc-typing{display:flex;gap:5px;padding:14px 16px}.oc-typing i{width:7px;height:7px;border-radius:50%;background:rgba(242,239,233,.55);animation:ocDot 1s infinite}.oc-typing i:nth-child(2){animation-delay:.15s}.oc-typing i:nth-child(3){animation-delay:.3s}
.oc-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}.oc-chips button{min-height:40px;padding:0 14px;border-radius:999px;border:1px solid rgba(143,227,106,.45);background:transparent;color:#f2efe9;font-family:inherit;font-weight:600;font-size:14px;line-height:1;cursor:pointer}
.oc-chips button:hover{background:rgba(143,227,106,.1)}
.oc-note{margin:2px 0 0;font-size:13.5px;color:rgba(242,239,233,.65);text-align:center}.oc-note button{background:none;border:0;color:#8fe36a;font:inherit;font-weight:700;cursor:pointer;text-decoration:underline}
.oc-err{margin:0;padding:8px 16px;color:#ff9b8a;font-size:14px}
.oc-f{display:flex;gap:8px;align-items:flex-end;padding:10px 12px 6px;border-top:1px solid rgba(242,239,233,.1)}
.oc-f textarea{flex:1;resize:none;max-height:120px;min-height:46px;padding:12px 14px;border-radius:16px;border:1px solid rgba(242,239,233,.16);background:#151815;color:inherit;font-family:inherit;font-size:16px;line-height:1.35}
.oc-f textarea:focus{outline:2px solid #8fe36a;outline-offset:0;border-color:transparent}
.oc-f button{width:46px;height:46px;border-radius:50%;border:0;background:#8fe36a;color:#0b0c0b;display:grid;place-items:center;cursor:pointer;flex:none}.oc-f button:disabled{opacity:.45;cursor:default}
.oc-trap{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}
.oc-small{margin:0;padding:0 16px calc(10px + env(safe-area-inset-bottom));font-size:12px;color:rgba(242,239,233,.5)}.oc-small a{color:inherit}
@keyframes ocUp{from{transform:translateY(18px);opacity:.3}to{transform:none;opacity:1}}@keyframes ocIn{from{opacity:0}to{opacity:1}}@keyframes ocDot{0%,100%{opacity:.3}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.oc,.oc-hint,.oc-typing i{animation:none}.oc-fab{transition:none}}
`
