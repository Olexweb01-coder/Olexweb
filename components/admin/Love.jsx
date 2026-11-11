'use client'
// Admin → Our Space (love.olexweb.com): the spaces, who's in them, last seen and notifications; new invite links,
// ban or unban, and erasing a space (typed confirmation). Messages are never shown: they're encrypted on the phones.
import { useEffect, useState } from 'react'
import { toast } from './ui'

async function call(body) {
  try {
    const r = await fetch('/admin/api/love', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' })
    const j = await r.json().catch(() => ({})); if (r.status === 401) window.location.assign('/admin/login')
    return r.ok ? j : { error: j.error || 'Something went wrong. Try again.' }
  } catch { return { error: 'No connection. Try again.' } }
}
const ago = (iso) => { if (!iso) return 'never'; const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 2 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago' }
const disappear = (s) => !s ? 'Messages stay' : s < 3600 ? `Messages disappear after ${Math.round(s / 60)} min` : s < 86400 ? `Messages disappear after ${Math.round(s / 3600)} h` : `Messages disappear after ${Math.round(s / 86400)} days`

export default function LoveBoard({ ready, url }) {
  const [d, setD] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(''), [link, setLink] = useState(null), [del, setDel] = useState(null), [typed, setTyped] = useState('')
  async function load() { const j = await call({ action: 'spaces' }); if (j.error) setErr(j.error); else { setErr(''); setD(j) } }
  useEffect(() => { if (ready) load() }, [ready])
  async function invite(s, role) { setBusy(s.id + role); const j = await call({ action: 'invite', id: s.id, role }); setBusy(''); if (j.error) toast(j.error); else setLink({ space: s.label, role, ...j }) }
  async function ban(s, m, on) { setBusy(s.id + m.role + 'b'); const j = await call({ action: on ? 'ban' : 'unban', id: s.id, role: m.role }); setBusy(''); if (j.error) toast(j.error); else { toast(on ? `${m.name} is banned and signed out on every device.` : `${m.name} is unbanned. Send a new link if they need to sign in again.`, true); load() } }
  async function erase(s) {
    setBusy(s.id + 'd'); const j = await call({ action: 'delete', id: s.id, confirm: del && del.id === s.id ? typed : undefined }); setBusy('')
    if (j.error && !j.confirmNeeded) { toast(j.error); return }
    if (j.confirmNeeded) { setDel({ id: s.id, phrase: j.requiredConfirm, info: j.willDelete }); setTyped(''); return }
    toast(`Erased ${j.deleted}.`, true); setDel(null); load()
  }
  const copy = async (t) => { try { await navigator.clipboard.writeText(t); toast('Link copied.', true) } catch { toast('Copy it by hand.') } }
  const inviteUrl = link && (link.url || link.link || link.inviteUrl)
  return (<>
    <div className="top"><h1 className="d">Our Space</h1>{url ? <a className="btn btn-line" href={url} target="_blank" rel="noopener">Open Our Space ↗</a> : null}</div>
    <p className="note" style={{ marginTop: -6 }}>Your private space for two at {url ? url.replace('https://', '') : 'love.olexweb.com'}. Messages never show here: they’re locked on your phones. New spaces start in the app (Settings → Start a space with someone new).</p>
    {!ready ? <div className="empty">Not connected yet. In Vercel, add <b>US_APP_URL</b> (https://love.olexweb.com) and <b>US_ADMIN_API_KEY</b> (the same value as ADMIN_API_KEY in the Our Space project) to the Olexweb project, then redeploy.</div>
      : err ? <div className="empty" role="alert">{err} <button className="btn btn-line" onClick={load}>Try again</button></div>
      : !d ? <div className="empty">Loading…</div>
      : !d.spaces.length ? <div className="empty">No spaces yet. Open {url}/setup on your phone to start the first one.</div>
      : <>
        <p className="note">{d.used} of {d.limit} spaces used.</p>
        {d.spaces.map((s) => (<section key={s.id} className="ls-space">
          <div className="ls-head"><div><b className="d">{s.label}</b><span>{s.messageCount} message{s.messageCount === 1 ? '' : 's'} · last {ago(s.lastMessageAt)} · {disappear(s.disappearSeconds)}</span></div></div>
          {s.members.map((m) => (<div key={m.id} className="ls-m">
            <div><b>{m.name}</b>{m.banned ? <em className="ls-ban">Banned</em> : null}<span>{m.role === 'host' ? 'You (host)' : 'Partner'} · last seen {ago(m.lastSeenAt)} · notifications {m.notifications ? 'on' : 'off'}</span></div>
            <span className="acts">
              <button className="btn btn-line" disabled={!!busy || m.banned} onClick={() => invite(s, m.role)}>{m.role === 'host' ? 'Link for my new phone' : 'Link for a new phone'}</button>
              {m.role === 'partner' ? (m.banned ? <button className="btn btn-line" disabled={!!busy} onClick={() => ban(s, m, false)}>Unban</button> : <button className="btn btn-bad" disabled={!!busy} onClick={() => ban(s, m, true)}>Ban</button>) : null}
            </span>
          </div>))}
          {!s.members.some((m) => m.role === 'partner') ? <div className="ls-m"><div><b>No partner yet</b><span>Send an invite link. They still need the password, which you tell them yourself.</span></div><button className="btn btn-green" disabled={!!busy} onClick={() => invite(s, 'partner')}>New invite link</button></div> : null}
          {del && del.id === s.id ? <div className="ls-del" role="alert"><b>This erases {del.info.label} for good:</b> {del.info.people || 'its people'}, {del.info.messages} messages and {del.info.files} files. It can’t be undone.
            <label>Type <code>{del.phrase}</code> to confirm<input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></label>
            <span className="acts"><button className="btn btn-line" onClick={() => setDel(null)}>Keep it</button><button className="btn btn-bad" disabled={typed !== del.phrase || !!busy} onClick={() => erase(s)}>Erase for good</button></span></div>
            : <button className="btn btn-line ls-erase" disabled={!!busy} onClick={() => erase(s)}>Erase this space…</button>}
        </section>))}
      </>}
    {link ? <div className="ls-link" role="dialog" aria-label="Invite link"><b>New link for {link.role === 'host' ? 'your new phone' : 'your partner'} ({link.space})</b>
      <code>{inviteUrl || JSON.stringify(link)}</code><p className="note" style={{ margin: 0 }}>Works for 7 days. They still need the password: tell them yourself, never in the same message.</p>
      <span className="acts">{inviteUrl ? <button className="btn btn-green" onClick={() => copy(inviteUrl)}>Copy link</button> : null}{inviteUrl ? <a className="btn btn-line" href={'https://wa.me/?text=' + encodeURIComponent(inviteUrl)} target="_blank" rel="noopener noreferrer">Send on WhatsApp</a> : null}<button className="btn btn-line" onClick={() => setLink(null)}>Done</button></span></div> : null}
    <style>{`.ls-space{margin-top:16px;padding:18px;border:1px solid var(--line);border-radius:20px;display:grid;gap:4px}.ls-head b{display:block;font-size:20px}.ls-head span{color:var(--dim);font-size:14px}
.ls-m{display:flex;gap:12px;justify-content:space-between;align-items:center;flex-wrap:wrap;padding:12px 0;border-top:1px solid var(--line)}.ls-m b{margin-right:8px}.ls-m span:not(.acts){display:block;color:var(--dim);font-size:13.5px}
.ls-ban{font-style:normal;font-size:12px;font-weight:700;padding:2px 8px;border-radius:99px;background:rgba(255,90,70,.15);color:#ffb4a8}
.ls-erase{justify-self:start;margin-top:8px}.ls-del{display:grid;gap:10px;margin-top:8px;padding:14px;border-radius:14px;background:rgba(255,90,70,.1);border:1px solid rgba(255,90,70,.35);font-size:14px}.ls-del label{display:grid;gap:6px}
.ls-link{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);width:min(560px,calc(100vw - 32px));display:grid;gap:10px;padding:18px;border-radius:20px;background:var(--raise2,#1b1d1b);border:1px solid var(--line);box-shadow:0 30px 80px -20px #000;z-index:50}.ls-link code{word-break:break-all;font-size:13px;padding:8px 10px;border-radius:10px;background:#000}`}</style>
  </>)
}
