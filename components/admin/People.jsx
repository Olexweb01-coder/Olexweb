'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from './icons'
import { toast, Sheet } from './ui'

async function call(payload) {
  try {
    const r = await fetch('/admin/api/people', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'same-origin' })
    const j = await r.json().catch(() => ({}))
    if (r.status === 401) { window.location.assign('/admin/login'); return { error: 'Sign in again.' } }
    return r.ok ? j : { error: j.error || 'Something went wrong. Try again.' }
  } catch { return { error: 'No connection. Try again.' } }
}
const P = [['publish', 'Publish', 'Off: they tap \u201cSend for approval\u201d and you publish.'], ['reviews', 'Approve reviews', 'Approve or reject reviews from clients.'], ['testimonials', 'Add testimonials', 'Type in testimonials (they still need the client\u2019s permission).'], ['ventures', 'Edit ventures', 'Change the Ventures page.']]
const summary = (p) => { const on = P.filter(([k]) => p && p[k]).map(([, l]) => l.toLowerCase()); return 'Drafts projects and articles' + (on.length ? '; can also ' + on.join(', ') : '; publishing needs your approval') + '.' }

export default function PeopleBoard({ people, invites }) {
  const router = useRouter(), [sheet, setSheet] = useState(null), close = useCallback(() => setSheet(null), [])
  async function cancel(email) { const r = await call({ action: 'cancel', email }); if (r.error) toast(r.error); else { toast('Invite cancelled.'); router.refresh() } }
  return (<>
    <div className="top"><h1 className="d">People</h1><button className="btn btn-green" onClick={() => setSheet({ type: 'invite' })}>Invite</button></div>
    <ul className="rows">{people.map((x) => (
      <li key={x.id} className={'row' + (x.role === 'editor' ? ' click' : '')} onClick={x.role === 'editor' ? () => setSheet({ type: 'edit', person: x }) : undefined}>
        <span className="ic">{Icon.person}</span>
        <span><span className="row-t">{x.name}</span><span className="row-s">{x.email}. {x.role === 'owner' ? 'You. Full access.' : summary(x.perms)}</span></span>
        <span className={'pill ' + (x.role === 'owner' ? 'live' : '')}>{x.role === 'owner' ? 'Owner' : 'Editor'}</span></li>))}
      {invites.map((i) => (<li key={i.email} className="row"><span className="ic">{Icon.person}</span>
        <span><span className="row-t">{i.email}</span><span className="row-s">Invited. The link works until {new Date(i.expires_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })}.</span></span>
        <button className="btn btn-line" onClick={() => cancel(i.email)}>Cancel</button></li>))}
    </ul>
    <p className="note">Tap an editor to change what they can do, or to remove their access straight away.</p>
    {sheet ? <PermSheet key={sheet.type + (sheet.person ? sheet.person.id : '')} sheet={sheet} onClose={close} onDone={() => { router.refresh() }} /> : null}
  </>)
}

function PermSheet({ sheet, onClose, onDone }) {
  const person = sheet.person, [perms, setPerms] = useState(person ? { ...person.perms } : { publish: false, reviews: false, testimonials: false, ventures: false })
  const [email, setEmail] = useState(''), [link, setLink] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  async function go(payload, done) {
    setBusy(true); setErr(''); const r = await call(payload); setBusy(false)
    if (r.error) { setErr(r.error); return }
    if (r.link) { setLink(r.link); onDone(); return }
    toast(done); onDone(); onClose()
  }
  if (link) {
    const msg = 'You\u2019re invited to help edit olexweb.com. Set up your account here (the link works once, for 48 hours): ' + link
    return (<Sheet title="Invite ready" onClose={onClose}>
      <p>Send this link to <b>{email}</b>. It works once, for 48 hours. They choose their own password and set up their authenticator app.</p>
      <div className="share" style={{ marginTop: 14 }}><code>{link.replace('https://', '')}</code>
        <div className="acts"><button className="btn btn-green" onClick={async () => { try { await navigator.clipboard.writeText(link); toast('Invite link copied.') } catch { toast('Press and hold the link to copy it.') } }}>Copy link</button>
          <a className="btn btn-line" href={'https://wa.me/?text=' + encodeURIComponent(msg)} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a></div></div>
      <p className="note">Send it privately. Anyone with this link could use it before they do.</p>
    </Sheet>)
  }
  const foot = person
    ? <button className="btn btn-green" disabled={busy} onClick={() => go({ action: 'perms', id: person.id, perms }, 'Saved.')}>Save</button>
    : <button className="btn btn-green" disabled={busy} onClick={() => go({ action: 'invite', email, perms })}>Make invite link</button>
  return (<Sheet title={person ? person.name : 'Invite an editor'} onClose={onClose} foot={foot}>
    {person ? null : <div className="field"><label htmlFor="iv1">Their email</label><input className="input" id="iv1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></div>}
    <h3 className="section-t" style={{ marginTop: 8 }}>Always allowed</h3>
    <div className="never" style={{ borderColor: 'rgba(143,227,106,.35)' }}>Add and edit <b style={{ color: 'var(--green)' }}>drafts</b> of projects and articles.</div>
    <h3 className="section-t">You choose</h3>
    <div className="perm">{P.map(([k, t, d]) => (<div className="switch" key={k}><span><b>{t}</b><br /><span style={{ color: 'var(--dim)', fontSize: 13.5 }}>{d}</span></span>
      <input type="checkbox" className="toggle" checked={!!perms[k]} onChange={(e) => setPerms({ ...perms, [k]: e.target.checked })} aria-label={t} /></div>))}</div>
    <h3 className="section-t">Never, for editors</h3>
    <div className="never"><b>Owner only:</b> people and permissions, security settings, the review link, the bin and deleting, and other people’s sign-in history.</div>
    {err ? <p className="err" role="alert">{err}</p> : null}
    {person ? <p style={{ marginTop: 22 }}><button className="btn btn-bad" disabled={busy} onClick={() => { if (window.confirm(`Remove ${person.name}'s access now? They'll be signed out everywhere.`)) go({ action: 'remove', id: person.id }, 'Access removed.') }}>Remove access now</button></p> : null}
  </Sheet>)
}
