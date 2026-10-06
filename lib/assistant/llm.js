// The assistant's brain: Google's Gemini API (free tier). The key stays on the server.
// Only public material (site content, public web pages) is ever sent. Answers come back as strict JSON.
import 'server-only'
import { one, q } from '@/lib/admin/db'

const BASE = () => (process.env.ASSISTANT_GEMINI_BASE || 'https://generativelanguage.googleapis.com').replace(/\/$/, '')
export class Busy extends Error {}                         // the free daily limit was reached
const PREFER = [/^gemini-3\.8-flash$/, /^gemini-3\.\d+-flash$/, /^gemini-3\.\d+-flash-lite$/, /^gemini-\d+(\.\d+)?-flash$/]

export async function pickModel(force = false) {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL
  const s = await one('select model from assistant_settings where id = 1')
  if (s && s.model && !force) return s.model
  const r = await fetch(BASE() + '/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY || '' } })
  if (!r.ok) throw new Error('Gemini did not accept the API key (' + r.status + ').')
  const names = ((await r.json()).models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace(/^models\//, ''))
  const pick = PREFER.map((re) => names.filter((n) => re.test(n)).sort().reverse()[0]).find(Boolean)
  if (!pick) throw new Error('No suitable Gemini model is available for this key.')
  await q('update assistant_settings set model = $1 where id = 1', [pick])
  return pick
}

export async function askJSON({ system, prompt, schema, temperature = 0.6, maxTokens = 8192 }) {
  if (!process.env.GEMINI_API_KEY) throw new Error('The assistant needs GEMINI_API_KEY. See the setup steps.')
  const model = await pickModel()
  const body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: 'application/json', ...(schema ? { responseJsonSchema: schema } : {}) } }
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 120_000)
  let r
  try { r = await fetch(`${BASE()}/v1beta/models/${model}:generateContent`, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY }, body: JSON.stringify(body) }) }
  catch { throw new Error('Gemini took too long to answer. Try again in a moment.') } finally { clearTimeout(timer) }
  if (r.status === 429) throw new Busy('The free daily limit for the assistant has been reached. It will continue after the limit resets.')
  if (r.status === 404) { await q('update assistant_settings set model = null where id = 1'); throw new Error('That Gemini model is no longer available. Try again; a new one will be picked.') }
  if (!r.ok) throw new Error('Gemini returned an error (' + r.status + ').')
  const j = await r.json()
  const text = (((j.candidates || [])[0] || {}).content || {}).parts?.map((p) => p.text || '').join('') || ''
  try { return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')) } catch { throw new Error('Gemini’s answer could not be read. Try again.') }
}
