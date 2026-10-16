// Speech to text for Olex AI. Whisper on Groq first (fast, free tier), Whisper on Cloudflare Workers AI as the backup.
// The audio is sent to the provider, turned into text, and not stored anywhere by Olexweb.
import 'server-only'
import { Busy } from './llm'

const TIMEOUT = 45_000
const groqReady = () => !!process.env.GROQ_API_KEY
const cloudflareReady = () => !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_AI_TOKEN)
export const voiceReady = () => groqReady() || cloudflareReady()

async function timed(url, init) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), TIMEOUT)
  try { return await fetch(url, { ...init, cache: 'no-store', signal: ctl.signal }) } catch { return null } finally { clearTimeout(t) }
}
async function groq(file) {
  const fd = new FormData()
  fd.append('file', file, file.name || 'voice.webm'); fd.append('model', process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo')
  fd.append('response_format', 'json'); fd.append('temperature', '0')
  const r = await timed('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.GROQ_API_KEY }, body: fd })
  if (!r || r.status === 429 || r.status >= 500) return null                           // busy or out of free allowance: try the backup
  if (r.status === 401 || r.status === 403) throw new Error('Groq did not accept GROQ_API_KEY.')
  if (!r.ok) return null
  const j = await r.json().catch(() => null)
  return j && typeof j.text === 'string' ? { text: j.text.trim(), by: 'Whisper (Groq)' } : null
}
async function cloudflare(file) {
  const audio = Buffer.from(await file.arrayBuffer()).toString('base64')
  const r = await timed(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID)}/ai/run/@cf/openai/whisper-large-v3-turbo`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.CLOUDFLARE_AI_TOKEN }, body: JSON.stringify({ audio }) })
  if (!r || r.status === 429 || r.status >= 500) return null
  if (!r.ok) return null
  const j = await r.json().catch(() => null), text = j && j.result ? j.result.text : null
  return typeof text === 'string' ? { text: text.trim(), by: 'Whisper (Cloudflare)' } : null
}

export async function transcribe(file) {
  if (!voiceReady()) throw new Error('Voice needs GROQ_API_KEY (free from Groq), or the Cloudflare keys Olex AI already uses.')
  const tries = [groqReady() && groq, cloudflareReady() && cloudflare].filter(Boolean)
  for (const t of tries) { const out = await t(file); if (out) return out }
  throw new Busy('Voice is busy right now. Try again in a moment, or type your message.')
}
