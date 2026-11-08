// AI notes, run from Admin → Meetings in the host's browser: the recording's 5-minute audio pieces (kept on this device by
// recorder.js) go one at a time through the existing voice pool (/admin/api/transcribe, under 4 MB each), then the
// transcript goes to /admin/api/meetings, where Olex AI writes the notes. A piece that's done keeps its text, so a retry
// after a failure carries on where it stopped. The audio is deleted from the device once the notes are saved.
import { notesAudio, keepNotesText, dropNotesAudio } from './recorder'

export { notesAudio, dropNotesAudio }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
async function asJson(r) { const j = await r.json().catch(() => ({})); if (r.status === 401) { window.location.assign('/admin/login'); throw new Error('Sign in again.') } return j }

// where the work is done: the admin (olexweb.com/admin) or the Meet app (meet.olexweb.com), whichever page runs this
const ADMIN = { transcribe: '/admin/api/transcribe', notes: '/admin/api/meetings' }
export const MEET_ROUTES = { transcribe: '/api/meet/notes', notes: '/api/meet/notes' }
async function transcribePart(p, code, routes) {
  const ext = /mp4/.test(p.mime) ? 'm4a' : 'webm'
  for (let attempt = 0; attempt < 2; attempt++) {
    const fd = new FormData(); fd.append('audio', new File([p.blob], `part-${p.part + 1}.${ext}`, { type: p.mime })); fd.append('code', code); if (routes.who && routes.who.seat) { fd.append('as', routes.who.as); fd.append('seat', routes.who.seat) }
    let r = null
    try { r = await fetch(routes.transcribe, { method: 'POST', credentials: 'same-origin', body: fd }) } catch {}
    if (r && r.ok) { const j = await asJson(r); return String(j.text || '').trim() }
    const j = r ? await asJson(r) : {}
    if (attempt === 0 && (!r || r.status >= 500)) { await wait(3000); continue }        // busy or no connection: once more
    const e = new Error(j.error || 'Speech couldn’t be turned into text.'); e.busy = !r || r.status >= 500; e.limit = r && r.status === 402; throw e
  }
}

// onStep(text) reports progress in plain words. Returns { notes, by }.
export async function makeNotes(code, onStep = () => {}, routes = ADMIN) {
  const parts = (await notesAudio())[code] || []
  if (!parts.length) throw new Error('There’s no recording for this meeting on this device.')
  const recs = [...new Set(parts.map((p) => p.rec))]
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    if (typeof p.text === 'string') continue
    onStep(parts.length > 1 ? `Turning speech into text: part ${i + 1} of ${parts.length}…` : 'Turning speech into text…')
    try { p.text = await transcribePart(p, code, routes) } catch (e) {
      if (e.limit && parts.slice(0, i).some((x) => x.text)) { parts.length = i; break }        // past the free hour: notes from the hour so far
      const which = parts.length > 1 ? `Part ${i + 1} of ${parts.length}` : 'The recording'
      throw new Error(e.busy ? `${which} couldn’t be turned into text: the voice service is busy or unreachable. Try again in a moment; finished parts are kept.` : `${which}: ${e.message} Try again.`)
    }
    await keepNotesText(p).catch(() => {})
  }
  const transcript = recs.map((rec, i) => {
    const text = parts.filter((p) => p.rec === rec).map((p) => p.text).filter(Boolean).join('\n\n')
    return (recs.length > 1 ? `[Recording ${i + 1}]\n` : '') + text
  }).join('\n\n').trim()
  onStep('Writing the notes…')
  const r = await fetch(routes.notes, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'notes', code, transcript, ...(routes.who || {}) }) })
  const j = await asJson(r)
  if (!r.ok) throw new Error(j.error || 'The notes couldn’t be written. Try again.')
  await dropNotesAudio(code).catch(() => {})
  return { ...j, transcript }
}

export function notesText(title, n, at) {                           // for Copy and the .md download
  const L = [`# ${title}`, `Notes from ${new Date(at).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, '', n.summary]
  const sec = (h, items) => { if (items && items.length) L.push('', `## ${h}`, ...items) }
  sec('Main points', (n.points || []).map((x) => `- ${x}`))
  sec('Decisions', (n.decisions || []).map((x) => `- ${x}`))
  sec('Action items', (n.actions || []).map((a) => `- [ ] ${a.what}${a.who || a.when ? ` (${[a.who, a.when].filter(Boolean).join(', ')})` : ''}`))
  sec('Open questions', (n.questions || []).map((x) => `- ${x}`))
  return L.join('\n') + '\n'
}
export function download(name, text, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })), a = document.createElement('a')
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
