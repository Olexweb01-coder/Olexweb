'use client'
// Automation → Facebook: the Page, posting on/off, Reels a day and their own times, what's up next (from the shared library,
// not waiting for YouTube), the caption style, recent Reels and safety.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'
import { CSS as BASE } from './automationShared'

const NOTES = { connected: 'Facebook connected.', cancelled: 'Connecting was cancelled.', expired: 'That took too long. Try connecting again.', nopages: 'No Page found that this account can post to. Make sure you’re an admin of the Page and allowed it.', failed: 'Connecting didn’t work. Try again.', notready: 'Add META_APP_ID, META_APP_SECRET and META_CONFIG_ID in Vercel, then redeploy.' }
const DEF = { 1: ['20:00'], 2: ['13:00', '20:00'], 3: ['12:00', '16:00', '20:00'] }
const ago = (d) => { const m = Math.round((Date.now() - new Date(d).getTime()) / 60e3); if (m < 60) return Math.max(1, m) + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + ' h ago'; return h < 48 ? 'yesterday' : Math.round(h / 24) + ' days ago' }
const dayWord = (x) => x.when === 'today' ? 'Today' : x.when === 'tomorrow' ? 'Tomorrow' : new Date(x.day + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export default function AutomationFacebook({ data }) {
  const router = useRouter(), F = data, [busy, setBusy] = useState(''), [err, setErr] = useState(''), [note, setNote] = useState('')
  const [edit, setEdit] = useState(false), [per, setPer] = useState(F.perDay), [tt, setTt] = useState(F.times)
  useEffect(() => { const k = new URLSearchParams(window.location.search).get('fb'); if (k) setNote(NOTES[k] || '') }, [])
  useEffect(() => { setPer(F.perDay); setTt(F.times) }, [F.perDay, F.times])
  async function meta(body, ok) {
    setBusy(body.action); setErr('')
    try { const r = await fetch('/admin/api/meta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) }), j = await r.json().catch(() => ({}))
      if (r.status === 401) { window.location.assign('/admin/login'); return }
      if (!r.ok) { setErr(j.error || 'Something went wrong.'); return false } toast(ok); router.refresh(); return true }
    catch { setErr('No connection. Try again.'); return false } finally { setBusy('') }
  }
  function changePer(n) { setPer(n); setTt((t) => (t.length === n ? t : DEF[n])) }
  async function saveTimes() { if (await meta({ action: 'times', times: tt.slice(0, per) }, 'Reel times saved.')) setEdit(false) }
  const join = (t) => t.length === 1 ? <b>{t[0]}</b> : t.map((x, i) => <span key={x}>{i ? (i === t.length - 1 ? ' and ' : ', ') : ''}<b>{x}</b></span>)
  const Q = F.queue || { items: [], more: 0, waiting: 0 }

  if (!F.ready) return (<div className="au"><section className="au-box" aria-label="Facebook Reels"><h2>Facebook Reels</h2><p className="au-note">Add META_APP_ID, META_APP_SECRET and META_CONFIG_ID in Vercel, then redeploy, to connect your Page.</p></section><style dangerouslySetInnerHTML={{ __html: BASE + CSS }} /></div>)
  if (!F.pages.length) return (<div className="au"><section className="au-box" aria-label="Facebook Reels"><h2>Facebook Reels</h2>
    {note ? <p className="af-note">{note}</p> : null}
    <p className="au-note" style={{ marginBottom: 14 }}>Post your Shorts as Reels on your Page, on their own times, without waiting for YouTube. Each Reel carries its free guide link.</p>
    <a className="btn btn-green" href="/admin/api/meta/connect">Connect your Facebook Page</a></section><style dangerouslySetInnerHTML={{ __html: BASE + CSS }} /></div>)
  if (!F.page) return (<div className="au"><section className="au-box" aria-label="Facebook Reels"><h2>Which Page should Reels go to?</h2>
    {err ? <p className="af-err" role="alert">{err}</p> : null}
    <div className="af-row">{F.pages.map((p) => <button key={p.page_id} className="btn btn-line" disabled={!!busy} onClick={() => meta({ action: 'select', page: p.page_id }, 'Page chosen.')}>{p.name}</button>)}</div></section><style dangerouslySetInnerHTML={{ __html: BASE + CSS }} /></div>)

  return (<div className="au" aria-label="Facebook Reels">
    {note ? <p className="af-note">{note}</p> : null}
    {err ? <p className="af-err" role="alert">{err}</p> : null}
    {F.paused ? <section className="af-paused" role="status"><b>Posting is paused</b><span>Because {F.paused.reason}</span><button className="btn btn-green" disabled={!!busy} onClick={() => meta({ action: 'resume' }, 'Facebook posting resumed.')}>Resume</button></section> : null}

    <section className="au-box af-head">
      <div className="af-row">
        <b className="af-page">{F.page.name}</b><span className="au-pill au-on">Connected</span>
        <div className="af-seg" role="group" aria-label="Facebook posting">
          <button type="button" aria-pressed={F.enabled} disabled={!!busy} onClick={() => !F.enabled && meta({ action: 'enable', on: true }, 'Facebook posting is on.')}>Posting on</button>
          <button type="button" aria-pressed={!F.enabled} disabled={!!busy} onClick={() => F.enabled && meta({ action: 'enable', on: false }, 'Facebook posting is off.')}>Off</button>
        </div>
        <button className="au-more af-dis" disabled={!!busy} onClick={() => { if (window.prompt('Disconnect Facebook? Posting stops and the Page’s key is deleted from your admin. Type DISCONNECT to confirm.') === 'DISCONNECT') meta({ action: 'disconnect', confirm: 'DISCONNECT' }, 'Facebook disconnected.') }}>Disconnect</button>
      </div>
      {!edit ? <div className="af-row af-times">
        <span>Reels a day <b className="au-n">{F.perDay}</b></span><span>at {join(F.times)} (Lagos)</span>
        <button className="au-more af-sm" onClick={() => setEdit(true)}>Posting times</button><span className="af-dim">Separate from YouTube’s times</span>
      </div> : <div className="af-edit">
        <label className="af-lab">Reels a day<select className="input" value={per} onChange={(e) => changePer(Number(e.target.value))}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        {Array.from({ length: per }, (_, i) => <label key={i} className="af-lab">{per === 1 ? 'Time' : ['First', 'Second', 'Third'][i]}<input className="input" type="time" value={tt[i] || ''} onChange={(e) => setTt((t) => { const n = [...t]; n[i] = e.target.value; return n })} /></label>)}
        <div className="af-row"><button className="btn btn-green" disabled={!!busy} onClick={saveTimes}>{busy === 'times' ? 'Saving…' : 'Save'}</button><button className="btn btn-line" onClick={() => { setEdit(false); setPer(F.perDay); setTt(F.times) }}>Cancel</button><span className="af-dim">Lagos time. At least 2 hours apart.</span></div>
      </div>}
    </section>

    <section className="au-box">
      <div className="af-h"><h2>Up next on Facebook</h2><span className="af-dim">Picks from the shared library. Doesn’t wait for YouTube.</span></div>
      {Q.items.length ? <div className="af-next">
        {Q.items.map((x) => <div key={x.id + x.day + x.time} className="af-slot"><span className="af-d">{dayWord(x)} · {x.time}</span><b>{x.part ? `Part ${x.part} · ` : ''}{x.name}</b></div>)}
        <div className="af-slot af-more">{Q.more ? `Library has ${Q.more} more` : 'That’s everything ready'}</div>
      </div> : <p className="au-note">No finished Shorts are waiting. New ones join here as soon as the factory makes them.</p>}
      {!F.enabled ? <p className="au-note" style={{ marginTop: 10 }}>Posting is off, so nothing goes out until you switch it on.</p> : null}
    </section>

    <section className="au-box">
      <h2>Caption style</h2>
      <p className="au-note">Hook line · one-sentence “why it’s useful” · <span className="af-g">Full guide (free): olexweb.com/tools/…</span> · 3 hashtags. Written for Facebook, not copied from YouTube.</p>
      <dl className="au-rows af-rows">
        <div><dt>Recent Reels</dt><dd>{F.recent.length ? F.recent.slice(0, 3).map((r, i) => <span key={r.id}>{i ? '   ' : ''}{r.videoId ? <a href={'https://www.facebook.com/reel/' + r.videoId} target="_blank" rel="noopener noreferrer">{r.name}{r.at ? ' · ' + ago(r.at) : ''} ↗</a> : r.name}</span>) : 'None yet'}</dd></div>
        <div><dt>Safety</dt><dd>Pauses itself if Meta reports a block · 1–3 a day max</dd></div>
      </dl>
    </section>
    <style dangerouslySetInnerHTML={{ __html: BASE + CSS }} />
  </div>)
}

const CSS = `
.af-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.af-head{display:grid;gap:14px}.af-page{font-size:18px;font-weight:800}
.af-seg{display:inline-flex;padding:4px;border-radius:999px;border:1px solid var(--line);gap:2px}
.af-seg button{appearance:none;border:0;padding:8px 14px;border-radius:999px;background:transparent;color:var(--dim);font:700 13.5px inherit;cursor:pointer}
.af-seg button[aria-pressed=true]{background:var(--paper);color:var(--page,#0a0b0a)}
.af-dis{margin-left:auto}.af-sm{padding:8px 14px;font-size:13.5px}
.af-times{font-size:14px;color:var(--paper)}.af-times b{font-family:'Mona Sans',var(--font-body,inherit);font-variant-numeric:tabular-nums}
.af-dim{font-size:13px;color:var(--dim)}
.af-edit{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap}.af-lab{display:grid;gap:6px;font-size:13px;color:var(--dim)}.af-lab .input{width:auto;min-width:110px}
.af-h{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:12px}.af-h h2{margin:0}
.af-next{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
@media (max-width:900px){.af-next{grid-template-columns:repeat(2,minmax(0,1fr))}}
.af-slot{display:grid;gap:6px;align-content:start;padding:14px;border-radius:16px;border:1px solid var(--line)}
.af-slot b{font-size:15px;font-weight:700}.af-d{font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);font-family:'Mona Sans',var(--font-body,inherit)}
.af-slot.af-more{border-style:dashed;place-content:center;text-align:center;font-size:14px;color:var(--dim)}
.af-g{color:var(--green)}.af-rows{margin-top:12px}.af-rows dd{white-space:pre-wrap}.af-rows :where(a){color:var(--dim);text-decoration:none}.af-rows :where(a):hover{color:var(--paper)}
.af-paused{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:14px 16px;border-radius:18px;border:1px solid rgba(255,138,138,.4);background:rgba(255,138,138,.06)}
.af-paused span{flex:1;min-width:200px;font-size:14px;color:var(--dim)}
.af-note{margin:0;padding:12px 14px;border-radius:14px;background:rgba(143,227,106,.08);font-size:14px}
.af-err{margin:0;padding:12px 14px;border-radius:14px;background:rgba(255,138,138,.08);color:var(--bad,#ff8a8a);font-size:14px}
`
