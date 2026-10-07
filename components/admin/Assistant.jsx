'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast, Sheet } from './ui'
import Markdown from './Markdown'
import Notifications from './Notifications'

async function call(payload) {
  try {
    const r = await fetch('/admin/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'same-origin' })
    const j = await r.json().catch(() => ({}))
    if (r.status === 401) { window.location.assign('/admin/login'); return { error: 'Sign in again.' } }
    return r.ok ? j : { error: j.error || 'Something went wrong. Try again.' }
  } catch { return { error: 'No connection. Try again.' } }
}
const day = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' }) : '')
const hoursLeft = (d) => Math.max(0, Math.round((new Date(d) - Date.now()) / 3600e3))

export default function AssistantBoard({ ready, scheduled, pending = [], pausedUntil = null, settings, messages, research, drafts, published, chats = [], chatId: firstChat = null }) {
  const [chatId, setChatId] = useState(firstChat), [chatList, setChatList] = useState(chats), [showChats, setShowChats] = useState(false)
  useEffect(() => { setChatList(chats) }, [chats])                       // after a refresh, the latest chat list
  useEffect(() => { if (chatId === firstChat) setMsgs(messages) }, [messages])   // and the latest messages of the open chat
  const router = useRouter(), [tab, setTab] = useState('chat'), [msgs, setMsgs] = useState(messages), [text, setText] = useState(''), [busy, setBusy] = useState('')
  const end = useRef(null)
  useEffect(() => { if (tab === 'chat' && end.current) end.current.scrollIntoView({ block: 'end' }) }, [msgs, tab])
  const modeLine = <span className={'pill ' + (settings.mode === 'approval' ? 'live' : 'draft')}>{settings.mode === 'approval' ? 'Drafts wait for you' : `Autopilot, ${settings.pace} a week`}</span>
  if (!ready) return (<><div className="top"><h1 className="d">Olex AI</h1>{modeLine}</div>
    <div className="share"><b className="d" style={{ fontSize: 20, fontWeight: 700, fontStretch: '90%' }}>One step to switch it on.</b>
      <p style={{ color: 'var(--dim)' }}>Olex AI needs a free Gemini API key from Google AI Studio (no card). Add it to Vercel and to .env.local as GEMINI_API_KEY, then run npm run assistant:check.</p></div></>)
  async function send(e) {
    e.preventDefault(); const t = text.trim(); if (!t || busy) return
    const temp = { id: 'me' + Date.now(), role: 'you', text: t }
    setMsgs((m) => [...m, temp]); setText(''); setBusy('Thinking\u2026')
    const r = await call({ action: 'message', chatId, text: t }); setBusy('')
    if (r.error) { setMsgs((m) => m.filter((x) => x !== temp)); setText(t); toast(r.error); return }
    setChatId(r.chatId); setMsgs((m) => [...m.filter((x) => x !== temp), ...r.messages])
    const c = await call({ action: 'chats' }); if (c.chats) setChatList(c.chats)
  }
  async function openChat(id) { setShowChats(false); const r = await call({ action: 'chat', chatId: id }); if (r.error) { toast(r.error); return } setChatId(id); setMsgs(r.messages) }
  function newChat() { setShowChats(false); setChatId(null); setMsgs([]) }
  async function removeChat(id) {
    if (!window.confirm('Delete this chat? This can\u2019t be undone.')) return
    const r = await call({ action: 'delete-chat', chatId: id }); if (r.error) { toast(r.error); return }
    setChatList((l) => l.filter((c) => c.id !== id)); if (id === chatId) newChat(); toast('Chat deleted.')
  }
  async function decide(m, yes) {
    if (busy) return
    setMsgs((all) => all.map((x) => (x.id === m.id ? { ...x, action_state: yes ? 'running' : 'cancelled' } : x)))
    if (yes) setBusy(m.action && ['write', 'revise', 'research'].includes(m.action.type) ? 'Working on it. Researching and writing can take a minute or two\u2026' : 'Working on it\u2026')
    const r = await call({ action: yes ? 'confirm' : 'cancel', messageId: m.id }); setBusy('')
    if (r.error) { toast(r.error); const c = await call({ action: 'chat', chatId }); if (c.messages) setMsgs(c.messages); return }
    setMsgs((all) => [...all.map((x) => (x.id === m.id ? { ...x, action_state: r.state } : x)), ...(r.message ? [r.message] : [])]); router.refresh()
  }

  async function write(id) {
    if (busy) return; setBusy('Reading the sources and writing. This can take a minute or two\u2026')
    const r = await call({ action: 'write', researchId: id }); setBusy('')
    if (r.error) { toast(r.error); return }
    toast('Draft ready.'); router.push('/admin/blog?open=' + r.id)
  }
  async function refresh() { if (busy) return; setBusy('Checking the news and what people are searching for\u2026'); const r = await call({ action: 'research' }); setBusy(''); if (r.error) toast(r.error); else { toast(r.topics.length === 1 ? '1 topic found.' : `${r.topics.length} topics found.`); router.refresh() } }
  const tabs = [['chat', 'Chat'], ['research', 'Today\u2019s research'], ['plan', 'Plan'], ['settings', 'Settings']]
  return (<>
    <div className="top"><h1 className="d">Olex AI</h1>{modeLine}</div>
    <div className="seg" role="group" aria-label="Show">{tabs.map(([k, l]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>
    {busy ? <p className="read-only" role="status">{busy}</p> : null}
    {tab === 'chat' ? (<>
      <div className="chatbar">
        <button type="button" className="chatpick" onClick={() => setShowChats(true)} aria-label="Your chats"><span>{chatId ? (chatList.find((c) => c.id === chatId) || {}).title || 'Chat' : 'New chat'}</span><b>Chats</b></button>
        <button type="button" className="btn btn-line" onClick={newChat} disabled={!chatId && !msgs.length}>New chat</button>
      </div>
      <div className="chat">{msgs.length ? msgs.map((m) => m.role === 'you' ? <div key={m.id} className="msg me">{m.text}</div>
        : <div key={m.id} className="msg ai"><div className="who-ai">Olex AI</div><Markdown text={m.text} />
            {m.action ? <div className={'actcard ' + (m.action_state || '')}>
              <p className="actlabel">{m.action.label}</p>
              {m.action_state === 'proposed' ? <div className="acts"><button type="button" className="btn btn-green" disabled={!!busy} onClick={() => decide(m, true)}>Do it</button><button type="button" className="btn btn-line" disabled={!!busy} onClick={() => decide(m, false)}>Cancel</button></div>
                : <p className="actstate">{{ running: 'Working on it\u2026', done: 'Done', cancelled: 'Cancelled', failed: 'Didn\u2019t work' }[m.action_state] || ''}</p>}
            </div> : null}
            {m.post_id ? <a className="draftcard" href={'/admin/blog?open=' + m.post_id} style={{ textDecoration: 'none', color: 'inherit' }}><b>Open the draft</b><span>Read it, check the flagged claims, then publish or ask for changes.</span></a> : null}</div>)
        : <div className="empty">Ask me anything: questions about your business, a quick explanation, a plan, a price, some code. I can also find topics, write and revise articles, draft a Portfolio project or change what readers see. I always ask before I change anything.</div>}
        {busy ? <div className="msg ai typing" role="status"><span /><span /><span /></div> : null}<div ref={end} /></div>
      <form className="compose" onSubmit={send}><textarea className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} placeholder="Ask anything, or ask me to do something…" aria-label="Message Olex AI" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(e) }} /><button className="btn btn-green" type="submit" disabled={!!busy}>Send</button></form>
      <p className="note">It knows your site’s numbers, articles, projects and reviews. Nothing changes until you tap Do it. On Google’s free plan, messages may be used to improve Google’s products, so keep confidential client details out of chats.</p>
      {showChats ? <Sheet title="Your chats" onClose={() => setShowChats(false)}>
        <button type="button" className="btn btn-green btn-wide" onClick={newChat} style={{ marginBottom: 14 }}>New chat</button>
        {chatList.length ? <ul className="rows">{chatList.map((c) => <li key={c.id} className="row">
          <button type="button" className="chatrow" onClick={() => openChat(c.id)} aria-current={c.id === chatId ? 'true' : undefined}><span className="row-t">{c.title}</span><span className="row-s">{day(c.updated_at)}</span></button>
          <button type="button" className="btn btn-line" aria-label={'Delete ' + c.title} onClick={() => removeChat(c.id)}>Delete</button></li>)}</ul>
          : <div className="empty">No chats yet.</div>}
      </Sheet> : null}
    </>) : tab === 'research' ? (<>
      <p className="note" style={{ marginTop: 0 }}>Topics backed by real Google searches, with articles to learn from. {settings.last_run ? 'Last checked ' + day(settings.last_run) + '.' : ''} <button className="btn btn-line" style={{ padding: '6px 12px', fontSize: 13 }} onClick={refresh} disabled={!!busy}>Check now</button></p>
      {research.length ? research.map((t) => (<article className="trend" key={t.id}><h3>{t.topic}</h3>{t.why ? <p>{t.why}</p> : null}
        <div className="src" style={{ marginBottom: 6 }}>People search for:</div><div className="q">{t.searches.map((x) => <span key={x}>{x}</span>)}</div>
        <div className="src" style={{ marginBottom: 12 }}>{t.sources.length ? 'Sources: ' + t.sources.map((s) => s.from || new URL(s.url).hostname).join(', ') : 'No readable sources found'}</div>
        <button className="btn btn-line" onClick={() => write(t.id)} disabled={!!busy || !t.sources.length}>Write about this</button></article>))
        : <div className="empty">No topics yet. Tap “Check now”, or wait for tomorrow’s automatic run.</div>}
    </>) : tab === 'plan' ? (<>
      {pausedUntil ? <div className="share" style={{ marginBottom: 14 }}><b>Olex AI is paused until {day(pausedUntil)}.</b><p style={{ margin: '6px 0 0', color: 'var(--dim)' }}>No research, writing or Autopilot publishing until then. Posts you scheduled still go out. Ask in Chat to resume.</p></div> : null}
      <h2 className="section-t" style={{ marginTop: 0 }}>Scheduled</h2>
      {pending.length ? <ul className="rows plan">{pending.map((x) => <li key={x.id} className="row"><span className="ic">◷</span><span><span className="row-t">{x.label}</span><span className="row-s">{day(x.run_at)}, {new Date(x.run_at).getUTCHours() >= 12 ? 'afternoon (about 4 pm)' : 'morning (about 8 am)'}</span></span>
        <button type="button" className="btn btn-line" onClick={async () => { if (!window.confirm('Cancel this?')) return; const r = await call({ action: 'unschedule', id: x.id }); if (r.error) toast(r.error); else { toast('Cancelled.'); router.refresh() } }}>Cancel</button></li>)}</ul>
        : <div className="empty">Nothing scheduled. Ask in Chat, for example “publish my draft next Monday morning”.</div>}
      <h2 className="section-t">Drafts waiting for you</h2>
      {drafts.length ? <ul className="rows plan">{drafts.map((d) => <li key={d.id}><a className="row click" href={'/admin/blog?open=' + d.id} style={{ textDecoration: 'none', color: 'inherit' }}><span className="ic">✎</span><span><span className="row-t">{d.title}</span><span className="row-s">{(d.claims || []).length ? `${d.claims.length} claim${d.claims.length === 1 ? '' : 's'} to check` : 'Nothing flagged'}</span></span><span className="pill live">{d.auto_publish_at ? `Publishes in ${hoursLeft(d.auto_publish_at)} h` : 'Waiting for you'}</span></a></li>)}</ul> : <div className="empty">No drafts waiting.</div>}
      <h2 className="section-t">Up next</h2>
      {research.length ? <ul className="rows plan">{research.slice(0, 5).map((t) => <li key={t.id} className="row"><span className="ic">○</span><span><span className="row-t">{t.topic}</span><span className="row-s">{t.searches[0]}</span></span><span className="pill res">Researched</span></li>)}</ul> : <div className="empty">Research runs every morning.</div>}
      <h2 className="section-t">Published by Olex AI</h2>
      {published.length ? <ul className="rows plan">{published.map((p) => <li key={p.id}><a className="row click" href={'/insights/' + p.slug} target="_blank" rel="noopener" style={{ textDecoration: 'none', color: 'inherit' }}><span className="ic">✓</span><span><span className="row-t">{p.title}</span><span className="row-s">{day(p.published_on)}</span></span><span className="pill">View</span></a></li>)}</ul> : <div className="empty">Nothing yet.</div>}
      <p className="note">{settings.pace} article{settings.pace === 1 ? '' : 's'} a week at most, never two days in a row. {scheduled ? 'The daily run happens every morning.' : 'The daily run isn\u2019t scheduled yet: add CRON_SECRET in Vercel.'}</p>
    </>) : <Settings settings={settings} busy={busy} setBusy={setBusy} />}
  </>)
}

function Settings({ settings, busy, setBusy }) {
  const router = useRouter()
  const [mode, setMode] = useState(settings.mode), [pace, setPace] = useState(settings.pace), [topics, setTopics] = useState(settings.topics), [t, setT] = useState('')
  const [socials, setSocials] = useState({ linkedin: '', x: '', facebook: '', ...settings.socials }), [err, setErr] = useState('')
  async function save() { setErr(''); const r = await call({ action: 'settings', mode, pace, topics, socials }); if (r.error) setErr(r.error); else { toast('Settings saved.'); router.refresh() } }
  async function runNow() { if (busy) return; setBusy('Running today\u2019s work: research, then a draft if your pace allows\u2026'); const r = await call({ action: 'run' }); setBusy(''); if (r.error) toast(r.error); else { toast(r.drafted ? 'A new draft is ready.' : 'Done. Nothing new was due today.'); router.refresh() } }
  const add = () => { const x = t.trim(); if (x && !topics.includes(x) && topics.length < 8) setTopics([...topics, x]); setT('') }
  return (<>
    <h2 className="section-t" style={{ marginTop: 0 }}>How it publishes</h2>
    <div className="radio">
      <label><input type="radio" name="mode" checked={mode === 'approval'} onChange={() => setMode('approval')} /><span><b>Drafts wait for me</b><span>You read, edit and publish. Recommended while you get to know its writing.</span></span></label>
      <label><input type="radio" name="mode" checked={mode === 'autopilot'} onChange={() => setMode('autopilot')} /><span><b>Autopilot, with 24 hours for you</b><span>Each draft waits 24 hours for your review. If you don’t review it in time, Olex AI removes anything it couldn’t confirm, re-checks everything (all checks, working links, originality), then publishes and tells you. You can unpublish with one tap.</span></span></label></div>
    <h2 className="section-t">Pace</h2><div className="seg" role="group" aria-label="Articles a week">{[1, 2, 3].map((n) => <button key={n} aria-pressed={pace === n} onClick={() => setPace(n)}>{n} a week</button>)}</div>
    <h2 className="section-t">Topics it researches</h2>
    <div className="chips">{topics.map((x) => <span className="chip" key={x}>{x}<button aria-label={'Remove ' + x} onClick={() => setTopics(topics.filter((y) => y !== x))}>&times;</button></span>)}</div>
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><input className="input" value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} placeholder="For example: websites for restaurants" maxLength={60} /><button className="btn btn-line" onClick={add}>Add</button></div>
    <h2 className="section-t">Links at the end of every article</h2>
    {[['linkedin', 'LinkedIn'], ['x', 'X (Twitter)'], ['facebook', 'Facebook']].map(([k, l]) => <div className="field" key={k}><label htmlFor={'so' + k}>{l}</label><input className="input" id={'so' + k} value={socials[k] || ''} onChange={(e) => setSocials({ ...socials, [k]: e.target.value })} inputMode="url" /></div>)}
    <Notifications />
    <h2 className="section-t">Rules it always follows</h2>
    <ul className="rules"><li>Only writes about what real people are searching for, and saves that evidence with the article.</li><li>Researches several sources before writing, every time.</li><li>Writes in its own words. Never copies; quotes at most a sentence, with credit.</li><li>Ends every article with its sources.</li><li>Flags any figure or claim it can’t confirm, for you to check.</li><li>Never invents clients, results or testimonials.</li><li>Links to your pages only where it genuinely helps the reader.</li><li>Never publishes more than your chosen pace.</li></ul>
    {err ? <p className="err" role="alert">{err}</p> : null}
    <p style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}><button className="btn btn-green" onClick={save}>Save settings</button><button className="btn btn-line" onClick={runNow} disabled={!!busy}>Run today’s work now</button></p>
    <p className="note">Model: {settings.model || 'picked on first use'}.</p>
  </>)
}
