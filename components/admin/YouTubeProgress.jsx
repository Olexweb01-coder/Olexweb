'use client'
// YouTube → Progress: Needs you · In progress · Finished. Refreshes itself while anything is running.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'

const ago = (d) => { const m = Math.round((Date.now() - new Date(d).getTime()) / 60e3); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago' }
const left = (s) => s == null ? '' : s < 60 ? 'under a minute left' : `about ${Math.round(s / 60)} min left`
function pct(j) {
  if (!j || !j.stages || !j.stages.length) return 0
  const n = j.stages.length, doneN = j.stages.filter((s) => s.secs != null).length, part = j.total ? Math.min(1, j.done / j.total) : 0
  return Math.round(((doneN + (j.stage ? part : 0)) / n) * 100)
}

export default function YouTubeProgress({ data }) {
  const router = useRouter(), [tab, setTab] = useState(data.needs.length ? 'needs' : data.doing.length ? 'doing' : 'done'), [busy, setBusy] = useState('')
  useEffect(() => { if (!data.doing.length) return; const t = setInterval(() => router.refresh(), 4000); return () => clearInterval(t) }, [data.doing.length, router])
  async function retry(id) {
    setBusy('r' + id)
    try { const r = await fetch('/admin/api/youtube', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'send-to-factory', id }) })
      const j = await r.json().catch(() => ({})); if (r.status === 401) { window.location.assign('/admin/login'); return }
      if (!r.ok) toast(j.error || 'Couldn’t send it again.'); else { toast('Sent to the factory again.'); setTab('doing'); router.refresh() } }
    catch { toast('No connection. Try again.') } finally { setBusy('') }
  }
  const T = [['needs', 'Needs you', data.needs.length], ['doing', 'In progress', data.doing.length], ['done', 'Finished', data.done.length]]
  return (<>
    <div className="yp-tabs" role="tablist" aria-label="Progress">{T.map(([k, l, n]) => <button key={k} role="tab" aria-selected={tab === k} className={'yp-tab' + (tab === k ? ' yp-on' : '') + (k === 'needs' && n ? ' yp-alert' : '')} onClick={() => setTab(k)}>{l} <i>{n}</i></button>)}</div>

    {tab === 'needs' ? (data.needs.length ? data.needs.map((x, i) => <section key={i} className="yp-card yp-stuck">
      <div className="yp-top"><b>{x.title}</b><span>{x.waiting ? 'Waiting for your review' : x.at ? 'Stopped ' + ago(x.at) : ''}</span></div>
      <p className="yp-why">{x.why}</p>
      <div className="yp-acts">
        {x.action === 'retry' ? <button className="btn btn-green" disabled={!!busy} onClick={() => retry(x.id)}>{busy === 'r' + x.id ? 'Sending…' : 'Try again'}</button> : null}
        {x.action === 'review' ? <a className="btn btn-green" href="/admin/youtube?view=scripts">Review the script</a> : null}
        {x.action === 'ideas' ? <a className="btn btn-green" href="/admin/youtube?view=ideas">Go to Ideas</a> : null}
        {x.action === 'look' ? <a className="btn btn-line" href="/admin/youtube?view=scripts">Open Scripts</a> : null}
      </div></section>) : <p className="yp-empty">Nothing needs you right now. 🎉</p>) : null}

    {tab === 'doing' ? (data.doing.length ? data.doing.map((x, i) => { const j = x.job, p = pct(j); return <section key={i} className="yp-card">
      <div className="yp-top"><b>{x.title}</b><span>{x.what}{j && j.eta != null ? ' · ' + left(j.eta) : ''}</span></div>
      <div className="yp-bar" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}><i style={{ width: Math.max(4, p) + '%' }} /></div>
      {j && j.stages ? <div className="yp-steps">{j.stages.filter((s) => !s.skipped).map((s) => <span key={s.key} className={s.secs != null ? 'yp-ok' : s.key === j.stage ? 'yp-now' : ''}>{s.secs != null ? '✓ ' : ''}{s.label}{s.key === j.stage && j.total ? ` ${Math.min(100, Math.round((j.done / j.total) * 100))}%` : ''}</span>)}</div> : <p className="yp-why">Waiting for the factory to start…</p>}
      {j && j.note ? <p className="yp-note">{j.note}</p> : null}
    </section> }) : <p className="yp-empty">Nothing is being made right now.</p>) : null}

    {tab === 'done' ? (data.done.length ? <section className="yp-card">{data.done.map((x, i) => <a key={i} className="yp-done" href={x.link}>✓ {x.title}<span>{x.what} · {ago(x.at)}</span></a>)}</section> : <p className="yp-empty">Nothing finished in the last day yet.</p>) : null}

    <style dangerouslySetInnerHTML={{ __html: `
.yp-tabs{display:flex;gap:4px;flex-wrap:nowrap;overflow-x:auto;margin:0 0 16px;border-bottom:1px solid var(--line)}
.yp-tab{flex:none;padding:10px 14px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;color:var(--dim);font:700 14.5px inherit;cursor:pointer}.yp-tab i{font-style:normal;margin-left:4px;padding:1px 7px;border-radius:99px;background:var(--raise);font-size:12px}
.yp-tab.yp-on{color:var(--paper);border-color:var(--green)}.yp-tab.yp-alert i{background:rgba(255,138,138,.2);color:#ff8a8a}
.yp-card{display:grid;gap:10px;margin-bottom:10px;padding:18px;border-radius:20px;background:var(--raise);border:1px solid var(--line)}.yp-stuck{border-color:rgba(255,138,138,.45);background:rgba(255,138,138,.06)}
.yp-top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline}.yp-top b{font-size:16.5px}.yp-top span{font-size:13px;color:var(--dim)}
.yp-why{margin:0;font-size:14.5px;line-height:1.5}.yp-note{margin:0;font-size:13px;color:var(--dim)}.yp-acts{display:flex;gap:8px;flex-wrap:wrap}
.yp-bar{height:10px;border-radius:99px;background:rgba(242,239,233,.08);overflow:hidden}.yp-bar i{display:block;height:100%;border-radius:99px;background:var(--green);transition:width .6s}
.yp-steps{display:flex;gap:6px;flex-wrap:wrap}.yp-steps span{padding:5px 10px;border-radius:999px;font-size:12.5px;font-weight:700;border:1px solid var(--line);color:var(--dim)}.yp-steps .yp-ok{color:var(--green);border-color:rgba(143,227,106,.35)}.yp-steps .yp-now{color:#111;background:#ffc94d;border-color:#ffc94d}
.yp-done{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:12px 2px;border-bottom:1px solid var(--line);font-size:14.5px;text-decoration:none;color:var(--paper)}.yp-done:last-child{border:0}.yp-done span{color:var(--dim);font-size:13px}
.yp-empty{color:var(--dim);padding:20px 2px}
` }} />
  </>)
}
