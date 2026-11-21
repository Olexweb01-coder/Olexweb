'use client'
// Follow a host (needs a free account; joining meetings never does)
import { useState } from 'react'
export default function Follow({ handle, following: f0, signedIn, home }) {
  const [on, setOn] = useState(f0), [busy, setBusy] = useState(false), [err, setErr] = useState('')
  if (!signedIn) return <a className="mh-btn mh-go mh-sm" href={home}>Sign in to follow</a>
  async function go() {
    setBusy(true); setErr('')
    try { const r = await fetch('/api/meet/community', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'follow', handle, on: !on }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'That didn’t work.'); setOn(!on) }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return <span><button className={'mh-btn mh-sm' + (on ? '' : ' mh-go')} disabled={busy} onClick={go}>{on ? 'Following' : 'Follow'}</button>{err ? <small className="md-err"> {err}</small> : null}</span>
}
