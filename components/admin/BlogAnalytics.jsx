'use client'
// Blog → Analytics: real numbers for the owner, and the "What readers see" thresholds.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'

const fmt = (n) => Number(n || 0).toLocaleString('en-GB')
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
const card = { padding: 18, borderRadius: 20, background: 'var(--raise)', border: '1px solid var(--line)' }
const h2 = { margin: '0 0 14px', fontFamily: 'var(--display)', fontWeight: 800, fontStretch: '88%', fontSize: 21 }

export function BlogTabs({ current }) {
  return (<div className="seg" role="tablist" aria-label="Blog" style={{ marginBottom: 18 }}>
    <a href="/admin/blog" role="tab" aria-selected={current === 'articles'} aria-pressed={current === 'articles'} className="segl">Articles</a>
    <a href="/admin/blog?view=analytics" role="tab" aria-selected={current === 'analytics'} aria-pressed={current === 'analytics'} className="segl">Analytics</a>
  </div>)
}

export default function BlogAnalytics({ data, isOwner }) {
  const d = data, t = d.totals, max = Math.max(1, ...d.series.map((s) => s.views))
  const change = t.viewsBefore ? Math.round(((t.view - t.viewsBefore) / t.viewsBefore) * 100) : null
  const bars = (rows, color) => { const m = Math.max(1, ...rows.map((r) => r.n)); return rows.map((r) => (
    <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '96px minmax(0,1fr) 46px', gap: 10, alignItems: 'center', fontSize: 14 }}>
      <span>{label(r.key)}</span><div style={{ height: 10, borderRadius: 6, background: 'rgba(242,239,233,.08)' }}><div style={{ height: 10, width: (r.n / m) * 100 + '%', borderRadius: 6, background: color }} /></div>
      <span style={{ textAlign: 'right', color: 'var(--dim)' }}>{fmt(r.n)}</span></div>)) }
  const empty = !t.view
  return (<>
    <div className="top"><h1 className="d">Blog</h1></div>
    <BlogTabs current="analytics" />
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      <div className="seg" role="group" aria-label="Period" style={{ margin: 0 }}>
        {[7, 30, 90].map((n) => <a key={n} href={'/admin/blog?view=analytics&days=' + n} aria-pressed={d.days === n} className="segl">{n} days</a>)}
      </div>
      {empty ? <span className="pill draft">No readers counted yet</span> : null}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
      {[['Views', fmt(t.view), change === null ? 'First period with data' : `${change >= 0 ? change + '% more' : -change + '% fewer'} than the ${d.days} days before`],
        ['Readers', fmt(t.reader), 'Each reader once a day, privately'], ['Read most of it', fmt(t.read), pct(t.read, t.view) + '% of views'],
        ['Likes', fmt(t.likes), 'Kept after unlikes'], ['Saves', fmt(t.saves), 'Kept after unsaves'], ['Shares', fmt(t.share), d.shares[0] ? 'Mostly ' + label(d.shares[0].key) : 'None yet']].map(([k, v, note]) => (
        <div key={k} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--dim)' }}>{k}</span>
          <strong className="d" style={{ fontSize: 32, lineHeight: 1, fontWeight: 800 }}>{v}</strong><span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{note}</span></div>))}
    </div>
    <section style={{ ...card, marginTop: 12 }} aria-labelledby="anChart">
      <h2 id="anChart" style={h2}>Views per day</h2>
      <div aria-hidden="true" style={{ height: 150, display: 'flex', alignItems: 'flex-end', gap: d.days > 30 ? 1 : 3, borderBottom: '1px solid var(--line)' }}>
        {d.series.map((s) => <div key={s.day} title={`${s.day}: ${s.views} views`} style={{ flex: 1, height: Math.max(2, (s.views / max) * 150), borderRadius: '3px 3px 0 0', background: s.launched ? 'var(--green)' : 'rgba(242,239,233,.28)' }} />)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--dim)' }}><span>{short(d.series[0] && d.series[0].day)}</span><span>Green: a new article went live</span><span>{short(d.series[d.series.length - 1] && d.series[d.series.length - 1].day)}</span></div>
    </section>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 12 }}>
      <section style={card} aria-labelledby="anSrc"><h2 id="anSrc" style={h2}>Where readers come from</h2><div style={{ display: 'grid', gap: 11 }}>{d.sources.length ? bars(d.sources, 'var(--green)') : <p style={{ margin: 0, color: 'var(--dim)' }}>Nothing yet.</p>}</div></section>
      <section style={card} aria-labelledby="anSh"><h2 id="anSh" style={h2}>How readers share</h2><div style={{ display: 'grid', gap: 11 }}>{d.shares.length ? bars(d.shares, '#9ec5ff') : <p style={{ margin: 0, color: 'var(--dim)' }}>Nothing yet.</p>}</div></section>
    </div>
    <section style={{ ...card, marginTop: 12 }} aria-labelledby="anTop">
      <h2 id="anTop" style={h2}>Top articles</h2>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse', fontSize: 14 }}>
        <thead><tr style={{ textAlign: 'left', color: 'var(--dim)', fontSize: 12.5 }}>{['Article', 'Views', 'Read most of it', 'Likes', 'Saves', 'Shares', 'By'].map((h, i) => <th key={h} style={{ padding: '8px', paddingLeft: i ? 8 : 0, fontWeight: 600, textAlign: i && i < 6 ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
        <tbody>{d.top.map((r) => <tr key={r.slug} style={{ borderTop: '1px solid var(--line)' }}>
          <td style={{ padding: '12px 8px 12px 0', fontWeight: 600, maxWidth: 320 }}><a href={'/insights/' + r.slug} target="_blank" rel="noopener" style={{ color: 'inherit' }}>{r.title}</a></td>
          <td style={{ padding: 12, textAlign: 'right' }}>{fmt(r.views)}</td><td style={{ padding: 12, textAlign: 'right' }}>{pct(r.reads, r.views)}%</td>
          <td style={{ padding: 12, textAlign: 'right' }}>{fmt(r.likes_total)}</td><td style={{ padding: 12, textAlign: 'right' }}>{fmt(Math.max(0, r.saves))}</td><td style={{ padding: 12, textAlign: 'right' }}>{fmt(r.shares)}</td>
          <td style={{ padding: '12px 0 12px 8px' }}><span className={'pill ' + (r.origin === 'assistant' ? 'res' : 'live')}>{r.origin === 'assistant' ? 'Assistant' : 'You'}</span></td></tr>)}</tbody>
      </table></div>
    </section>
    <section style={{ ...card, marginTop: 12 }} aria-labelledby="anVs">
      <h2 id="anVs" style={h2}>Your articles and the assistant’s</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {[['Yours', d.you, 'rgba(143,227,106,.35)'], ['The assistant’s', d.assistant, 'rgba(158,197,255,.35)']].map(([k, s, c]) => (
          <div key={k} style={{ padding: 15, borderRadius: 15, border: '1px solid ' + c }}><b>{k} ({s.articles})</b>
            <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.55, color: 'var(--dim)' }}>{s.articles ? `${fmt(s.views)} views each on average. ${s.readRate}% read most of it. ${s.likes} likes each.` : 'No articles in this period yet.'}</p></div>))}
      </div>
    </section>
    {isOwner ? <Thresholds s={d.settings} shown={d.shown} live={d.live} /> : null}
    <p className="note">Counted without cookies or personal data; only daily totals are kept. Which Google searches found you comes from Google Search Console (free), which can be connected after launch.</p>
  </>)
}

function Thresholds({ s, shown, live }) {
  const router = useRouter()
  const [f, setF] = useState({ views_from: s.views_from, likes_from: s.likes_from, reading_from: s.reading_from, badges: s.badges, testimonials: s.testimonials }), [busy, setBusy] = useState(false), [err, setErr] = useState('')
  const num = (k) => (e) => setF({ ...f, [k]: e.target.value })
  async function save() {
    setBusy(true); setErr('')
    try {
      const r = await fetch('/admin/api/blog-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(f) })
      const j = await r.json().catch(() => ({}))
      if (r.status === 401) { window.location.assign('/admin/login'); return }
      if (!r.ok) setErr(j.error || 'Something went wrong. Try again.'); else { toast('Saved. Readers see the change within a minute.'); router.refresh() }
    } catch { setErr('No connection. Try again.') } finally { setBusy(false) }
  }
  const field = (k, label, unit, min) => (<label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 14, fontWeight: 600 }}>{label}
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input className="input" type="number" inputMode="numeric" min={min} value={f[k]} onChange={num(k)} style={{ width: 110 }} /><span style={{ fontWeight: 500, color: 'var(--dim)' }}>{unit}</span></span></label>)
  return (<section style={{ ...card, marginTop: 12, borderColor: 'rgba(143,227,106,.3)' }} aria-labelledby="anPub">
    <h2 id="anPub" style={{ ...h2, marginBottom: 6 }}>What readers see</h2>
    <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.55, color: 'var(--dim)' }}>Every number readers see is real. Small numbers stay hidden until they’re worth showing. Readers see “reads”: each reader once per article per day, so refreshing never raises it.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
      {field('views_from', 'Show reads from', 'reads', 0)}{field('likes_from', 'Show likes from', 'likes', 0)}{field('reading_from', 'Show “reading now” from', 'people', 2)}
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 22px', marginTop: 10 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontSize: 14.5 }}><input type="checkbox" checked={f.badges} onChange={(e) => setF({ ...f, badges: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--green)' }} />“Most read this week”, “Trending” and “New” badges</label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontSize: 14.5 }}><input type="checkbox" checked={f.testimonials} onChange={(e) => setF({ ...f, testimonials: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--green)' }} />A client testimonial on every article</label>
    </div>
    {err ? <p className="err" role="alert">{err}</p> : null}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 12, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
      <span style={{ fontSize: 13.5, color: 'var(--dim)' }}>Right now readers see counts on {shown} of your {live} article{live === 1 ? '' : 's'}.</span>
      <button className="btn btn-green" disabled={busy} onClick={save}>Save</button>
    </div>
  </section>)
}

const LABELS = { whatsapp: 'WhatsApp', linkedin: 'LinkedIn', facebook: 'Facebook', x: 'X', copy: 'Copy link', more: 'More apps' }
const label = (k) => LABELS[k] || k
const short = (day) => (day ? new Date(day + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')
