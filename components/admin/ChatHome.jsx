'use client'
// Olex AI's chat, as the admin home. Answers stream word by word; anything that changes the site waits for "Do it".
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'
import Markdown from './Markdown'
import { copyText } from './CodeBlock'
import { DOC_RE } from './docs'
import { toWord, toExcel, toPdf, hasTable } from './exportDoc'
import Voice from './Voice'
import VoiceChat from './VoiceChat'
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
  const [talk, setTalk] = useState(false), [pend, setPend] = useState([]), [reading, setReading] = useState(''), [chatId, setChatId] = useState(openId), [msgs, setMsgs] = useState(messages), [text, setText] = useState(''), [busy, setBusy] = useState('')
  const end = useRef(null), box = useRef(null), current = useRef(openId)
  // Picking another chat in the sidebar (or New chat) swaps the conversation; a refresh of the same chat updates it.
  useEffect(() => { if (openId !== current.current) { current.current = openId; setChatId(openId); setMsgs(messages); setText('') } else if (!busy) setMsgs(messages) }, [openId, messages])
  useEffect(() => { if (end.current) end.current.scrollIntoView({ block: 'end' }) }, [msgs])
  useEffect(() => { const t = box.current; if (!t) return; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 220) + 'px' }, [text])

  async function send(e, preset) {
    if (e) e.preventDefault()
    const docsNow = preset ? [] : pend, t = (preset ?? text).trim()
    if ((!t && !docsNow.length) || busy || reading) return
    const mine = { id: 'me' + Date.now(), role: 'you', text: t || 'Here is a document. Read it and give me a short summary of what it is and what matters in it.', docs: docsNow }, live = { id: 'live', role: 'assistant', text: '' }
    setMsgs((m) => [...m, mine]); setText(''); setPend((p) => (preset ? p : [])); setBusy(docsNow.length ? 'Reading the document\u2026' : 'Thinking\u2026')
    let full = '', done = null, failed = null
    const show = () => { let v = full.split('<<<')[0]; v = v.replace(/<{1,3}[A-Z]*$/, ''); setMsgs((m) => [...m.filter((x) => x.id !== 'live'), { ...live, text: v }]) }
    try {
      const r = await fetch('/admin/api/assistant/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ chatId, text: t, docIds: docsNow.map((d) => d.id) }) })
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
          else if (ev === 'status') setBusy(j.text || 'Working\u2026')
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
      setMsgs((m) => m.filter((x) => x.id !== 'live' && x !== mine)); setText(t); if (docsNow.length) setPend(docsNow); toast(err.message || 'Something went wrong. Try again.')
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
      if (DOC_RE.test(f.name) && !/\.(csv|tsv)$/i.test(f.name) || (/\.(csv|tsv)$/i.test(f.name) && f.size > MAX_FILE)) { await addDoc(f); continue }
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
  // Voice: live words show while you speak (on top of what you'd already typed); the final transcript replaces them.
  const liveBase = useRef(null)
  const join = (a, b) => (a && a.trim() ? a.trimEnd() + ' ' : '') + (b || '')
  const onLive = (words) => {
    if (words === null) { if (liveBase.current !== null) setText(liveBase.current); liveBase.current = null; return }
    setText((t) => { if (liveBase.current === null) liveBase.current = t; return join(liveBase.current, words) })
  }
  // Documents (PDF, Word, Excel, scans, photos): read here in the browser, then saved with the chat.
  async function addDoc(f) {
    if (f.size > 60 * 1024 * 1024) { toast(`${f.name} is over 60 MB. Try a smaller file.`); return }
    try {
      setReading('Opening ' + f.name + '\u2026')
      const { readDocument } = await import('./docs')
      const d = await readDocument(f, (m) => setReading(m))
      setReading('Saving ' + f.name + '\u2026')
      const r = await fetch('/admin/api/docs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(d) })
      const j = await r.json().catch(() => ({}))
      if (r.status === 401) { window.location.assign('/admin/login'); return }
      if (!r.ok) throw new Error(j.error || 'That document couldn’t be saved.')
      setPend((p) => [...p, { id: j.id, name: j.name, kind: j.kind, pages: j.pages, chars: j.chars, note: j.note }])
      if (j.note) toast(`${j.name}: ${j.note}.`)
    } catch (e) { toast(e.message || `${f.name} couldn’t be read.`) } finally { setReading('') }
  }
  const addSpoken = (words) => {
    setText((t) => { const base = liveBase.current !== null ? liveBase.current : t; liveBase.current = null; return join(base, words) })
    setTimeout(() => box.current && box.current.focus(), 0)
  }

  const chip = (d, onRemove) => <span key={d.id} className="doc-chip">{Icon.file}<span><b>{d.name}</b><small>{[d.kind && d.kind.toUpperCase(), d.pages && `${d.pages} ${d.kind === 'pdf' ? 'pages' : 'sheets'}`, d.chars && `${Math.round(d.chars / 1000)}k characters`].filter(Boolean).join(' · ')}</small></span>{onRemove ? <button type="button" onClick={onRemove} aria-label={'Remove ' + d.name}>{Icon.close}</button> : null}</span>
  const composer = (<form className="composer" onSubmit={send}>
    {pend.length || reading ? <div className="doc-chips">{pend.map((d) => chip(d, () => setPend((p) => p.filter((x) => x.id !== d.id))))}{reading ? <span className="doc-chip reading" role="status">{Icon.file}<span><b>{reading}</b></span></span> : null}</div> : null}
    <textarea ref={box} rows={1} value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_TEXT} placeholder="Message Olex AI" aria-label="Message Olex AI"
      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) send(e) }} />
    <div className="composer-row">
      <label className="icon-btn attach" title="Attach documents, images or code" aria-label="Attach documents, images or code">{Icon.clip}<input type="file" multiple onChange={attach} disabled={!!busy} /></label>
      <span className="composer-hint">{busy || 'Enter to send, Shift + Enter for a new line'}</span>
      <Voice onText={addSpoken} onLive={onLive} disabled={!!busy} />
      <button type="button" className="icon-btn talkbtn" onClick={() => setTalk(true)} disabled={!!busy} aria-label="Talk with Olex AI" title="Talk with Olex AI">{Icon.wave}</button>
      <button type="submit" className="icon-btn sendbtn" disabled={!!busy || !!reading || (!text.trim() && !pend.length)} aria-label="Send">{Icon.send}</button>
    </div>
  </form>)

  if (!ready) return (<div className="chat-empty"><img src="/studio/mark.png" alt="" width="44" height="52" /><h1 className="d">Switch Olex AI on.</h1>
    <p>Olex AI needs at least one free AI key, for example GROQ_API_KEY from Groq or GEMINI_API_KEY from Google AI Studio. Add it in Vercel and in .env.local, then restart.</p></div>)

  async function forget(m, l) {
    const r = await call({ action: 'memory-delete', id: l.id }); if (r.error) { toast(r.error); return }
    setMsgs((all) => all.map((x) => (x.id === m.id ? { ...x, memory: (x.memory || []).filter((y) => y.id !== l.id) } : x))); toast('Forgotten.')
  }
  const endTalk = (id, added) => {
    setTalk(false)
    if (added && added.length) setMsgs((m) => [...m, ...added])
    if (id && id !== chatId) { current.current = id; setChatId(id); router.replace('/admin?c=' + id, { scroll: false }) }
    router.refresh()
  }
  return (<div className={'chat-wrap' + (msgs.length ? '' : ' fresh')}>
    {talk ? <VoiceChat chatId={chatId} first={first} onClose={endTalk} /> : null}
    {msgs.length ? <div className="thread">
      {msgs.map((m) => m.role === 'you' ? <div key={m.id} className="turn me">{m.docs && m.docs.length ? <div className="doc-chips mine">{m.docs.map((d) => chip(d))}</div> : null}<div className={'bubble' + (/```/.test(m.text) ? ' has-code' : '')}>{/```/.test(m.text) ? <Markdown text={m.text} /> : m.text}</div></div>
        : <div key={m.id} className="turn ai"><img className="ai-mark" src="/studio/mark.png" alt="" width="20" height="24" />
          <div className="ai-body">{m.text ? <Markdown text={m.text} streaming={m.id === 'live'} /> : null}
            {m.action ? <div className={'actcard ' + (m.action_state || '') + (m.action.danger ? ' danger' : '')}>
              <p className="actlabel">{m.action.label}</p>
              {m.action_state === 'proposed' ? <div className="acts"><button type="button" className={m.action.danger ? 'btn btn-bad' : 'btn btn-green'} disabled={!!busy} onClick={() => decide(m, true)}>Do it</button><button type="button" className="btn btn-line" disabled={!!busy} onClick={() => decide(m, false)}>Cancel</button></div>
                : <p className="actstate">{{ running: 'Working on it\u2026', done: 'Done', cancelled: 'Cancelled', failed: 'Didn\u2019t work' }[m.action_state] || ''}</p>}
            </div> : null}
            {m.post_id ? <a className="draftcard" href={'/admin/blog?open=' + m.post_id}><b>Open the draft</b><span>Read it, check the flagged claims, then publish or ask for changes.</span></a> : null}
            {m.memory && m.memory.length ? <div className="learned">{m.memory.map((l) => <span key={l.id} className="learned-chip">{Icon.memory}<span>Remembered: {l.text}</span><button type="button" onClick={() => forget(m, l)}>Undo</button></span>)}</div> : null}
            {m.id !== 'live' && !String(m.id).startsWith('me') ? <Feedback m={m} onRated={(r) => setMsgs((all) => all.map((x) => (x.id === m.id ? { ...x, rating: r } : x)))} /> : null}
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

// Copy, thumbs up, thumbs down (with an optional reason that becomes a lesson).
function Feedback({ m, onRated }) {
  const [asking, setAsking] = useState(false), [note, setNote] = useState(''), [copied, setCopied] = useState(false)
  async function send(r, why) {
    const res = await call({ action: 'rate', messageId: m.id, rating: r, note: why || undefined })
    if (res.error) { toast(res.error); return }
    onRated(res.rating); setAsking(false); setNote('')
    if (res.lesson) toast('Thanks. Olex AI will remember: ' + res.lesson.text.replace(/^From his feedback: /, ''))
    else if (r === 1) toast('Thanks. Olex AI will use answers like this as an example.')
  }
  function down() { if (m.rating === -1) { send(0); return } setAsking(true); send(-1) }
  const long = m.text && (m.text.length > 300 || /^#{1,3}\s|\n\s*\|/m.test(m.text))
  const save = async (kind, e) => {
    try { if (kind === 'word') await toWord(m.text); else if (kind === 'excel') await toExcel(m.text); else { const md = e.currentTarget.closest('.ai-body').querySelector('.md'); toPdf(md ? md.innerHTML : '', m.text) } }
    catch { toast('That file couldn’t be made. Try again.') }
  }
  return (<div className="fb">
    {long ? <span className="fb-save"><button type="button" onClick={(e) => save('word', e)} title="Download as a Word document">{Icon.download}Word</button><button type="button" onClick={(e) => save('pdf', e)} title="Save as PDF">PDF</button>{hasTable(m.text) ? <button type="button" onClick={(e) => save('excel', e)} title="Download the tables as an Excel file">Excel</button> : null}</span> : null}
    <button type="button" onClick={async () => { if (await copyText(m.text.replace(/<<<[\s\S]*$/, ''))) { setCopied(true); setTimeout(() => setCopied(false), 1500) } }} aria-label="Copy the answer" title="Copy">{copied ? Icon.check : Icon.copy}</button>
    <button type="button" aria-pressed={m.rating === 1} onClick={() => send(m.rating === 1 ? 0 : 1)} aria-label="Good answer" title="Good answer">{Icon.up}</button>
    <button type="button" aria-pressed={m.rating === -1} onClick={down} aria-label="Bad answer" title="Bad answer">{Icon.down}</button>
    {asking ? <form className="fb-why" onSubmit={(e) => { e.preventDefault(); if (note.trim()) send(-1, note.trim()); else setAsking(false) }}>
      <input className="input" autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} placeholder="What was wrong? Olex AI will remember it (optional)" aria-label="What was wrong" />
      <button type="submit" className="btn btn-line">{note.trim() ? 'Save' : 'Skip'}</button>
    </form> : null}
  </div>)
}
