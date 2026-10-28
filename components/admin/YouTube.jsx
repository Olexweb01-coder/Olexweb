'use client'
// YouTube → Analytics: connect the channel once, then real numbers from YouTube, refreshed with the daily run.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'
import { YouTubeTabs } from './YouTubeIdeas'
import AutomationHead from './AutomationTabs'

const fmt = (n) => Number(n || 0).toLocaleString('en-GB')
const card = { padding: 18, borderRadius: 20, background: 'var(--raise)', border: '1px solid var(--line)' }
const h2 = { margin: '0 0 14px', fontFamily: 'var(--display)', fontWeight: 800, fontStretch: '88%', fontSize: 21 }
const dim = { color: 'var(--dim)' }
const short = (d) => (d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')
const when = (d) => { if (!d) return 'never'; const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 2 ? 'just now' : m < 60 ? m + ' minutes ago' : m < 1440 ? Math.round(m / 60) + ' hours ago' : short(d) }
const pctTxt = (p) => (p == null ? '–' : Math.round(p) + '%')
const hours = (min) => { const h = Number(min || 0) / 60; return h < 10 ? h.toFixed(1) : fmt(Math.round(h)) }

// What the way back from Google can say (?yt=…)
const NOTES = {
  connected: ['good', 'YouTube connected. Your numbers are below.'],
  denied: ['bad', 'You cancelled at Google, so nothing was connected.'],
  expired: ['bad', 'That sign-in ran out of time or was started somewhere else. Click Connect YouTube again, from olexweb.com.'],
  exchange: ['bad', 'Google didn’t accept the sign-in. Check that YT_CLIENT_ID and YT_CLIENT_SECRET in Vercel match the OAuth client, and that its redirect address is https://olexweb.com/admin/api/youtube/callback.'],
  no_refresh: ['bad', 'Google didn’t give lasting access. Remove “Olexweb” at myaccount.google.com/permissions, then connect again.'],
  scopes: ['bad', 'Some permissions were left unticked at Google. Connect again and leave every box ticked: the admin needs them to read your numbers and, later, to upload.'],
  no_channel: ['bad', 'That Google account has no YouTube channel. Connect again and choose the account that owns @olexweb.'],
  not_ready: ['bad', 'YT_CLIENT_ID and YT_CLIENT_SECRET aren’t set in Vercel yet.'],
  owner: ['bad', 'Only Olaitan can connect YouTube.'],
  google: ['bad', 'Google reported a problem. Try again in a minute.'],
  error: ['bad', 'Something went wrong. Try again.'],
}

export default function YouTube({ data, note }) {
  const router = useRouter(), d = data, a = d.account
  const [busy, setBusy] = useState(''), [sort, setSort] = useState('new'), [type, setType] = useState('all')
  const [msg, setMsg] = useState(NOTES[note] || null), [dis, setDis] = useState(false), [typed, setTyped] = useState('')
  useEffect(() => { if (note) window.history.replaceState(null, '', '/admin/youtube' + (d.days !== 28 ? '?days=' + d.days : '')) }, [note, d.days])

  async function act(action, extra = {}) {
    if (action === 'disconnect' && extra.confirm !== 'DISCONNECT') { setTyped(''); setDis(true); return }   // opens the type-to-confirm dialog
    setBusy(action); setMsg(null); setDis(false)
    try {
      const r = await fetch('/admin/api/youtube', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action, ...extra }) })
      const j = await r.json().catch(() => ({}))
      if (r.status === 401) { window.location.assign('/admin/login'); return }
      if (!r.ok) setMsg(['bad', j.error || 'Something went wrong. Try again.'])
      else { toast(action === 'sync' ? `Updated: ${j.videos} video${j.videos === 1 ? '' : 's'}, ${j.days} days of numbers.` : 'YouTube disconnected.'); router.refresh() }
    } catch { setMsg(['bad', 'No connection. Try again.']) } finally { setBusy('') }
  }

  const banner = msg ? <p role={msg[0] === 'bad' ? 'alert' : 'status'} style={{ ...card, margin: '0 0 14px', padding: '13px 16px', fontSize: 14.5, lineHeight: 1.55, borderColor: msg[0] === 'bad' ? 'rgba(255,107,107,.45)' : 'rgba(143,227,106,.45)' }}>{msg[1]}</p> : null

  if (!d.ready) return (<>
    <AutomationHead current="youtube" />{banner}
    <section style={card}><h2 style={h2}>Almost ready</h2><p style={{ margin: 0, lineHeight: 1.6, ...dim }}>Add <b>YT_CLIENT_ID</b> and <b>YT_CLIENT_SECRET</b> in Vercel (Settings → Environment Variables, Production), redeploy, and the Connect button appears here.</p></section>
  </>)

  const connect = (again) => (<section style={{ ...card, marginBottom: 12, borderColor: 'rgba(143,227,106,.35)' }} aria-labelledby="ytC">
    <h2 id="ytC" style={{ ...h2, marginBottom: 8 }}>{again ? 'Connect YouTube again' : 'Connect your channel'}</h2>
    <p style={{ margin: '0 0 6px', fontSize: 14.5, lineHeight: 1.6, ...dim }}>Google will ask you to choose an account: pick the one that owns the channel. Because this is your own private app, Google first shows “Google hasn’t verified this app”. Click <b>Advanced</b>, then <b>Go to Olexweb</b>, and leave every permission ticked.</p>
    <p style={{ margin: '0 0 14px', fontSize: 13.5, lineHeight: 1.55, ...dim }}>The admin can read your channel and its analytics, and upload the videos you approve. The sign-in is stored encrypted; Disconnect withdraws it at Google and deletes the channel data kept here. By connecting you agree to the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>, <a href="/privacy#youtube" target="_blank">Olexweb’s Privacy Policy</a> and the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.</p>
    <a className="btn btn-green" href="/admin/api/youtube/connect">Connect YouTube</a>
  </section>)

  if (!a || !a.channel_id) return (<><AutomationHead current="youtube" /><YouTubeTabs current="analytics" />{banner}{connect(false)}</>)

  const t = d.totals || {}, b = d.before || {}, series = d.series || [], max = Math.max(1, ...series.map((s) => s.views))
  const change = (now, then) => (then ? Math.round(((now - then) / then) * 100) : null)
  const ch = change(t.views, b.views)
  const vids = d.videos || [], growth = d.growth || {}
  const kinds = [['Shorts', vids.filter((v) => v.is_short)], ['Videos', vids.filter((v) => !v.is_short)]]
  const held = (list) => { const w = list.filter((v) => v.avg_view_pct != null && v.views > 0); const s = w.reduce((x, v) => x + v.views, 0); return s ? w.reduce((x, v) => x + v.avg_view_pct * v.views, 0) / s : null }
  let rows = vids.filter((v) => type === 'all' || (type === 'shorts' ? v.is_short : !v.is_short))
  rows = [...rows].sort(sort === 'views' ? (x, y) => y.views - x.views : sort === 'held' ? (x, y) => (y.avg_view_pct ?? -1) - (x.avg_view_pct ?? -1) : sort === 'moving' ? (x, y) => (growth[y.video_id] || 0) - (growth[x.video_id] || 0) : () => 0)

  const disDialog = dis ? <div role="dialog" aria-modal="true" aria-label="Disconnect YouTube" style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center', padding: 16 }}>
    <div style={{ width: 'min(94vw,480px)', padding: 22, borderRadius: 22, background: 'var(--raise)', border: '1px solid var(--line)' }}>
      <h3 style={{ margin: '0 0 8px' }}>Disconnect YouTube?</h3>
      <p style={{ margin: '0 0 8px', color: 'var(--dim)', lineHeight: 1.55 }}>This is a big step:</p>
      <ul style={{ margin: '0 0 12px', paddingLeft: 18, color: 'var(--dim)', lineHeight: 1.6, fontSize: 14.5 }}><li>Google access is removed for this admin</li><li>All YouTube numbers stored here are deleted (YouTube’s rules)</li><li>Uploads and the daily queue stop until you connect again</li></ul>
      <p style={{ margin: '0 0 6px', color: 'var(--dim)' }}>Your ideas, scripts and videos stay. Type <b style={{ color: 'var(--paper)' }}>DISCONNECT</b> to confirm.</p>
      <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus aria-label="Type DISCONNECT to confirm" autoComplete="off" />
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
        <button className="btn btn-line" onClick={() => setDis(false)}>Cancel</button>
        <button className="btn" style={{ background: '#ff8a8a', color: '#2a0000', opacity: typed === 'DISCONNECT' ? 1 : 0.35 }} disabled={typed !== 'DISCONNECT' || !!busy} onClick={() => act('disconnect', { confirm: 'DISCONNECT' })}>Disconnect</button>
      </div></div></div> : null
  return (<>{disDialog}
    <AutomationHead current="youtube" />
    <YouTubeTabs current="analytics" />
    {banner}
    {!d.connected ? connect(true) : null}
    <section style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 12 }} aria-label="Channel">
      {a.thumb ? <img src={a.thumb} alt="" width="52" height="52" style={{ borderRadius: '50%' }} /> : null}
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <b style={{ fontSize: 17 }}>{a.title}</b> <span style={dim}>{a.handle}</span>
        <div style={{ fontSize: 13.5, marginTop: 3, ...dim }}>{a.subscribers == null ? 'Subscriber count hidden' : fmt(a.subscribers) + ' subscribers'} · {fmt(a.views)} views all time · {fmt(a.videos)} uploads</div>
        <div style={{ fontSize: 12.5, marginTop: 3, ...dim }}>Updated {when(a.last_sync)}{a.last_error ? '' : ', and again with each daily run'}</div>
        {a.last_error ? <div role="alert" style={{ fontSize: 13, marginTop: 4, color: '#ff8f8f' }}>Last update failed: {a.last_error}</div> : null}
      </div>
      {d.connected ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-green" disabled={!!busy} onClick={() => act('sync')}>{busy === 'sync' ? 'Fetching…' : 'Fetch now'}</button>
        <button className="btn btn-line" disabled={!!busy} onClick={() => act('disconnect')}>{busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}</button>
      </div> : null}
    </section>

    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
      <div className="seg" role="group" aria-label="Period" style={{ margin: 0 }}>
        {[7, 28, 90].map((n) => <a key={n} href={'/admin/youtube?days=' + n} aria-pressed={d.days === n} className="segl">{n} days</a>)}
      </div>
      <span style={{ fontSize: 12.5, ...dim }}>YouTube’s numbers run about 2 days behind{d.lastDataDay ? ` · latest: ${short(d.lastDataDay)}` : ''}</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 42%), 1fr))', gap: 10 }}>
      {[['Views', fmt(t.views), ch === null ? (t.views ? 'First period with data' : 'No views counted yet') : `${ch >= 0 ? ch + '% more' : -ch + '% fewer'} than the ${d.days} days before`],
        ['Watch time', hours(t.minutes) + ' h', `${fmt(Math.round(t.minutes || 0))} minute${Math.round(t.minutes || 0) === 1 ? '' : 's'}`],
        ['Watched on average', pctTxt(t.avg_pct), 'Of each video, weighted by views'],
        ['Subscribers', (t.gained - t.lost >= 0 ? '+' : '') + fmt((t.gained || 0) - (t.lost || 0)), `${fmt(t.gained)} gained, ${fmt(t.lost)} lost`],
        ['Likes', fmt(Math.max(0, t.likes || 0)), b.likes != null ? `${fmt(Math.max(0, b.likes))} the period before` : ''],
        ['Shares', fmt(t.shares), 'People sending your videos on']].map(([k, v, n]) => (
        <div key={k} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ fontSize: 13.5, fontWeight: 600, ...dim }}>{k}</span>
          <strong className="d" style={{ fontSize: 32, lineHeight: 1, fontWeight: 800 }}>{v}</strong><span style={{ fontSize: 12.5, ...dim }}>{n}</span></div>))}
    </div>

    <section style={{ ...card, marginTop: 12 }} aria-labelledby="ytChart">
      <h2 id="ytChart" style={h2}>Views per day</h2>
      {series.length ? <>
        <div aria-hidden="true" style={{ height: 150, display: 'flex', alignItems: 'flex-end', gap: d.days > 30 ? 1 : 3, borderBottom: '1px solid var(--line)' }}>
          {series.map((s) => <div key={s.day} title={`${short(s.day)}: ${fmt(s.views)} views${s.subs_gained ? ', +' + s.subs_gained + ' subscribers' : ''}`} style={{ flex: 1, height: Math.max(2, (s.views / max) * 150), borderRadius: '3px 3px 0 0', background: s.subs_gained ? 'var(--green)' : 'rgba(242,239,233,.28)' }} />)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, ...dim }}><span>{short(series[0].day)}</span><span>Green: a day that brought subscribers</span><span>{short(series[series.length - 1].day)}</span></div>
      </> : <p style={{ margin: 0, ...dim }}>No daily numbers yet. They arrive with the next update.</p>}
    </section>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 12 }}>
      {kinds.map(([k, list]) => { const v = list.reduce((x, y) => x + y.views, 0); return (
        <section key={k} style={card} aria-label={k}><h2 style={{ ...h2, marginBottom: 8 }}>{k} <span style={{ fontSize: 15, fontWeight: 600, ...dim }}>({list.length})</span></h2>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, ...dim }}>{list.length ? <>{fmt(v)} views all time, {fmt(Math.round(v / list.length))} each on average. People watch {pctTxt(held(list))} of each one.</> : 'None yet.'}</p></section>) })}
    </div>

    <section style={{ ...card, marginTop: 12 }} aria-labelledby="ytVids">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 id="ytVids" style={{ ...h2, margin: 0 }}>Every upload</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minWidth: 0, maxWidth: '100%' }}>
          <div className="seg" role="group" aria-label="Type" style={{ margin: 0 }}>{[['all', 'All'], ['shorts', 'Shorts'], ['videos', 'Videos']].map(([k, l]) => <button key={k} type="button" className="segl" aria-pressed={type === k} onClick={() => setType(k)}>{l}</button>)}</div>
          <div className="seg" role="group" aria-label="Order" style={{ margin: 0, maxWidth: '100%' }}>{[['new', 'Newest'], ['views', 'Most viewed'], ['held', 'Best watched'], ['moving', 'Moving now']].map(([k, l]) => <button key={k} type="button" className="segl" aria-pressed={sort === k} onClick={() => setSort(k)}>{l}</button>)}</div>
        </div>
      </div>
      {rows.length ? <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: 14 }}>
        <thead><tr style={{ textAlign: 'left', fontSize: 12.5, ...dim }}>{['Upload', 'Views', 'Last day', 'Watched', 'Likes', 'Comments', 'Shares'].map((h, i) => <th key={h} style={{ padding: 8, paddingLeft: i ? 8 : 0, fontWeight: 600, textAlign: i ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((v) => { const g = growth[v.video_id]; return <tr key={v.video_id} style={{ borderTop: '1px solid var(--line)' }}>
          <td style={{ padding: '10px 8px 10px 0' }}><a href={(v.is_short ? 'https://youtube.com/shorts/' : 'https://youtu.be/') + v.video_id} target="_blank" rel="noopener" style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'inherit', textDecoration: 'none' }}>
            {v.thumb ? <img src={v.thumb} alt="" width="80" height="45" loading="lazy" style={{ borderRadius: 8, objectFit: 'cover', flex: 'none' }} /> : null}
            <span style={{ minWidth: 0 }}><b style={{ display: 'block', fontWeight: 600, lineHeight: 1.35 }}>{v.title}</b>
              <span style={{ fontSize: 12.5, ...dim }}><span className={'pill ' + (v.is_short ? 'res' : 'live')} style={{ marginRight: 6 }}>{v.is_short ? 'Short' : 'Video'}</span>{short(v.published_at)}{v.privacy && v.privacy !== 'public' ? ' · ' + v.privacy : ''}</span></span></a></td>
          <td style={{ padding: 10, textAlign: 'right', fontWeight: 600 }}>{fmt(v.views)}</td>
          <td style={{ padding: 10, textAlign: 'right', color: g > 0 ? 'var(--green)' : 'var(--dim)' }}>{g > 0 ? '+' + fmt(g) : '–'}</td>
          <td style={{ padding: 10, textAlign: 'right' }}>{pctTxt(v.avg_view_pct)}</td>
          <td style={{ padding: 10, textAlign: 'right' }}>{fmt(v.likes)}</td><td style={{ padding: 10, textAlign: 'right' }}>{fmt(v.comments)}</td>
          <td style={{ padding: '10px 0 10px 8px', textAlign: 'right' }}>{v.shares == null ? '–' : fmt(v.shares)}</td></tr> })}</tbody>
      </table></div> : <p style={{ margin: 0, ...dim }}>No uploads here yet.</p>}
    </section>
    <p className="note">Data from YouTube (the YouTube Data API and YouTube Analytics API), fetched with each daily run or when you press Fetch now, and kept only as long as YouTube’s rules allow. “Last day” compares today’s totals with yesterday’s, so it fills in after the second day. Shorts are uploads of 3 minutes or less.</p>
  </>)
}
