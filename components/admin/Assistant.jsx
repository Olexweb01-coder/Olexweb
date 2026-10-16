'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'
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

export default function AssistantBoard({ ready, scheduled, pending = [], pausedUntil = null, speed = null, providers = [], settings, research, drafts, published }) {
  const router = useRouter(), [tab, setTab] = useState('research'), [busy, setBusy] = useState('')
  const modeLine = <span className={'pill ' + (settings.mode === 'approval' ? 'live' : 'draft')}>{settings.mode === 'approval' ? 'Drafts wait for you' : `Autopilot, ${settings.pace} a week`}</span>
  if (!ready) return (<><div className="top"><h1 className="d">Olex Assistant</h1>{modeLine}</div>
    <div className="share"><b className="d" style={{ fontSize: 20, fontWeight: 700, fontStretch: '90%' }}>One step to switch it on.</b>
      <p style={{ color: 'var(--dim)' }}>Olex AI needs at least one free AI key, for example GEMINI_API_KEY from Google AI Studio or GROQ_API_KEY from Groq (no card). Add it to Vercel and to .env.local.</p></div></>)
  async function write(id) {
    if (busy) return; setBusy('Reading the sources and writing. This can take a minute or two\u2026')
    const r = await call({ action: 'write', researchId: id }); setBusy('')
    if (r.error) { toast(r.error); return }
    toast('Draft ready.'); router.push('/admin/blog?open=' + r.id)
  }
  async function refresh() { if (busy) return; setBusy('Checking the news and what people are searching for\u2026'); const r = await call({ action: 'research' }); setBusy(''); if (r.error) toast(r.error); else { toast(r.topics.length === 1 ? '1 topic found.' : `${r.topics.length} topics found.`); router.refresh() } }
  const tabs = [['research', 'Today\u2019s research'], ['plan', 'Plan'], ['settings', 'How it works']]
  return (<>
    <div className="top"><h1 className="d">Olex Assistant</h1>{modeLine}</div>
    <p className="note" style={{ marginTop: -14, marginBottom: 18 }}>Research, the publishing plan and how Olex AI writes for Olex Blog. To ask it anything, <a href="/admin" className="inline-link">open a chat</a>.</p>
    <div className="seg" role="group" aria-label="Show">{tabs.map(([k, l]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>
    {busy ? <p className="read-only" role="status">{busy}</p> : null}
    {tab === 'research' ? (<>
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
    </>) : <Settings settings={settings} busy={busy} setBusy={setBusy} speed={speed} providers={providers} />}
  </>)
}

function Settings({ settings, busy, setBusy, speed, providers }) {
  const router = useRouter()
  const [mode, setMode] = useState(settings.mode), [pace, setPace] = useState(settings.pace), [hours, setHours] = useState(settings.review_hours || 24), [topics, setTopics] = useState(settings.topics), [t, setT] = useState('')
  const [socials, setSocials] = useState({ linkedin: '', x: '', facebook: '', ...settings.socials }), [err, setErr] = useState('')
  async function save() { setErr(''); const r = await call({ action: 'settings', mode, pace, hours, topics, socials }); if (r.error) setErr(r.error); else { toast('Settings saved.'); router.refresh() } }
  async function runNow() { if (busy) return; setBusy('Running today\u2019s work: research, then a draft if your pace allows\u2026'); const r = await call({ action: 'run' }); setBusy(''); if (r.error) toast(r.error); else { toast(r.drafted ? 'A new draft is ready.' : 'Done. Nothing new was due today.'); router.refresh() } }
  const add = () => { const x = t.trim(); if (x && !topics.includes(x) && topics.length < 8) setTopics([...topics, x]); setT('') }
  return (<>
    <h2 className="section-t" style={{ marginTop: 0 }}>How it publishes</h2>
    <div className="radio">
      <label><input type="radio" name="mode" checked={mode === 'approval'} onChange={() => setMode('approval')} /><span><b>Drafts wait for me</b><span>You read, edit and publish. Recommended while you get to know its writing.</span></span></label>
      <label><input type="radio" name="mode" checked={mode === 'autopilot'} onChange={() => setMode('autopilot')} /><span><b>Autopilot, with {hours} hours for you</b><span>Each draft waits {hours} hours for your review. About an hour before, you get a notification. If you don’t review it in time, Olex AI removes anything it couldn’t confirm, re-checks everything and publishes only if every check passes; otherwise it holds it back and tells you.</span></span></label></div>
    {mode === 'autopilot' ? <><h2 className="section-t">Review window</h2>
      <div className="seg" role="group" aria-label="Hours before a draft publishes">{[7, 12, 24].map((h) => <button key={h} aria-pressed={hours === h} onClick={() => setHours(h)}>{h} hours</button>)}</div>
      <p className="note">You can also tell Olex AI in chat: “hold this draft”, “give it 12 more hours” or “publish it now”.</p></> : null}
    <h2 className="section-t">Pace</h2><div className="seg" role="group" aria-label="Articles a week">{[1, 2, 3].map((n) => <button key={n} aria-pressed={pace === n} onClick={() => setPace(n)}>{n} a week</button>)}</div>
    <h2 className="section-t">Topics it researches</h2>
    <div className="chips">{topics.map((x) => <span className="chip" key={x}>{x}<button aria-label={'Remove ' + x} onClick={() => setTopics(topics.filter((y) => y !== x))}>&times;</button></span>)}</div>
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><input className="input" value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} placeholder="For example: websites for restaurants" maxLength={60} /><button className="btn btn-line" onClick={add}>Add</button></div>
    <h2 className="section-t">Links at the end of every article</h2>
    {[['linkedin', 'LinkedIn'], ['x', 'X (Twitter)'], ['facebook', 'Facebook']].map(([k, l]) => <div className="field" key={k}><label htmlFor={'so' + k}>{l}</label><input className="input" id={'so' + k} value={socials[k] || ''} onChange={(e) => setSocials({ ...socials, [k]: e.target.value })} inputMode="url" /></div>)}
    <Notifications />
    {speed ? <section aria-labelledby="spT"><h2 className="section-t" id="spT">Chat speed</h2>
      {speed.replies ? <div className="share">
        <p style={{ margin: 0 }}>Over your last {speed.replies} replies, the first words usually arrived after <b>{speed.medianFirst != null ? (speed.medianFirst / 1000).toFixed(1) + ' seconds' : 'no answer'}</b>.{speed.shares && speed.shares.length ? ' Answered by ' + speed.shares.map(([k, n]) => `${k} ${n}%`).join(', ') + '.' : ''}{speed.failed ? ` ${speed.failed} couldn’t be answered.` : ''}</p>
        {speed.slowest.length ? <p style={{ margin: '10px 0 0', color: 'var(--dim)', fontSize: 14 }}>Slowest: {speed.slowest.map((x) => `${(x.ms / 1000).toFixed(1)} s (${x.by || 'unknown'})`).join(', ')}.</p> : null}
      </div> : <p className="note">No replies measured yet. Ask Olex AI something in Chat.</p>}</section> : null}
    <Providers list={providers} />
    <h2 className="section-t">Rules it always follows</h2>
    <ul className="rules"><li>Only writes about what real people are searching for, and saves that evidence with the article.</li><li>Researches several sources before writing, every time.</li><li>Writes in its own words. Never copies; quotes at most a sentence, with credit.</li><li>Ends every article with its sources.</li><li>Flags any figure or claim it can’t confirm, for you to check.</li><li>Never invents clients, results or testimonials.</li><li>Links to your pages only where it genuinely helps the reader.</li><li>Never publishes more than your chosen pace.</li></ul>
    {err ? <p className="err" role="alert">{err}</p> : null}
    <p style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}><button className="btn btn-green" onClick={save}>Save settings</button><button className="btn btn-line" onClick={runNow} disabled={!!busy}>Run today’s work now</button></p>
    <p className="note">Model: {settings.model || 'picked on first use'}.</p>
  </>)
}

const STATE = { ready: ['live', 'Ready'], 'not used yet': ['res', 'Connected'], resting: ['draft', 'Resting'], 'no key': ['', 'No key'], retired: ['', 'Shut down'] }
function Providers({ list }) {
  if (!list.length) return null
  const on = list.filter((p) => p.key).length
  return (<section aria-labelledby="provT"><h2 className="section-t" id="provT">AI providers</h2>
    <p className="note" style={{ marginTop: 0 }}>{on} of {list.length} connected. Olex AI sends each message to the fastest one that suits it; if one is busy or at its free limit, it rests and the next one answers.</p>
    <ul className="rows">{list.map((p) => <li key={p.id} className="row prov">
      <span className={'prov-dot ' + p.state.replace(/ /g, '-')} aria-hidden="true" />
      <span><span className="row-t">{p.label}</span><span className="row-s">{p.state === 'retired' ? 'GitHub shut this service down in July 2026. You can delete GITHUB_MODELS_TOKEN.' : !p.key ? `Add ${p.env} to switch it on` : p.state === 'resting' ? `Resting until ${new Date(p.restUntil).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })}${p.lastError ? ': ' + p.lastError : ''}` : p.firstMs ? `First words in about ${(p.firstMs / 1000).toFixed(1)} s${p.model ? ', ' + p.model : ''}. Answered ${p.wins} time${p.wins === 1 ? '' : 's'}` : 'Ready for its first message'}</span></span>
      <span className={'pill ' + STATE[p.state][0]}>{STATE[p.state][1]}</span></li>)}</ul></section>)
}
