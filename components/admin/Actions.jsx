'use client'
import { useState } from 'react'
// Buttons that change something: they only ever POST to this site's own endpoints.
async function post(url) { const r = await fetch(url, { method: 'POST', credentials: 'same-origin' }); return r.ok ? r.json() : { error: true } }
export function SignOut() {
  return <button className="btn btn-bad" onClick={async () => { await post('/admin/api/sign-out'); window.location.assign('/admin/login') }}>Sign out</button>
}
export function SignOutOthers() {
  const [msg, setMsg] = useState('')
  return (<span style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
    <button className="btn btn-line" onClick={async () => { const r = await post('/admin/api/sign-out-others'); setMsg(r.error ? 'Couldn\u2019t sign them out. Try again.' : r.count ? `Signed out ${r.count} other device${r.count === 1 ? '' : 's'}.` : 'No other devices were signed in.') }}>Sign out other devices</button>
    {msg ? <span className="ok" role="status">{msg}</span> : null}
  </span>)
}
export function InstallNote() {
  const [hidden, setHidden] = useState(false)
  if (hidden) return null
  return (<div className="banner"><img src="/studio/mark.png" alt="" width="22" height="25" /><span><b>Install the admin.</b> iPhone: Share, then Add to Home Screen. Android: Install app.</span><button onClick={() => setHidden(true)} aria-label="Hide">&times;</button></div>)
}
