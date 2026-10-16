// Speech to text for Olex AI. Tried in order, first answer wins:
// Whisper on Groq (fastest) → Gemini (your existing key) → Deepgram (if you add a key) → Whisper on Cloudflare.
// The audio is sent to the provider, turned into text, and not stored anywhere by Olexweb.
import 'server-only'
import { Busy } from './llm'

const TIMEOUT = 30_000
const has = { groq: () => !!process.env.GROQ_API_KEY, gemini: () => !!process.env.GEMINI_API_KEY, deepgram: () => !!process.env.DEEPGRAM_API_KEY,
  cloudflare: () => !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_AI_TOKEN) }
export const voiceReady = () => Object.values(has).some((f) => f())

async function timed(url, init) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), TIMEOUT)
  try { return await fetch(url, { ...init, cache: 'no-store', signal: ctl.signal }) } catch (e) { return { ok: false, status: 0, text: async () => String(e && e.name === 'AbortError' ? 'timed out' : 'no connection') } } finally { clearTimeout(t) }
}
const why = async (r) => { const t = await r.text().catch(() => ''); let m = t; try { const j = JSON.parse(t); m = (j.error && (j.error.message || j.error)) || j.message || j.err_msg || t } catch {} return `${r.status || ''} ${String(m).slice(0, 160)}`.trim() }
const mimeOf = (file) => String(file.type || 'audio/webm').split(';')[0]

async function groq(file) {
  const fd = new FormData()
  const name = /mp4|m4a|aac/.test(file.type) ? 'voice.m4a' : /ogg/.test(file.type) ? 'voice.ogg' : 'voice.webm'
  fd.append('file', new Blob([await file.arrayBuffer()], { type: mimeOf(file) }), name)
  fd.append('model', process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo'); fd.append('response_format', 'json'); fd.append('temperature', '0')
  const r = await timed('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.GROQ_API_KEY }, body: fd })
  if (!r.ok) throw new Error('Groq: ' + await why(r))
  const j = await r.json(); return { text: String(j.text || '').trim(), by: 'Whisper (Groq)' }
}
async function gemini(file) {
  const { pickModel } = await import('./llm')
  const model = process.env.GEMINI_VOICE_MODEL || await pickModel()
  const base = (process.env.ASSISTANT_GEMINI_BASE || 'https://generativelanguage.googleapis.com').replace(/\/$/, '')
  const r = await timed(`${base}/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mimeOf(file), data: Buffer.from(await file.arrayBuffer()).toString('base64') } },
      { text: 'Transcribe this voice note exactly as spoken, in the language spoken. Reply with only the words, no notes or labels. If nothing is said, reply with nothing.' }] }],
      generationConfig: { temperature: 0, ...(/^gemini-3/.test(model) ? { thinkingConfig: { thinkingLevel: 'LOW' } } : /^gemini-2\.5/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}) } }) })
  if (!r.ok) throw new Error('Gemini: ' + await why(r))
  const j = await r.json(), t = (((j.candidates || [])[0] || {}).content || {}).parts?.map((p) => (p.thought ? '' : p.text || '')).join('') || ''
  return { text: t.trim(), by: 'Gemini' }
}
async function deepgram(file) {
  const r = await timed('https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&detect_language=true', { method: 'POST', headers: { Authorization: 'Token ' + process.env.DEEPGRAM_API_KEY, 'Content-Type': mimeOf(file) }, body: Buffer.from(await file.arrayBuffer()) })
  if (!r.ok) throw new Error('Deepgram: ' + await why(r))
  const j = await r.json(); return { text: String(j?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '').trim(), by: 'Deepgram' }
}
async function cloudflare(file) {
  const r = await timed(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID)}/ai/run/@cf/openai/whisper-large-v3-turbo`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.CLOUDFLARE_AI_TOKEN }, body: JSON.stringify({ audio: Buffer.from(await file.arrayBuffer()).toString('base64') }) })
  if (!r.ok) throw new Error('Cloudflare: ' + await why(r))
  const j = await r.json(); return { text: String((j.result && j.result.text) || '').trim(), by: 'Whisper (Cloudflare)' }
}

export async function transcribe(file) {
  if (!voiceReady()) throw new Error('Voice needs GROQ_API_KEY or GEMINI_API_KEY.')
  const tries = [has.groq() && groq, has.gemini() && gemini, has.deepgram() && deepgram, has.cloudflare() && cloudflare].filter(Boolean), errors = []
  for (const t of tries) {
    try { const out = await t(file); if (out.text || t === tries[tries.length - 1]) return out; errors.push(out.by + ': heard nothing') }
    catch (e) { errors.push(e.message) }
  }
  console.error('voice: every provider failed', errors)
  const e = new Busy('Voice couldn’t be turned into text. ' + errors.join(' · ')); e.details = errors; throw e
}
