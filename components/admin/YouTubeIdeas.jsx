'use client'
// YouTube → Ideas: goldmine websites, tools and updates, checked live and scored. Pick the ones worth making.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'
import JobProgress from './JobProgress'

const card = { padding: 18, borderRadius: 20, background: 'var(--raise)', border: '1px solid var(--line)' }
const dim = { color: 'var(--dim)' }
const fmt = (n) => Number(n || 0).toLocaleString('en-GB')
const LABEL = { value: 'Real value', wow: 'Instant wow', reach: 'Who can use it', free: 'Free to try', demo: 'Easy to show', fresh: 'Fresh on YouTube' }
const when = (d) => { if (!d) return 'never'; const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 2 ? 'just now' : m < 60 ? m + ' minutes ago' : m < 1440 ? Math.round(m / 60) + ' hours ago' : new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }
const tone = (n) => (n >= 75 ? 'var(--green)' : n >= 60 ? '#ffd166' : 'rgba(242,239,233,.55)')

export function YouTubeTabs({ current }) {
  return (<div className="seg" role="tablist" aria-label="YouTube" style={{ marginBottom: 14 }}>
    <a href="/admin/youtube" role="tab" aria-selected={current === 'analytics'} aria-pressed={current === 'analytics'} className="segl">Analytics</a>
    <a href="/admin/youtube?view=ideas" role="tab" aria-selected={current === 'ideas'} aria-pressed={current === 'ideas'} className="segl">Ideas</a>
    <a href="/admin/youtube?view=scripts" role="tab" aria-selected={current === 'scripts'} aria-pressed={current === 'scripts'} className="segl">Scripts</a>
  </div>)
}

function coverageText(c) {
  if (!c) return 'Not checked on YouTube yet.'
  if (!c.videos) return 'Nobody on YouTube covered this in the last 6 months.'
  return `${c.videos} video${c.videos === 1 ? '' : 's'} in the last 6 months${c.big ? `, ${c.big} with 50,000+ views` : ', none big'}. Biggest: ${fmt(c.top)} views${c.topChannel ? ' (' + c.topChannel + ')' : ''}.`
}

export default function YouTubeIdeas({ data }) {
  const router = useRouter(), d = data
  const [busy, setBusy] = useState(null), [err, setErr] = useState('')
  async function post(body, done) {
    setBusy(body.action === 'decide' ? body.id : 'find'); setErr('')
    try {
      const r = await fetch('/admin/api/youtube', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({}))
      if (r.status === 401) { window.location.assign('/admin/login'); return }
      if (!r.ok) setErr(j.error || 'Something went wrong. Try again.'); else { done(j); router.refresh() }
    } catch { setErr('No connection. Try again.') } finally { setBusy(null) }
  }
  const find = () => post({ action: 'find-ideas' }, (j) => toast(j.saved ? `${j.saved} new idea${j.saved === 1 ? '' : 's'} added (${j.loaded} sites checked live).` : `Checked ${j.loaded} live sites; none beat the bar this time.`))
  const decide = (id, status, name) => post({ action: 'decide', id, status }, () => toast(status === 'picked' ? `“${name}” is picked for a video.` : status === 'skipped' ? `“${name}” skipped.` : `“${name}” is back in New.`))
  const rep = d.run && d.run.report, c = d.counts || {}
  return (<>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
      <div className="seg" role="group" aria-label="Show" style={{ margin: 0, maxWidth: '100%' }}>
        {[['new', 'New'], ['picked', 'Picked'], ['skipped', 'Skipped']].map(([k, l]) => <a key={k} href={'/admin/youtube?view=ideas' + (k === 'new' ? '' : '&status=' + k)} aria-pressed={d.status === k} className="segl">{l}{c[k] ? ` (${c[k]})` : ''}</a>)}
      </div>
      <button className="btn btn-green" disabled={!!busy} onClick={find}>{busy === 'find' ? 'Searching…' : 'Find ideas now'}</button>
    </div>
    <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.55, ...dim }}>
      Found on Show HN, Hacker News, GitHub and from Olex AI’s evergreen picks. Every site is opened live and judged on what its page actually says; anything unsafe or thin is turned down. Searched automatically once a day.
      {d.run && d.run.last ? ` Last search ${when(rep && rep.at ? rep.at : d.run.last)}${rep && rep.loaded != null ? `: ${rep.found} found, ${rep.loaded} loaded, ${rep.saved} kept` : ''}${rep && rep.error ? ` (failed: ${rep.error})` : ''}.` : ''}
    </p>
    <JobProgress kind="ideas" title="Finding ideas" watch={busy === 'find'} onDone={() => router.refresh()} />
    {err ? <p className="err" role="alert" style={{ margin: '0 0 12px' }}>{err}</p> : null}
    {rep && rep.notes && rep.notes.length ? <p style={{ margin: '0 0 12px', fontSize: 12.5, ...dim }}>{rep.notes.join(' · ')}</p> : null}
    {d.ideas.length ? <div style={{ display: 'grid', gap: 12 }}>{d.ideas.map((it) => {
      const s = it.scores || {}
      let host = ''; try { host = new URL(it.url).host.replace(/^www\./, '') } catch {}
      return (<article key={it.id} style={{ ...card, display: 'grid', gap: 12 }} aria-labelledby={'idea' + it.id}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div aria-label={`Score ${it.score} out of 100`} style={{ flex: 'none', width: 62, height: 62, borderRadius: 18, display: 'grid', placeItems: 'center', border: '2px solid ' + tone(it.score), color: tone(it.score), fontFamily: 'var(--display)', fontWeight: 800, fontSize: 25 }}>{it.score}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 id={'idea' + it.id} style={{ margin: 0, fontFamily: 'var(--display)', fontWeight: 800, fontStretch: '88%', fontSize: 21, lineHeight: 1.15 }}>{it.name}</h2>
            <div style={{ fontSize: 13, marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', ...dim }}>
              <a href={it.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{host} ↗</a>
              {it.category ? <span className="pill res">{it.category}</span> : null}<span>{it.signal}</span>
            </div>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>{it.what}</p>
        {it.hook ? <p style={{ margin: 0, padding: '10px 14px', borderRadius: 14, background: 'rgba(143,227,106,.08)', border: '1px solid rgba(143,227,106,.25)', fontWeight: 700, fontSize: 15.5 }}>“{it.hook}” <span style={{ fontWeight: 500, fontSize: 12.5, ...dim }}>· opening line</span></p> : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '8px 18px' }}>
          {Object.keys(LABEL).map((k) => <div key={k} style={{ display: 'grid', gridTemplateColumns: '112px 1fr 22px', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <span style={dim}>{LABEL[k]}</span>
            <div style={{ height: 8, borderRadius: 5, background: 'rgba(242,239,233,.08)' }}><div style={{ height: 8, width: (s[k] || 0) * 10 + '%', borderRadius: 5, background: (s[k] || 0) >= 8 ? 'var(--green)' : (s[k] || 0) >= 6 ? '#ffd166' : 'rgba(242,239,233,.4)' }} /></div>
            <span style={{ textAlign: 'right', fontWeight: 600 }}>{s[k] ?? '–'}</span></div>)}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.6, display: 'grid', gap: 4 }}>
          <span><b>Why it’s worth it:</b> <span style={dim}>{it.why}</span></span>
          <span><b>YouTube:</b> <span style={dim}>{coverageText(it.coverage)}</span></span>
          {it.risks && !/^none\.?$/i.test(it.risks) ? <span><b>Check first:</b> <span style={dim}>{it.risks}</span></span> : null}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          {it.status !== 'picked' ? <button className="btn btn-green" disabled={!!busy} onClick={() => decide(it.id, 'picked', it.name)}>Make a video</button> : null}
          {it.status !== 'skipped' ? <button className="btn btn-line" disabled={!!busy} onClick={() => decide(it.id, 'skipped', it.name)}>Skip</button> : null}
          {it.status !== 'new' ? <button className="btn btn-line" disabled={!!busy} onClick={() => decide(it.id, 'new', it.name)}>Back to New</button> : null}
        </div>
      </article>)
    })}</div> : <section style={card}><p style={{ margin: 0, lineHeight: 1.6, ...dim }}>{d.status === 'new' ? 'No new ideas yet. Press Find ideas now, or wait for the daily search.' : d.status === 'picked' ? 'Nothing picked yet. Ideas you choose with “Make a video” go to the script writer (see Scripts).' : 'Nothing skipped.'}</p></section>}
    <p className="note">Score out of 100: real value {d.weights.value}, instant wow {d.weights.wow}, who can use it {d.weights.reach}, fresh on YouTube {d.weights.fresh}, free to try {d.weights.free}, easy to show {d.weights.demo}. Anything not safe to recommend, or without real value, never reaches this list.</p>
  </>)
}
