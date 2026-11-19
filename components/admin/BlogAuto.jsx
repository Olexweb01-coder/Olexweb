'use client'
// Install 37: the Blog's own publishing switch, in the Blog (not in Automation). On: new articles are checked, fixed by Olex
// AI if a check fails, and published by themselves. Off: they wait for you here.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
export default function BlogAuto({ on: on0, hours, waiting, isOwner }) {
  const [on, setOn] = useState(on0), [busy, setBusy] = useState(false), [err, setErr] = useState(''), router = useRouter()
  async function flip() {
    setBusy(true); setErr('')
    try {
      const r = await fetch('/admin/api/switches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ key: 'blogAuto', on: !on }) }), j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'That didn’t work.')
      setOn(!on); router.refresh()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (<section style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 14, marginBottom: 16 }}>
    <span style={{ flex: 1 }}>
      <b style={{ display: 'block' }}>{on ? 'Articles publish by themselves' : 'Articles wait for you'}</b>
      <span style={{ fontSize: 13, opacity: 0.75 }}>{on ? `Each new article is checked, fixed by Olex AI if a check fails, and published after ${hours} hour${hours === 1 ? '' : 's'}.${waiting ? ` ${waiting} on the way.` : ''}` : `New articles wait here for your OK.${waiting ? ` ${waiting} waiting.` : ''}`}</span>
      {err ? <span style={{ display: 'block', color: 'var(--red, #e5484d)', fontSize: 13 }}>{err}</span> : null}
    </span>
    {isOwner ? <button className={'btn ' + (on ? '' : 'btn-green')} disabled={busy} onClick={flip}>{busy ? '…' : on ? 'Turn off' : 'Turn on'}</button> : null}
  </section>)
}
