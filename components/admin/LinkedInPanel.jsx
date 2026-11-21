'use client'
// Install 42: LinkedIn: connect, on/off, post one now, and what went out
import { useState } from 'react'
const D = (s) => (s ? new Date(s).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
const BACK = { connected: 'LinkedIn is connected. Posting is on.', cancelled: 'Connecting was cancelled.', expired: 'That took too long. Try again.', failed: 'LinkedIn didn’t connect. Try again.', notready: 'Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in Vercel first.' }
export default function LinkedInPanel({ data: d0, back }) {
  const [d, setD] = useState(d0), [busy, setBusy] = useState(''), [msg, setMsg] = useState(back ? BACK[back] || '' : ''), [note, setNote] = useState(''), [voice, setVoice] = useState(d0.voice || '')
  async function act(action, extra = {}) {
    setBusy(action); setMsg('')
    try { const r = await fetch('/admin/api/linkedin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action, ...extra }) }), j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'That didn’t work.'); setD(j); setMsg({ post: 'Posted to LinkedIn.', write: 'Written: read it below.', save: 'Saved.', approve: 'Approved: it goes out at its time.', skip: 'Skipped: a new one is written.', voice: 'Your voice is saved.', note: 'Saved: the next post is built on it.', reset: 'Started again: your comeback post is written next.', removePhoto: 'Removed.' }[action] || '') } catch (e) { setMsg(e.message) } finally { setBusy('') }
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
          
        </div>
      </section>}
    {d.connected ? <>
      <h2 style={{ fontSize: 18 }}>Next post</h2>
      {(d.posts || []).filter((p) => p.status !== 'posted').map((p) => <Draft key={p.id} p={p} act={act} busy={busy} card={card} />)}
      {!(d.posts || []).some((p) => p.status !== 'posted') ? <section style={card}><p style={{ marginTop: 0 }}>{d.intro_done ? `Day ${(d.days || 0) + 1}/100 is written by itself shortly before its time.` : 'Your first post (you’re back, and the 100 days start) is written next, and waits for your OK.'}</p><button className="btn" disabled={!!busy} onClick={() => act('write')}>{busy === 'write' ? 'Writing…' : 'Write it now'}</button></section> : null}
      <h2 style={{ fontSize: 18 }}>Your photos (up to 10, optional)</h2>
      <section style={card}>
        <p style={{ marginTop: 0, fontSize: 14, opacity: 0.8 }}>Add up to 10 photos of yourself. About twice a week, one goes with a post it truly fits, never a smiling photo on a serious post, and never the same photo within 10 days.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>{(d.photos || []).map((ph) => <div key={ph.id} style={{ width: 110, fontSize: 12 }}><img src={`/admin/api/linkedin?photo=${ph.id}`} alt="" style={{ width: 110, height: 110, objectFit: 'cover', borderRadius: 10, display: 'block' }} /><div style={{ margin: '4px 0' }}>{ph.mood}</div><button type="button" className="btn" style={{ padding: '4px 8px', fontSize: 12 }} disabled={!!busy} onClick={() => act('removePhoto', { id: ph.id })}>Remove</button></div>)}</div>
        {(d.photos || []).length < 10 ? <form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); fd.append('mode', 'library'); setBusy('library'); setMsg(''); try { const r = await fetch('/admin/api/linkedin', { method: 'POST', credentials: 'same-origin', body: fd }), j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'That didn’t work.'); setD(j); setMsg('Photos added.') } catch (er) { setMsg(er.message) } finally { setBusy('') } }}>
          <input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple required style={{ display: 'block', marginBottom: 10 }} />
          <button className="btn" disabled={!!busy}>{busy === 'library' ? 'Adding…' : 'Add photos'}</button>
        </form> : null}
      </section>
      <h2 style={{ fontSize: 18 }}>A special post with your photo (optional)</h2>
      <section style={card}>
        <p style={{ marginTop: 0, fontSize: 14, opacity: 0.8 }}>Choose a photo and write the idea in a sentence or two. The post is written around it and waits for your OK; the photo goes out exactly as it is.</p>
        <form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); setBusy('photo'); setMsg(''); try { const r = await fetch('/admin/api/linkedin', { method: 'POST', credentials: 'same-origin', body: fd }), j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'That didn’t work.'); setD(j); setMsg('Written: read it above and approve it.'); e.currentTarget && e.currentTarget.reset() } catch (er) { setMsg(er.message) } finally { setBusy('') } }}>
          <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required style={{ display: 'block', marginBottom: 10 }} />
          <textarea name="idea" rows={3} required minLength={15} style={{ width: '100%' }} placeholder="e.g. This is my desk at 5am. I want to talk about why I protect my mornings for thinking before anyone needs me." />
          <button className="btn" disabled={!!busy}>{busy === 'photo' ? 'Writing…' : 'Write the post'}</button>
        </form>
      </section>
      <h2 style={{ fontSize: 18 }}>Something real happened?</h2>
      <section style={card}>
        <p style={{ marginTop: 0, fontSize: 14, opacity: 0.8 }}>A client, a bug, a win, a mistake, a question someone asked: write it in a few lines, the way you'd tell a friend. The next post is built on it, true to what you wrote. {d.notes ? `${d.notes} note${d.notes === 1 ? '' : 's'} waiting.` : ''}</p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} style={{ width: '100%' }} placeholder="e.g. A bakery owner told me her old site took 9 seconds to load on her phone. We rebuilt it and orders through WhatsApp doubled in a month." />
        <button className="btn" disabled={!!busy || note.trim().length < 15} onClick={async () => { await act('note', { note }); setNote('') }}>{busy === 'note' ? '…' : 'Save the note'}</button>
      </section>
      <h2 style={{ fontSize: 18 }}>Start the series again</h2>
      <section style={card}>
        <p style={{ marginTop: 0, fontSize: 14, opacity: 0.8 }}>Clears the drafts and starts again from the comeback post (Day 0). What's already on LinkedIn stays there.</p>
        <button className="btn" disabled={!!busy} onClick={() => { if (window.confirm('Start the 100 days again from the comeback post?')) act('reset') }}>{busy === 'reset' ? '…' : 'Start again'}</button>
      </section>
      <h2 style={{ fontSize: 18 }}>Your voice</h2>
      <section style={card}>
        <p style={{ marginTop: 0, fontSize: 14, opacity: 0.8 }}>Paste 3 to 5 of your own past LinkedIn posts (open your profile → Activity → Posts, copy the text). Every post is written to sound like these. LinkedIn doesn't let apps read your old posts, so this is how it learns you.</p>
        <textarea value={voice} onChange={(e) => setVoice(e.target.value)} rows={7} style={{ width: '100%' }} />
        <button className="btn" disabled={!!busy} onClick={() => act('voice', { voice })}>{busy === 'voice' ? '…' : 'Save my voice'}</button>
      </section>
    </> : null}
    <h2 style={{ fontSize: 18 }}>Posted</h2>
    {(d.posts || []).filter((p) => p.status === 'posted').length ? (d.posts || []).filter((p) => p.status === 'posted').map((p, i) => (<section key={i} style={card}>
      <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>{D(p.posted_at)}{p.day ? ` · Day ${p.day}/100` : p.kind === 'intro' ? ' · your comeback post' : ''}{p.format ? ' · ' + p.format : ''}</div>
      <div style={{ whiteSpace: 'pre-wrap' }}>{p.text}</div>
      {p.link ? <div style={{ fontSize: 13, marginTop: 6 }}>First comment links to <a href={p.link} target="_blank" rel="noreferrer">{p.link}</a></div> : null}
    </section>)) : <p style={{ opacity: 0.7 }}>Nothing yet.</p>}
  </div>)
}

function Draft({ p, act, busy, card }) {
  const [text, setText] = useState(p.text || ''), [comment, setComment] = useState(p.comment || '')
  const changed = text !== p.text || comment !== p.comment
  return (<section style={{ ...card, borderColor: p.status === 'waiting' ? '#e5a50a' : 'var(--line)' }}>
    <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>{p.kind === 'intro' ? 'Your comeback post' : `Day ${p.day}/100 · ${p.format}${p.has_photo ? ' · with your photo' : ''}`}{p.status === 'waiting' ? ' · waits for your OK' : ` · goes out ${D(p.due_at)} unless you skip it`}{p.error ? ' · last try: ' + p.error : ''}</div>
    <textarea value={text} onChange={(e) => setText(e.target.value)} rows={14} style={{ width: '100%', whiteSpace: 'pre-wrap' }} />
    <div style={{ fontSize: 13, opacity: 0.75, margin: '8px 0 4px' }}>First comment ({'{LINK}'} becomes {p.link})</div>
    <input value={comment} onChange={(e) => setComment(e.target.value)} style={{ width: '100%' }} />
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
      {changed ? <button className="btn" disabled={!!busy} onClick={() => act('save', { id: p.id, text, comment })}>{busy === 'save' ? '…' : 'Save changes'}</button> : null}
      {p.status === 'waiting' ? <button className="btn btn-green" disabled={!!busy || changed} onClick={() => act('approve', { id: p.id })}>Approve</button> : null}
      <button className="btn" disabled={!!busy || changed} onClick={() => act('post', { id: p.id })}>{busy === 'post' ? 'Posting…' : 'Post it now'}</button>
      <button className="btn" disabled={!!busy} onClick={() => act('skip', { id: p.id })}>Skip and write another</button>
    </div>
  </section>)
}
