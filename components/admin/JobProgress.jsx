'use client'
// Live progress for long YouTube jobs: an animated bar, each stage as it happens, an honest countdown, the server's
// download speed and a heartbeat. Reads /admin/api/youtube?progress=… once a second while something is running,
// and also notices a job that is already running when the page opens (for example the daily search).
import { useEffect, useRef, useState } from 'react'

const fmtTime = (s) => { s = Math.max(0, Math.round(s)); return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's' }
const fmtRate = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB/s' : b >= 1024 ? Math.round(b / 1024) + ' KB/s' : b > 0 ? b + ' B/s' : '–')
const fmtBytes = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB')

export default function JobProgress({ kind, title, watch = false, onDone }) {
  const [p, setP] = useState(null), [now, setNow] = useState(Date.now()), [net, setNet] = useState('ok')
  const got = useRef(0), was = useRef(false), started = useRef(null), since0 = useRef(0)
  useEffect(() => { if (watch) since0.current = Date.now() }, [watch])
  useEffect(() => {
    let stop = false, timer
    async function poll() {
      try {
        const t0 = Date.now()
        const r = await fetch('/admin/api/youtube?progress=' + kind, { credentials: 'same-origin', cache: 'no-store' })
        if (r.status === 401) { window.location.assign('/admin/login'); return }
        const j = await r.json(); if (stop) return
        got.current = Date.now(); setNet(Date.now() - t0 > 3000 ? 'slow' : 'ok')
        const s = j.progress
        const running = s && !s.finished && !s.stale
        const current = s && s.started >= since0.current - 5000                // never show last time's finished run as if it were this one
        if (s && (running || ((watch || was.current) && current))) { setP({ ...s, at: Date.now() }); if (running) { was.current = true; started.current = started.current || s.started } }
        if (s && s.finished && was.current && started.current === s.started) { was.current = false; started.current = null; onDone && onDone(s); if (!s.error) setTimeout(() => { if (!stop) setP(null) }, 7000) }
        timer = setTimeout(poll, running || watch ? 1000 : 8000)
      } catch { if (!stop) { setNet('lost'); timer = setTimeout(poll, 2000) } }
    }
    poll()
    const tick = setInterval(() => setNow(Date.now()), 250)
    return () => { stop = true; clearTimeout(timer); clearInterval(tick) }
  }, [kind, watch])   // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return watch ? <div style={box} role="status" aria-live="polite"><b>{title}</b><span style={{ ...dimS, marginLeft: 8 }}>starting…</span><Bar pct={2} live /></div> : null
  const since = (now - p.at) / 1000
  const elapsed = p.finished ? p.elapsed : p.elapsed + since
  const left = p.finished ? 0 : Math.max(0, (p.eta || 0) - since)
  const pct = p.finished ? 100 : Math.min(99, (elapsed / Math.max(1, elapsed + left)) * 100)
  const quiet = (p.updatedAgo || 0) + since                               // seconds since the server last reported
  const beat = net === 'lost' ? ['#ff8f8f', 'Your connection dropped; reconnecting…'] : p.stale ? ['#ff8f8f', 'This job stopped unexpectedly (the server’s time limit). It will be retried automatically.']
    : p.finished ? (p.error ? ['#ff8f8f', 'Stopped: ' + p.error] : ['var(--green)', 'Done in ' + fmtTime(p.elapsed)])
    : quiet > 20 ? ['#ffd166', `Still on this step (no change for ${Math.round(quiet)}s): an AI or a slow site is taking its time.`]
    : net === 'slow' ? ['#ffd166', 'Live, but your connection is slow']
    : ['var(--green)', `Live · updated ${quiet < 1 ? 'just now' : quiet.toFixed(1) + 's ago'}`]
  return (<div style={box} role="status" aria-live="polite" aria-label={title}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
      <b style={{ fontSize: 15 }}>{p.finished ? (p.error ? title + ': stopped' : title + ': done') : title}</b>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>{fmtTime(elapsed)}{p.finished ? '' : <span style={dimS}> · about {fmtTime(left)} left</span>}</span>
    </div>
    <Bar pct={pct} live={!p.finished} bad={!!p.error || p.stale} />
    <ol style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'grid', gap: 5, fontSize: 13.5 }}>
      {p.stages.map((s) => { const cur = s.key === p.stage, done = s.secs != null
        return <li key={s.key} style={{ display: 'grid', gridTemplateColumns: '18px 1fr auto', gap: 8, alignItems: 'baseline', color: cur ? 'inherit' : done ? 'var(--dim)' : 'rgba(242,239,233,.38)' }}>
          <span aria-hidden="true" style={{ color: s.failed ? '#ff8f8f' : done && !s.skipped ? 'var(--green)' : 'inherit' }}>{s.failed ? '✗' : s.skipped ? '–' : done ? '✓' : cur ? <span className="jp-dot" /> : '○'}</span>
          <span>{s.label}{cur && p.total ? <b style={{ fontWeight: 600 }}> · {p.done} of {p.total}</b> : null}{cur && p.note ? <span style={dimS}> · {p.note}</span> : null}{s.skipped ? <span style={dimS}> · not needed</span> : null}{s.failed ? <span style={{ color: '#ff8f8f' }}> · stopped here</span> : null}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', ...dimS }}>{done && !s.skipped && !s.failed ? fmtTime(s.secs) : ''}</span>
        </li> })}
    </ol>
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, fontSize: 12.5, ...dimS }}>
      <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: beat[0], marginRight: 6, animation: p.finished ? 'none' : 'jpPulse 1.2s ease-in-out infinite' }} />{beat[1]}</span>
      {p.bytes ? <span title="How fast the server is downloading the websites and sources (not your own internet)">Server download: {p.finished ? fmtBytes(p.bytes) + ' in total' : fmtRate(p.rate) + ' · ' + fmtBytes(p.bytes) + ' so far'}</span> : null}
    </div>
    <style>{`@keyframes jpPulse{0%,100%{opacity:1}50%{opacity:.35}}@keyframes jpMove{from{background-position:0 0}to{background-position:28px 0}}
      .jp-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--green);animation:jpPulse 1s ease-in-out infinite}
      @media (prefers-reduced-motion: reduce){.jp-dot,.jp-bar{animation:none!important}}`}</style>
  </div>)
}
function Bar({ pct, live, bad }) {
  return <div aria-hidden="true" style={{ height: 10, borderRadius: 6, background: 'rgba(242,239,233,.08)', marginTop: 10, overflow: 'hidden' }}>
    <div className={live ? 'jp-bar' : ''} style={{ height: '100%', width: pct + '%', borderRadius: 6, transition: 'width .6s ease', background: bad ? '#ff8f8f' : 'var(--green)',
      backgroundImage: live ? 'repeating-linear-gradient(45deg, rgba(255,255,255,.18) 0 7px, transparent 7px 14px)' : 'none', backgroundSize: '28px 28px', animation: live ? 'jpMove .8s linear infinite' : 'none' }} />
  </div>
}
const box = { padding: '14px 16px', borderRadius: 18, background: 'var(--raise)', border: '1px solid rgba(143,227,106,.35)', marginBottom: 12 }
const dimS = { color: 'var(--dim)' }
