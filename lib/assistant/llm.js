// The assistant's brain: Google's Gemini API (free tier). The key stays on the server.
// Only public material (site content, public web pages) is ever sent. Answers come back as strict JSON.
import 'server-only'
import { one, q } from '@/lib/admin/db'

const BASE = () => (process.env.ASSISTANT_GEMINI_BASE || 'https://generativelanguage.googleapis.com').replace(/\/$/, '')
export class Busy extends Error {}                         // the free daily limit was reached
const PREFER = [/^gemini-3\.8-flash$/, /^gemini-3\.\d+-flash$/, /^gemini-3\.\d+-flash-lite$/, /^gemini-\d+(\.\d+)?-flash$/, /^gemini-\d+(\.\d+)?-flash-lite$/]

// The models this key can use, best first. Cached for an hour.
async function candidates() {
  const c = globalThis.__olexModels
  if (c && Date.now() - c.at < 3600e3) return c.list
  const r = await fetch(BASE() + '/v1beta/models?pageSize=200', { cache: 'no-store', headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY || '' } })
  if (!r.ok) throw new Error('Gemini did not accept the API key (' + r.status + ').')
  const names = ((await r.json()).models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace(/^models\//, ''))
  const list = [...new Set(PREFER.flatMap((re) => names.filter((n) => re.test(n)).sort().reverse()))]
  if (!list.length) throw new Error('No suitable Gemini model is available for this key.')
  globalThis.__olexModels = { at: Date.now(), list }
  return list
}
export async function pickModel() { return process.env.GEMINI_MODEL || (await candidates())[0] }

const TIMEOUT = () => Number(process.env.ASSISTANT_GEMINI_TIMEOUT_MS) || 75_000
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// Ask for strict JSON. If the best model is busy (Google's "high demand") or doesn't answer in time, wait and retry once,
// then move to the next model the key can use. Only if every option fails does it say so, calmly.
// Which AI wrote an answer (shown with each draft).
const WROTE = new WeakMap()
export const writtenBy = (answer) => WROTE.get(answer) || null
const cloudflareReady = () => !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_AI_TOKEN)

export async function askJSON(args) {
  if (!process.env.GEMINI_API_KEY && !cloudflareReady()) throw new Error('The assistant needs GEMINI_API_KEY. See the setup steps.')
  let first = null
  if (process.env.GEMINI_API_KEY) {
    try { return await askGemini(args) } catch (e) { if (!(e instanceof Busy) || !cloudflareReady()) throw e; first = e }   // every Gemini option was busy
  }
  try { return await askCloudflare(args) }
  catch (e) { if (e instanceof Busy && first) throw new Busy('Gemini and the Cloudflare backup are both busy right now. This is temporary; the assistant will try again later.'); throw e }
}

// The backup: Cloudflare Workers AI (free: 10,000 neurons a day). Same instructions, same strict JSON, same checks afterwards.
const CF_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
async function askCloudflare({ system, prompt, schema, temperature = 0.6, maxTokens = 8192 }) {
  const base = (process.env.ASSISTANT_CF_BASE || 'https://api.cloudflare.com').replace(/\/$/, '')
  const body = JSON.stringify({ messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], temperature,
    max_tokens: Math.min(maxTokens, 6000),                                   // the default is only 256 tokens, which would cut articles off
    response_format: schema ? { type: 'json_schema', json_schema: schema } : { type: 'json_object' } })
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT())
    let r
    try { r = await fetch(`${base}/client/v4/accounts/${encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID)}/ai/run/${CF_MODEL}`, { cache: 'no-store', method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.CLOUDFLARE_AI_TOKEN }, body }) } catch { r = null } finally { clearTimeout(timer) }
    if (!r) throw new Busy('The Cloudflare backup didn’t answer in time.')
    if (r.status === 429) throw new Busy('The free daily allowance for the Cloudflare backup has been used. It resets tomorrow.')
    if (r.status >= 500) { if (attempt === 0) { await wait(Number(process.env.ASSISTANT_GEMINI_RETRY_MS) || 4000); continue } throw new Busy('The Cloudflare backup is busy right now.') }
    if (r.status === 401 || r.status === 403) throw new Error('Cloudflare did not accept the API token (' + r.status + '). Check CLOUDFLARE_AI_TOKEN.')
    if (!r.ok) throw new Error('Cloudflare returned an error (' + r.status + ').')
    const j = await r.json(), resp = j && j.result ? j.result.response : null
    try {
      const out = typeof resp === 'string' ? JSON.parse(resp.replace(/^```(?:json)?\s*|\s*```$/g, '')) : resp
      if (!out || typeof out !== 'object') throw new Error('empty')
      WROTE.set(out, 'Llama 3.3 (Cloudflare backup)'); await q('update assistant_settings set model = $1 where id = 1', ['cloudflare: llama-3.3-70b']).catch(() => {})
      return out
    } catch { if (attempt === 0) continue; throw new Error('The Cloudflare backup’s answer could not be read. Try again.') }
  }
  throw new Busy('The Cloudflare backup is busy right now.')
}

async function askGemini({ system, prompt, schema, temperature = 0.6, maxTokens = 8192 }) {
  const models = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : (await candidates()).slice(0, 3)
  const body = JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: 'application/json', ...(schema ? { responseJsonSchema: schema } : {}) } })
  let sawLimit = false
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT())
      let r
      try { r = await fetch(`${BASE()}/v1beta/models/${model}:generateContent`, { cache: 'no-store', method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY }, body }) }
      catch { r = null } finally { clearTimeout(timer) }
      if (!r) break                                                          // no answer in time: try the next model
      if (r.status === 503 || r.status === 500) { if (attempt === 0) { await wait(Number(process.env.ASSISTANT_GEMINI_RETRY_MS) || 4000); continue } break }
      if (r.status === 429) { sawLimit = true; break }                       // this model's free daily limit: try another
      if (r.status === 403 || r.status === 404) break                         // this model isn't available to this key
      if (!r.ok) throw new Error('Gemini returned an error (' + r.status + ').')
      const j = await r.json()
      const text = (((j.candidates || [])[0] || {}).content || {}).parts?.map((p) => p.text || '').join('') || ''
      try { const out = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')); WROTE.set(out, model.replace(/^gemini-/, 'Gemini ').replace(/-flash/, ' Flash').replace(/-lite/, '-Lite')); await q('update assistant_settings set model = $1 where id = 1', [model]).catch(() => {}); return out }
      catch { if (attempt === 0) continue; break }                            // an unreadable answer: ask once more
    }
  }
  throw new Busy(sawLimit ? 'The free daily limit for the assistant has been reached. It will continue after the limit resets.'
    : 'Gemini is very busy right now (Google reports high demand). This is temporary; the assistant will try again later.')
}
