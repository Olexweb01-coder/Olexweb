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
  if (args.prefer === 'cloudflare' && cloudflareReady()) {             // chat past its daily share: keep Gemini's allowance for the writer
    try { return await askCloudflare(args) } catch (e) { if (!(e instanceof Busy) || !process.env.GEMINI_API_KEY) throw e }
    return askGemini(args)
  }
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

// ---------- Chat: answers streamed word by word, with a race ----------
// Gemini starts first (low thinking, for speed). If no words arrive within hedgeMs, the Cloudflare backup starts too,
// and whichever writes first wins; the other is stopped. A busy Gemini model moves straight to the next one.
const HEDGE = () => Number(process.env.ASSISTANT_HEDGE_MS) || 8000
const CHAT_LIMIT = () => Number(process.env.ASSISTANT_CHAT_TIMEOUT_MS) || 60000
const thinkingFor = (model) => (/^gemini-3/.test(model) ? { thinkingLevel: 'LOW' } : /^gemini-2\.5/.test(model) ? { thinkingBudget: 0 } : undefined)
async function* sse(res) {                                             // yields each "data:" payload of a server-sent stream
  const reader = res.body.getReader(), dec = new TextDecoder(); let buf = ''
  for (;;) {
    const { done, value } = await reader.read(); if (done) break
    buf += dec.decode(value, { stream: true }); let i
    while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line.startsWith('data:')) yield line.slice(5).trim() }
  }
  if (buf.trim().startsWith('data:')) yield buf.trim().slice(5).trim()
}

export async function streamText({ system, prompt, temperature = 0.6, maxTokens = 4096, prefer, onDelta = () => {} }) {
  const geminiOk = !!process.env.GEMINI_API_KEY, cfOk = cloudflareReady()
  if (!geminiOk && !cfOk) throw new Error('Olex AI needs GEMINI_API_KEY. See the setup steps.')
  let winner = null, text = '', sawLimit = false
  const ctl = { gemini: new AbortController(), cf: new AbortController() }
  const stopAll = setTimeout(() => { ctl.gemini.abort(); ctl.cf.abort() }, CHAT_LIMIT())
  const deliver = (who, label, chunk) => {
    if (!chunk) return
    if (!winner) { winner = { who, label }; (who === 'gemini' ? ctl.cf : ctl.gemini).abort() }   // first words win; stop the other
    if (winner.who === who) { text += chunk; onDelta(chunk) }
  }
  async function gemini() {
    const models = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : (await candidates()).slice(0, 3)
    for (const model of models) {
      if (ctl.gemini.signal.aborted) return false
      const gen = { temperature, maxOutputTokens: maxTokens, ...(thinkingFor(model) ? { thinkingConfig: thinkingFor(model) } : {}) }
      let r
      try { r = await fetch(`${BASE()}/v1beta/models/${model}:streamGenerateContent?alt=sse`, { method: 'POST', cache: 'no-store', signal: ctl.gemini.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: gen }) }) } catch { return false }
      if (r.status === 429) { sawLimit = true; continue }
      if (!r.ok) continue                                               // busy, unavailable or refused: next model, straight away
      let got = false
      try { for await (const data of sse(r)) { let j; try { j = JSON.parse(data) } catch { continue }
        const t = (((j.candidates || [])[0] || {}).content || {}).parts?.map((p) => (p.thought ? '' : p.text || '')).join('') || ''
        if (t) { got = true; deliver('gemini', model, t) } } } catch { return got && winner && winner.who === 'gemini' }
      if (got) { await q('update assistant_settings set model = $1 where id = 1', [model]).catch(() => {}); return true }
    }
    return false
  }
  async function cloudflare() {
    const base = (process.env.ASSISTANT_CF_BASE || 'https://api.cloudflare.com').replace(/\/$/, '')
    let r
    try { r = await fetch(`${base}/client/v4/accounts/${encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID)}/ai/run/${CF_MODEL}`, { method: 'POST', cache: 'no-store', signal: ctl.cf.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.CLOUDFLARE_AI_TOKEN },
      body: JSON.stringify({ messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], temperature, max_tokens: Math.min(maxTokens, 6000), stream: true }) }) } catch { return false }
    if (r.status === 429) { sawLimit = true; return false }
    if (!r.ok) return false
    let got = false
    try { for await (const data of sse(r)) { if (data === '[DONE]') break; let j; try { j = JSON.parse(data) } catch { continue }
      if (j.response) { got = true; deliver('cf', 'Llama 3.3 (Cloudflare backup)', j.response) } } } catch {}
    return got
  }
  try {
    let gRun = null, cRun = null
    const startCf = () => { if (cfOk && !cRun) cRun = cloudflare() }
    if (prefer === 'cloudflare' && cfOk) { const ok = await cloudflare(); if (ok) return finish() ; if (geminiOk) gRun = gemini() }
    else if (geminiOk) {
      gRun = gemini()
      const hedge = setTimeout(() => { if (!winner) startCf() }, HEDGE())
      gRun.then((ok) => { clearTimeout(hedge); if (!ok && !winner) startCf() })
    } else startCf()
    // wait until the winner finishes, or every runner has given up
    for (;;) {                                                         // wait for EVERY runner that started (the winner too, to the last word)
      const before = [gRun, cRun].filter(Boolean)
      await Promise.all(before)
      if ([gRun, cRun].filter(Boolean).length === before.length) break   // nothing new started while waiting: all finished
    }
    if (!winner) throw new Busy(sawLimit ? 'The free daily limits for Olex AI have been reached. It will continue after they reset.' : 'Gemini and the Cloudflare backup are both busy right now. This is temporary; try again in a moment.')
    return finish()
  } finally { clearTimeout(stopAll) }
  function finish() { return { text, writtenBy: winner.who === 'gemini' ? winner.label.replace(/^gemini-/, 'Gemini ').replace(/-flash/, ' Flash') : winner.label } }
}
