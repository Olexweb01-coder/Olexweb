// Olex AI's brain: a pool of free AI providers (see pool.js) with Gemini and the Cloudflare backup.
// Keys stay on the server. Only the prompt Olex AI builds is sent (site content, public pages, your message).
import 'server-only'
import { one, q } from '@/lib/admin/db'
import { lineup, streamOpenAI, sseData, thinkFilter, noteFailure, won, failed, RateLimited, KeyRefused, Unavailable, LABEL, anyProvider, hasKey } from './pool'

const BASE = () => (process.env.ASSISTANT_GEMINI_BASE || 'https://generativelanguage.googleapis.com').replace(/\/$/, '')
export class Busy extends Error {}                         // the free daily limit was reached
const PREFER = [/^gemini-3\.8-flash$/, /^gemini-3\.\d+-flash$/, /^gemini-3\.\d+-flash-lite$/, /^gemini-\d+(\.\d+)?-flash$/, /^gemini-\d+(\.\d+)?-flash-lite$/]

// The models this key can use, best first. Cached for an hour.
async function candidates() {
  const c = globalThis.__olexModels
  if (c && Date.now() - c.at < 3600e3) return c.list
  const r = await fetch(BASE() + '/v1beta/models?pageSize=200', { cache: 'no-store', headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY || '' } })
  if ([400, 401, 403].includes(r.status)) throw new KeyRefused('Gemini did not accept GEMINI_API_KEY (' + r.status + ').')
  if (!r.ok) throw new Unavailable('Gemini returned ' + r.status + '.')
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
  if (!anyProvider()) throw new Error('Olex AI needs at least one AI key, such as GEMINI_API_KEY. See the setup steps.')
  const order = await lineup(args.kind || 'write', { spareGemini: args.prefer === 'cloudflare' })
  let lastBusy = null
  for (const id of order) {
    try {
      if (id === 'gemini') return await askGemini(args)
      if (id === 'cloudflare') return await askCloudflare(args)
      return await askPoolJSON(id, args)
    } catch (e) {
      if (e instanceof Busy || e instanceof RateLimited || e instanceof Unavailable || e instanceof KeyRefused) { lastBusy = e; if (!(e instanceof Busy)) await noteFailure(id, e); continue }
      if (id === 'gemini' || id === 'cloudflare') { lastBusy = e; await failed(id, e.message); continue }   // a refused key: the next provider can still help
      throw e
    }
  }
  throw new Busy(lastBusy && !(lastBusy instanceof Busy) ? 'Every connected AI is busy or at its free limit right now. Olex AI will try again later.' : (lastBusy ? lastBusy.message : 'No AI answered.'))
}
// Any pool provider, asked for one JSON object (the same checks run on its answer afterwards).
async function askPoolJSON(id, { system, prompt, schema, temperature = 0.6, maxTokens = 8192, kind }) {
  const meta = {}, t0 = Date.now()
  const sys = system + (schema ? '\n\nReply with ONE JSON object only, no other text, matching this JSON schema:\n' + JSON.stringify(schema) : '\n\nReply with ONE JSON object only, no other text.')
  for (let attempt = 0; attempt < 2; attempt++) {
    let text = ''
    for await (const t of streamOpenAI(id, { system: sys, prompt, temperature, maxTokens: Math.min(maxTokens, 8192), kind: kind === 'quick' ? 'quick' : 'long', json: true, meta })) text += t
    const raw = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    try { const out = JSON.parse(raw); if (out && typeof out === 'object') { WROTE.set(out, `${LABEL[id]}: ${meta.model}`); await won(id, Date.now() - t0, meta.model); return out } } catch {}
  }
  throw new Unavailable(LABEL[id] + '’s answer could not be read.')
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

// ---------- Chat: answers streamed word by word, raced across the pool ----------
// The fastest suitable provider starts first. If no words arrive within the hedge time, the next one starts too,
// and whichever writes first wins (the others stop). A provider that fails moves straight on to the next.
const HEDGE = (kind) => Number(process.env.ASSISTANT_HEDGE_MS) || (kind === 'quick' ? 3500 : 7000)
const CHAT_LIMIT = () => Number(process.env.ASSISTANT_CHAT_TIMEOUT_MS) || 60000
const thinkingFor = (model) => (/^gemini-3/.test(model) ? { thinkingLevel: 'LOW' } : /^gemini-2\.5/.test(model) ? { thinkingBudget: 0 } : undefined)

async function* streamGemini({ system, prompt, temperature, maxTokens, signal, meta }) {
  const models = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : (await candidates()).slice(0, 3)
  let limited = false
  for (const model of models) {
    if (signal.aborted) return
    const gen = { temperature, maxOutputTokens: maxTokens, ...(thinkingFor(model) ? { thinkingConfig: thinkingFor(model) } : {}) }
    let r
    try { r = await fetch(`${BASE()}/v1beta/models/${model}:streamGenerateContent?alt=sse`, { method: 'POST', cache: 'no-store', signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: gen }) }) } catch { if (signal.aborted) return; continue }
    if (r.status === 429) { limited = true; continue }
    if (r.status === 400 || r.status === 401 || r.status === 403) { if (r.status !== 400 || /API key/i.test(await r.text().catch(() => ''))) throw new KeyRefused('Gemini did not accept GEMINI_API_KEY.'); continue }
    if (!r.ok) continue
    meta.model = model
    let got = false
    for await (const data of sseData(r)) { let j; try { j = JSON.parse(data) } catch { continue }
      const t = (((j.candidates || [])[0] || {}).content || {}).parts?.map((p) => (p.thought ? '' : p.text || '')).join('') || ''
      if (t) { got = true; yield t } }
    if (got) { q('update assistant_settings set model = $1 where id = 1', [model]).catch(() => {}); return }
  }
  if (limited) throw new RateLimited('Gemini is at its free daily limit.', 3600e3)
  throw new Unavailable('Gemini is busy right now.')
}
async function* streamCloudflare({ system, prompt, temperature, maxTokens, signal, meta }) {
  const base = (process.env.ASSISTANT_CF_BASE || 'https://api.cloudflare.com').replace(/\/$/, '')
  let r
  try { r = await fetch(`${base}/client/v4/accounts/${encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID)}/ai/run/${CF_MODEL}`, { method: 'POST', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.CLOUDFLARE_AI_TOKEN },
    body: JSON.stringify({ messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], temperature, max_tokens: Math.min(maxTokens, 6000), stream: true }) }) } catch { if (signal.aborted) return; throw new Unavailable('Cloudflare didn’t answer.') }
  if (r.status === 429) throw new RateLimited('Cloudflare’s free daily allowance is used up.', 3 * 3600e3)
  if (r.status === 401 || r.status === 403) throw new KeyRefused('Cloudflare did not accept CLOUDFLARE_AI_TOKEN.')
  if (!r.ok) throw new Unavailable('Cloudflare is busy right now.')
  meta.model = 'llama-3.3-70b'
  const strip = thinkFilter()
  for await (const data of sseData(r)) { if (data === '[DONE]') break; let j; try { j = JSON.parse(data) } catch { continue }
    const t = typeof j.response === 'string' ? strip(j.response) : ''; if (t) yield t }
}
const adapter = (id) => (id === 'gemini' ? streamGemini : id === 'cloudflare' ? streamCloudflare : (args) => streamOpenAI(id, args))
const nameOf = (id, model) => (id === 'gemini' ? (model || 'gemini').replace(/^gemini-/, 'Gemini ').replace(/-flash/, ' Flash').replace(/-lite/, '-Lite') : id === 'cloudflare' ? 'Llama 3.3 (Cloudflare)' : `${LABEL[id]}: ${model}`)

// kind: 'quick' | 'code' | 'long'. spareGemini: keep Gemini for articles (it moves to the back of the line).
export async function streamText({ system, prompt, temperature = 0.6, maxTokens = 4096, kind = 'quick', spareGemini = false, prefer, onDelta = () => {} }) {
  if (!anyProvider()) throw new Error('Olex AI needs at least one AI key, such as GEMINI_API_KEY. See the setup steps.')
  const order = await lineup(kind, { spareGemini: spareGemini || prefer === 'cloudflare' })
  return new Promise((resolve, reject) => {
    let winner = null, text = '', next = 0, settled = false, sawLimit = false
    const runs = new Map()
    const done = (fn) => { if (settled) return; settled = true; clearTimeout(stopAll); for (const r of runs.values()) { r.ctl.abort(); clearTimeout(r.hedge) } fn() }
    const stopAll = setTimeout(() => done(() => (text ? resolve({ text, writtenBy: nameOf(winner.id, winner.meta.model), partial: true }) : reject(new Busy('No AI answered in time. Try again in a moment.')))), CHAT_LIMIT())
    const giveUp = () => { if (!winner && !runs.size && next >= order.length) done(() => reject(new Busy(sawLimit ? 'Every connected AI is at its free limit right now. Add another free provider in Vercel, or try again later.' : 'Every connected AI is busy right now. This is temporary; try again in a moment.'))) }
    function start() {
      if (settled || winner || next >= order.length) return giveUp()
      const id = order[next++], ctl = new AbortController(), meta = {}, t0 = Date.now()
      const run = { ctl, meta, hedge: setTimeout(() => { if (!winner) start() }, HEDGE(kind)) }
      runs.set(id, run)
      ;(async () => {
        let got = false
        try {
          for await (const chunk of adapter(id)({ system, prompt, temperature, maxTokens, kind, signal: ctl.signal, meta })) {
            if (settled) return
            if (!winner) { winner = { id, meta }; clearTimeout(run.hedge); for (const [k, r] of runs) if (k !== id) { r.ctl.abort(); clearTimeout(r.hedge) } won(id, Date.now() - t0, meta.model) }
            if (winner.id !== id) return
            got = true; text += chunk; onDelta(chunk)
          }
          if (winner && winner.id === id) return done(() => resolve({ text, writtenBy: nameOf(id, meta.model) }))
          if (!got && !ctl.signal.aborted) await failed(id, 'Answered with nothing.')
        } catch (e) {
          if (e instanceof RateLimited) sawLimit = true
          if (!ctl.signal.aborted) await noteFailure(id, e)
          if (winner && winner.id === id) return done(() => (text ? resolve({ text, writtenBy: nameOf(id, meta.model), partial: true }) : reject(new Busy(e.message))))
        } finally {
          clearTimeout(run.hedge); runs.delete(id)
          if (!winner && !settled) { if (next < order.length) start(); else giveUp() }
        }
      })()
    }
    start()
  })
}
