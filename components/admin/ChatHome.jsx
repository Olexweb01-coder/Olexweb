'use client'
// Olex AI's chat, as the admin home. Answers stream word by word; anything that changes the site waits for "Do it".
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'
import Markdown from './Markdown'
import Voice from './Voice'
import { Icon } from './icons'

async function call(payload) {
  try {
    const r = await fetch('/admin/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'same-origin' })
    const j = await r.json().catch(() => ({}))
    if (r.status === 401) { window.location.assign('/admin/login'); return { error: 'Sign in again.' } }
    return r.ok ? j : { error: j.error || 'Something went wrong. Try again.' }
  } catch { return { error: 'No connection. Try again.' } }
}
const MAX_TEXT = 24000, MAX_FILE = 200 * 1024
const TEXTY = /\.(js|jsx|mjs|cjs|ts|tsx|py|json|css|scss|html|htm|md|mdx|txt|sql|php|java|go|rb|rs|c|h|cpp|cs|sh|ps1|yml|yaml|xml|toml|ini|env|vue|svelte|csv|log)$/i
const IDEAS = [
  ['Find topics', 'Find today’s topics people are searching for.'],
  ['Blog numbers', 'How did Olex Blog do over the last 30 days?'],
  ['Write a proposal', 'Write a short proposal for a 5-page restaurant website.'],
  ['Write some code', 'Write a Python script that sorts a list of invoices by due date and prints the overdue ones.'],
]

export default function ChatHome({ chatId: openId, messages, first, greet, ready }) {
  const router = useRouter()
  const [chatId, setChatId] = useState(openId), [msgs, setMsgs] = useState(messages), [text, setText] = useState(''), [busy, setBusy] = useState('')
  const end = useRef(null), box = useRef(null), current = useRef(openId)
  // Picking another chat in the sidebar (or New chat) swaps the conversation; a refresh of the same chat updates it.
  useEffect(() => { if (openId !== current.current) { current.current = openId; setChatId(openId); setMsgs(messages); setText('') } else if (!busy) setMsgs(messages) }, [openId, messages])
  useEffect(() => { if (end.current) end.current.scrollIntoView({ block: 'end' }) }, [msgs])
  useEffect(() => { const t = box.current; if (!t) return; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 220) + 'px' }, [text])

  async function send(e, preset) {
    if (e) e.preventDefault()
    const t = (preset ?? text).trim(); if (!t || busy) return
    const mine = { id: 'me' + Date.now(), role: 'you', text: t }, live = { id: 'live', role: 'assistant', text: '' }
    setMsgs((m) => [...m, mine]); setText(''); setBusy('Thinking\u2026')
    let full = '', done = null, failed = null
    const show = () => { let v = full.split('<<<ACTION')[0]; v = v.replace(/<{1,3}A?C?T?I?O?N?$/, ''); setMsgs((m) => [...m.filter((x) => x.id !== 'live'), { ...live, text: v }]) }
    try {
      const r = await fetch('/admin/api/assistant/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ chatId, text: t }) })
      if (r.status === 401) { window.location.assign('/admin/login'); return }
      if (!r.ok || !r.body) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'Something went wrong. Try again.') }
      const reader = r.body.getReader(), dec = new TextDecoder(); let buf = '', last = 0
      for (;;) {
        const { done: fin, value } = await reader.read(); if (fin) break
        buf += dec.decode(value, { stream: true }); let i
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2)
          const ev = (block.match(/^event: (.*)$/m) || [])[1], data = (block.match(/^data: (.*)$/m) || [])[1]
          let j = {}; try { j = JSON.parse(data || '{}') } catch {}
          if (ev === 'delta') { full += j.text || ''; setBusy('Writing\u2026'); if (Date.now() - last > 40) { last = Date.now(); show() } }
          else if (ev === 'done') done = j
          else if (ev === 'error') failed = j.error
        }
      }
      if (failed) throw new Error(failed)
      if (!done) throw new Error('The answer was interrupted. Try again.')
      setMsgs((m) => [...m.filter((x) => x.id !== 'live' && x !== mine), ...done.messages])
      if (done.chatId !== chatId) { current.current = done.chatId; setChatId(done.chatId); router.replace('/admin?c=' + done.chatId, { scroll: false }) }
      router.refresh()                                                     // the sidebar's chat list
    } catch (err) {
      setMsgs((m) => m.filter((x) => x.id !== 'live' && x !== mine)); setText(t); toast(err.message || 'Something went wrong. Try again.')
    } finally { setBusy('') }
  }
  async function decide(m, yes) {
    if (busy) return
    setMsgs((all) => all.map((x) => (x.id === m.id ? { ...x, action_state: yes ? 'running' : 'cancelled' } : x)))
    if (yes) setBusy(m.action && ['write', 'revise', 'research'].includes(m.action.type) ? 'Working on it. Researching and writing can take a minute or two\u2026' : 'Working on it\u2026')
    const r = await call({ action: yes ? 'confirm' : 'cancel', messageId: m.id }); setBusy('')
    if (r.error) { toast(r.error); const c = await call({ action: 'chat', chatId }); if (c.messages) setMsgs(c.messages); return }
    setMsgs((all) => [...all.map((x) => (x.id === m.id ? { ...x, action_state: r.state } : x)), ...(r.message ? [r.message] : [])]); router.refresh()
  }
  // Attach code or text files: each one goes into the message as a named code block, so Olex AI sees the file name too.
  async function attach(e) {
    const picked = [...(e.target.files || [])]; e.target.value = ''
    let add = ''
    for (const f of picked) {
      if (!TEXTY.test(f.name) && !/^text\//.test(f.type)) { toast(`${f.name} isn’t a code or text file. Documents and images come in a later update.`); continue }
      if (f.size > MAX_FILE) { toast(`${f.name} is over 200 KB. Paste the part you need help with.`); continue }
      const body = await f.text()
      if (/\u0000/.test(body)) { toast(`${f.name} doesn’t look like text.`); continue }
      const ext = (f.name.split('.').pop() || '').toLowerCase()
      add += `\n\n\`\`\`${ext} ${f.name}\n${body.replace(/\n$/, '')}\n\`\`\`\n`
    }
    if (!add) return
    setText((t) => { const next = (t.trimEnd() + add).trimStart(); if (next.length > MAX_TEXT) { toast('That’s more than fits in one message. Attach fewer or smaller files.'); return t } return next })
    setTimeout(() => box.current && box.current.focus(), 0)
  }
  const addSpoken = (words) => { setText((t) => (t.trim() ? t.trimEnd() + ' ' : '') + words); setTimeout(() => box.current && box.current.focus(), 0) }

  const composer = (<form className="composer" onSubmit={send}>
    <textarea ref={box} rows={1} value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_TEXT} placeholder="Message Olex AI" aria-label="Message Olex AI"
      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) send(e) }} />
    <div className="composer-row">
      <label className="icon-btn attach" title="Attach code or text files" aria-label="Attach code or text files">{Icon.clip}<input type="file" multiple onChange={attach} disabled={!!busy} /></label>
      <span className="composer-hint">{busy || 'Enter to send, Shift + Enter for a new line'}</span>
      <Voice onText={addSpoken} disabled={!!busy} />
      <button type="submit" className="icon-btn sendbtn" disabled={!!busy || !text.trim()} aria-label="Send">{Icon.send}</button>
    </div>
  </form>)

  if (!ready) return (<div className="chat-empty"><img src="/studio/mark.png" alt="" width="44" height="52" /><h1 className="d">Switch Olex AI on.</h1>
    <p>Olex AI needs at least one free AI key, for example GROQ_API_KEY from Groq or GEMINI_API_KEY from Google AI Studio. Add it in Vercel and in .env.local, then restart.</p></div>)

  return (<div className={'chat-wrap' + (msgs.length ? '' : ' fresh')}>
    {msgs.length ? <div className="thread">
      {msgs.map((m) => m.role === 'you' ? <div key={m.id} className="turn me"><div className={'bubble' + (/```/.test(m.text) ? ' has-code' : '')}>{/```/.test(m.text) ? <Markdown text={m.text} /> : m.text}</div></div>
        : <div key={m.id} className="turn ai"><img className="ai-mark" src="/studio/mark.png" alt="" width="20" height="24" />
          <div className="ai-body">{m.text ? <Markdown text={m.text} streaming={m.id === 'live'} /> : null}
            {m.action ? <div className={'actcard ' + (m.action_state || '')}>
              <p className="actlabel">{m.action.label}</p>
              {m.action_state === 'proposed' ? <div className="acts"><button type="button" className="btn btn-green" disabled={!!busy} onClick={() => decide(m, true)}>Do it</button><button type="button" className="btn btn-line" disabled={!!busy} onClick={() => decide(m, false)}>Cancel</button></div>
                : <p className="actstate">{{ running: 'Working on it\u2026', done: 'Done', cancelled: 'Cancelled', failed: 'Didn\u2019t work' }[m.action_state] || ''}</p>}
            </div> : null}
            {m.post_id ? <a className="draftcard" href={'/admin/blog?open=' + m.post_id}><b>Open the draft</b><span>Read it, check the flagged claims, then publish or ask for changes.</span></a> : null}
            {m.written_by && m.ms_first != null ? <p className="msgmeta">{m.written_by}, first words in {(m.ms_first / 1000).toFixed(1)} s</p> : null}
          </div></div>)}
      {busy && !msgs.some((m) => m.id === 'live' && m.text) ? <div className="turn ai"><img className="ai-mark" src="/studio/mark.png" alt="" width="20" height="24" /><div className="typing" role="status" aria-label={busy}><span /><span /><span /></div></div> : null}
      <div ref={end} />
    </div> : <div className="hello">
      <img src="/studio/mark.png" alt="" width="40" height="47" />
      <h1 className="d">{greet}, {first}.<br /><span>What are we working on?</span></h1>
    </div>}
    <div className="dock">
      {composer}
      {!msgs.length ? <div className="ideas">{IDEAS.map(([l, p]) => <button key={l} type="button" onClick={() => send(null, p)} disabled={!!busy}><b>{l}</b><span>{p}</span></button>)}</div> : null}
      <p className="fine">Olex AI can get things wrong, so check what matters. Nothing on your site changes until you tap Do it.</p>
    </div>
  </div>)
}
