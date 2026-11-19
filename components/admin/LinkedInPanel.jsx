'use client'
// Install 42: LinkedIn: connect, on/off, post one now, and what went out
import { useState } from 'react'
const D = (s) => (s ? new Date(s).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
const BACK = { connected: 'LinkedIn is connected. Posting is on.', cancelled: 'Connecting was cancelled.', expired: 'That took too long. Try again.', failed: 'LinkedIn didn’t connect. Try again.', notready: 'Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in Vercel first.' }
export default function LinkedInPanel({ data: d0, back }) {
  const [d, setD] = useState(d0), [busy, setBusy] = useState(''), [msg, setMsg] = useState(back ? BACK[back] || '' : '')
  async function act(action, extra = {}) {
    setBusy(action); setMsg('')
    try { const r = await fetch('/admin/api/linkedin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action, ...extra }) }), j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'That didn’t work.'); setD(j); if (action === 'post') setMsg('Posted to LinkedIn.') } catch (e) { setMsg(e.message) } finally { setBusy('') }
  }
  const days = Math.max(0, Math.round((new Date(d.expires_at) - Date.now()) / 864e5))
  const card = { border: '1px solid var(--line)', borderRadius: 14, padding: '16px 18px', marginBottom: 14 }
  return (<div style={{ maxWidth: 760 }}>
    <h1 style={{ marginBottom: 6 }}>LinkedIn</h1>
    <p style={{ opacity: 0.75, marginTop: 0 }}>One post each weekday morning on your profile, written the way LinkedIn rewards: a strong hook, short lines, one lesson for business owners, a question, and the link as the first comment.</p>
    {msg ? <p role="status" style={{ ...card, padding: '10px 14px' }}>{msg}</p> : null}
    {!d.ready ? <section style={card}><b>Not set up yet.</b><p style={{ margin: '6px 0 0' }}>Add <code>LINKEDIN_CLIENT_ID</code> and <code>LINKEDIN_CLIENT_SECRET</code> in Vercel, redeploy, then come back here to connect.</p></section>
      : !d.connected ? <section style={card}><b>Connect your LinkedIn profile</b><p style={{ margin: '6px 0 12px' }}>You sign in on LinkedIn and allow posting. Nothing is posted until you connect.</p><a className="btn btn-green" href="/admin/api/linkedin/connect">Connect LinkedIn</a></section>
      : <section style={card}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: 1 }}><b>{d.paused_reason ? 'Paused' : d.enabled ? 'Posting is on' : 'Posting is off'}</b> · {d.name}<br /><span style={{ fontSize: 13, opacity: 0.75 }}>{d.paused_reason || `Weekdays at ${d.post_time} (Lagos). LinkedIn’s sign-in lasts ${days} more day${days === 1 ? '' : 's'}; you’ll be reminded a week before.`}</span></span>
          {d.paused_reason || days < 8 ? <a className="btn btn-green" href="/admin/api/linkedin/connect">Connect again</a> : null}
          <button className="btn" disabled={!!busy} onClick={() => act('enable', { on: !d.enabled })}>{busy === 'enable' ? '…' : d.enabled ? 'Turn off' : 'Turn on'}</button>
          <button className="btn" disabled={!!busy} onClick={() => act('post')}>{busy === 'post' ? 'Writing and posting…' : 'Post one now'}</button>
        </div>
      </section>}
    <h2 style={{ fontSize: 18 }}>Posted</h2>
    {d.posts && d.posts.length ? d.posts.map((p, i) => (<section key={i} style={card}>
      <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>{D(p.posted_at)} · {p.kind === 'video' ? 'from a video' : 'from an article'}{p.status === 'failed' ? ' · didn’t post' : ''}</div>
      {p.status === 'failed' ? <div style={{ color: 'var(--red, #e5484d)' }}>{p.error}</div> : <div style={{ whiteSpace: 'pre-wrap' }}>{p.text}{p.text && p.text.length >= 260 ? '…' : ''}</div>}
      {p.link ? <div style={{ fontSize: 13, marginTop: 6 }}>First comment links to <a href={p.link} target="_blank" rel="noreferrer">{p.link}</a></div> : null}
    </section>)) : <p style={{ opacity: 0.7 }}>Nothing yet.</p>}
  </div>)
}
