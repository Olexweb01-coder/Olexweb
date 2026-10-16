// Olex AI's provider pool: many free AI providers behind one door.
// Every provider with a key joins automatically. Each one finds its own models (so new model names need no code change),
// rests for a while when it hits a limit, and keeps a health record (speed, wins, failures) that the admin shows.
// Keys stay on the server. Only the prompt Olex AI builds is sent; lead contact details are never part of it.
import 'server-only'
import { q } from '@/lib/admin/db'

export class RateLimited extends Error { constructor(msg, ms) { super(msg); this.ms = ms } }
export class KeyRefused extends Error {}
export class Unavailable extends Error {}

// ---------- the providers (all speak the OpenAI chat format) ----------
// prefer: best-first patterns for each kind of work. quick = everyday chat; strong = code, long and careful work.
export const PROVIDERS = {
  groq: { label: 'Groq', env: 'GROQ_API_KEY', base: 'https://api.groq.com/openai/v1',
    prefer: { quick: [/^llama-3\.3-70b-versatile$/, /^openai\/gpt-oss-120b$/, /^meta-llama\/llama-4-maverick/, /^qwen\/qwen3-32b$/, /^llama-3\.1-8b-instant$/],
              strong: [/^openai\/gpt-oss-120b$/, /^moonshotai\/kimi-k2/, /^qwen\/qwen3-32b$/, /^llama-3\.3-70b-versatile$/] } },
  cerebras: { label: 'Cerebras', env: 'CEREBRAS_API_KEY', base: 'https://api.cerebras.ai/v1',
    prefer: { quick: [/^gpt-oss-120b$/, /^llama-3\.3-70b$/, /^qwen-3-235b.*instruct/, /^llama3\.1-8b$/],
              strong: [/^qwen-3-coder/, /^gpt-oss-120b$/, /^qwen-3-235b/, /^zai-glm/, /^llama-3\.3-70b$/] } },
  openrouter: { label: 'OpenRouter', env: 'OPENROUTER_API_KEY', base: 'https://openrouter.ai/api/v1', onlyFree: true,
    headers: { 'HTTP-Referer': 'https://olexweb.com', 'X-Title': 'Olex AI' },
    prefer: { quick: [/llama-3\.3-70b.*:free$/, /gpt-oss-120b:free$/, /gemma-3-27b.*:free$/, /mistral-small.*:free$/],
              strong: [/qwen3-coder.*:free$/, /deepseek-(chat|v3).*:free$/, /kimi-k2.*:free$/, /gpt-oss-120b:free$/, /deepseek-r1.*:free$/, /llama-3\.3-70b.*:free$/] } },
  mistral: { label: 'Mistral', env: 'MISTRAL_API_KEY', base: 'https://api.mistral.ai/v1',
    prefer: { quick: [/^mistral-small-latest$/, /^mistral-medium-latest$/],
              strong: [/^mistral-large-latest$/, /^mistral-medium-latest$/, /^magistral-medium-latest$/],
              code: [/^codestral-latest$/, /^devstral-medium/, /^mistral-large-latest$/] } },
  github: { label: 'GitHub Models', env: 'GITHUB_MODELS_TOKEN', base: 'https://models.github.ai/inference', models: 'https://models.github.ai/catalog/models',
    headers: { Accept: 'application/vnd.github+json' },
    prefer: { quick: [/^openai\/gpt-4\.1-mini$/, /^openai\/gpt-4o-mini$/],
              strong: [/^openai\/gpt-4\.1$/, /^openai\/gpt-4o$/, /^deepseek\/deepseek-v3/, /^meta\/llama-3\.3-70b/] } },
  nvidia: { label: 'NVIDIA', env: 'NVIDIA_API_KEY', base: 'https://integrate.api.nvidia.com/v1',
    prefer: { quick: [/^meta\/llama-3\.3-70b-instruct$/, /^openai\/gpt-oss-120b$/],
              strong: [/^qwen\/qwen3-coder/, /^deepseek-ai\/deepseek-v3/, /^openai\/gpt-oss-120b$/, /^moonshotai\/kimi-k2/, /^meta\/llama-3\.3-70b-instruct$/] } },
}
const keyOf = (id) => process.env[PROVIDERS[id].env]
const baseOf = (id) => (process.env['OLEX_BASE_' + id.toUpperCase()] || PROVIDERS[id].base).replace(/\/$/, '')   // only for local testing
export const hasKey = (id) => (id === 'gemini' ? !!process.env.GEMINI_API_KEY : id === 'cloudflare' ? !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_AI_TOKEN) : !!keyOf(id))
export const ALL = ['gemini', 'groq', 'cerebras', 'openrouter', 'mistral', 'github', 'nvidia', 'cloudflare']
export const LABEL = { gemini: 'Gemini', cloudflare: 'Cloudflare', ...Object.fromEntries(Object.entries(PROVIDERS).map(([k, v]) => [k, v.label])) }
export const anyProvider = () => ALL.some(hasKey)

// ---------- which kind of work a message is ----------
const CODE = /```|\b(code|coding|function|component|bug|error|stack ?trace|exception|regex|sql|query|script|typescript|javascript|python|react|next\.?js|css|html|api|endpoint|compile|refactor|debug)\b/i
export function kindOf(text) {
  const t = String(text || '')
  if (t.length > 12000) return 'long'
  if (CODE.test(t)) return 'code'
  return 'quick'
}
// Fastest first for chat; strongest first for code and long work. Gemini keeps its allowance for articles when chat is busy.
const ORDER = {
  quick: ['groq', 'cerebras', 'gemini', 'mistral', 'openrouter', 'github', 'nvidia', 'cloudflare'],
  code: ['cerebras', 'openrouter', 'gemini', 'nvidia', 'mistral', 'groq', 'github', 'cloudflare'],
  long: ['gemini', 'mistral', 'openrouter', 'nvidia', 'cerebras', 'groq', 'github', 'cloudflare'],
  write: ['gemini', 'mistral', 'openrouter', 'cerebras', 'nvidia', 'groq', 'github', 'cloudflare'],
}
export async function lineup(kind = 'quick', { spareGemini = false } = {}) {
  let list = (ORDER[kind] || ORDER.quick).filter(hasKey)
  if (spareGemini) list = [...list.filter((x) => x !== 'gemini' && x !== 'cloudflare'), ...list.filter((x) => x === 'gemini' || x === 'cloudflare')]
  const resting = await restingNow()
  const ready = list.filter((x) => !resting.has(x))
  return ready.length ? ready : list                                         // if everything is resting, try anyway
}

// ---------- each provider's models, found automatically (cached 6 hours) ----------
async function modelIds(id) {
  const cache = (globalThis.__olexPoolModels ||= {})
  if (cache[id] && Date.now() - cache[id].at < 6 * 3600e3) return cache[id].ids
  const p = PROVIDERS[id]
  const url = process.env['OLEX_BASE_' + id.toUpperCase()] ? baseOf(id) + '/models' : (p.models || baseOf(id) + '/models')
  const r = await timed(url, { headers: { Authorization: 'Bearer ' + keyOf(id), ...(p.headers || {}) } }, 15000)
  if (!r) throw new Unavailable(p.label + ' didn’t answer.')
  if (r.status === 401 || r.status === 403) throw new KeyRefused(p.label + ' did not accept ' + p.env + '.')
  if (r.status === 429) throw new RateLimited(p.label + ' is at its limit.', retryMs(r))
  if (!r.ok) throw new Unavailable(p.label + ' returned ' + r.status + '.')
  const j = await r.json().catch(() => null)
  const rows = Array.isArray(j) ? j : (j && (j.data || j.models)) || []
  const ids = rows.map((m) => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean)
  cache[id] = { at: Date.now(), ids }
  return ids
}
export const forgetModels = (id) => { if (globalThis.__olexPoolModels) delete globalThis.__olexPoolModels[id] }
export async function modelsFor(id, kind) {
  const p = PROVIDERS[id], set = kind === 'quick' ? 'quick' : (kind === 'code' && p.prefer.code ? 'code' : 'strong')
  const forced = process.env[p.env.replace(/_(API_KEY|TOKEN)$/, '') + (set === 'quick' ? '_MODEL' : '_MODEL_STRONG')]
  if (forced) return [forced]
  let ids = await modelIds(id)
  if (p.onlyFree) ids = ids.filter((m) => /:free$/.test(m))
  const picked = [...new Set(p.prefer[set].flatMap((re) => ids.filter((m) => re.test(m)).sort()))]
  if (!picked.length && p.onlyFree) return ids.slice(0, 2)                  // any free model rather than none
  if (!picked.length) { const other = p.prefer[set === 'quick' ? 'strong' : 'quick']; return [...new Set(other.flatMap((re) => ids.filter((m) => re.test(m))))].slice(0, 2) }
  return picked.slice(0, 2)
}

// ---------- one provider, streamed ----------
function retryMs(r) {
  const s = Number(r.headers.get('retry-after')); if (s > 0) return Math.min(s * 1000, 24 * 3600e3)
  const reset = r.headers.get('x-ratelimit-reset-requests') || r.headers.get('x-ratelimit-reset'); const m = reset && /^(\d+(?:\.\d+)?)s$/.exec(reset)
  return m ? Number(m[1]) * 1000 : 60_000
}
async function timed(url, init, ms) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms)
  if (init.signal) init.signal.addEventListener('abort', () => ctl.abort(), { once: true })
  try { return await fetch(url, { ...init, cache: 'no-store', signal: ctl.signal }) } catch { return null } finally { clearTimeout(t) }
}
export async function* sseData(res) {
  const reader = res.body.getReader(), dec = new TextDecoder(); let buf = ''
  for (;;) {
    const { done, value } = await reader.read(); if (done) break
    buf += dec.decode(value, { stream: true }); let i
    while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line.startsWith('data:')) yield line.slice(5).trim() }
  }
  if (buf.trim().startsWith('data:')) yield buf.trim().slice(5).trim()
}
// Some models think out loud inside <think>…</think>. That's never shown.
export function thinkFilter() {
  let inside = false, hold = ''
  return (chunk) => {
    let s = hold + chunk, out = ''; hold = ''
    for (;;) {
      if (inside) { const j = s.indexOf('</think>'); if (j < 0) { hold = s.slice(-8); return out } s = s.slice(j + 8); inside = false; continue }
      const i = s.indexOf('<think>'); if (i < 0) { const k = s.lastIndexOf('<'); if (k >= 0 && s.length - k < 7 && '<think>'.startsWith(s.slice(k))) { hold = s.slice(k); s = s.slice(0, k) } return out + s }
      out += s.slice(0, i); s = s.slice(i + 7); inside = true
    }
  }
}

// Streams one answer from an OpenAI-format provider. meta.model is set to the model that answered.
export async function* streamOpenAI(id, { system, prompt, temperature = 0.6, maxTokens = 4096, kind = 'quick', json = false, signal, meta = {} }) {
  const p = PROVIDERS[id], models = await modelsFor(id, kind)
  if (!models.length) throw new Unavailable(p.label + ' has no suitable model for this key.')
  let limited = null
  for (const model of models) {
    if (signal && signal.aborted) return
    const body = { model, stream: true, temperature, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], ...(json ? { response_format: { type: 'json_object' } } : {}) }
    const r = await timed(baseOf(id) + '/chat/completions', { method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + keyOf(id), ...(p.headers || {}) }, body: JSON.stringify(body) }, 90_000)
    if (!r) { if (signal && signal.aborted) return; continue }
    if (r.status === 401 || r.status === 403) throw new KeyRefused(p.label + ' did not accept ' + p.env + '.')
    if (r.status === 429) { limited = new RateLimited(p.label + ' is at its free limit.', retryMs(r)); continue }
    if (r.status === 404 || r.status === 400 || r.status === 422) { forgetModels(id); continue }   // that model is gone or refused the request: next model
    if (!r.ok) continue
    meta.model = model
    const strip = thinkFilter()
    for await (const data of sseData(r)) {
      if (data === '[DONE]') break
      let j; try { j = JSON.parse(data) } catch { continue }
      if (j.error) throw new Unavailable(p.label + ': ' + (j.error.message || 'error'))
      const d = j.choices && j.choices[0] && j.choices[0].delta
      const t = d && typeof d.content === 'string' ? strip(d.content) : ''
      if (t) yield t
    }
    return
  }
  if (limited) throw limited
  throw new Unavailable(p.label + ' is busy right now.')
}

// ---------- health: who is resting, how fast each one is ----------
let ensured = false
async function ensure() {
  if (ensured) return
  await q(`create table if not exists ai_providers (id text primary key, rest_until timestamptz, last_error text, wins int not null default 0, fails int not null default 0,
    avg_first_ms int, last_ok timestamptz, last_model text, updated_at timestamptz not null default now())`)
  ensured = true
}
async function restingNow() {
  const c = globalThis.__olexResting
  if (c && Date.now() - c.at < 15_000) return c.set
  let set = new Set()
  try { await ensure(); set = new Set((await q('select id from ai_providers where rest_until > now()')).rows.map((r) => r.id)) } catch {}
  globalThis.__olexResting = { at: Date.now(), set }
  return set
}
export async function rest(id, ms, why) {
  try { await ensure(); await q(`insert into ai_providers (id, rest_until, last_error, fails) values ($1, now() + make_interval(secs => $2), $3, 1)
    on conflict (id) do update set rest_until = excluded.rest_until, last_error = excluded.last_error, fails = ai_providers.fails + 1, updated_at = now()`, [id, Math.round(ms / 1000), String(why || '').slice(0, 200)]) } catch {}
  globalThis.__olexResting = null
}
export async function failed(id, why) {
  try { await ensure(); await q(`insert into ai_providers (id, last_error, fails) values ($1, $2, 1) on conflict (id) do update set last_error = excluded.last_error, fails = ai_providers.fails + 1, updated_at = now()`, [id, String(why || '').slice(0, 200)]) } catch {}
}
export async function won(id, firstMs, model) {
  try { await ensure(); await q(`insert into ai_providers (id, wins, avg_first_ms, last_ok, last_model, last_error) values ($1, 1, $2, now(), $3, null)
    on conflict (id) do update set wins = ai_providers.wins + 1, avg_first_ms = case when ai_providers.avg_first_ms is null then excluded.avg_first_ms else round(ai_providers.avg_first_ms * 0.8 + excluded.avg_first_ms * 0.2) end,
      last_ok = now(), last_model = excluded.last_model, last_error = null, rest_until = null, updated_at = now()`, [id, Math.round(firstMs), model || null]) } catch {}
}
// What happened to a provider that failed: how long it rests.
export async function noteFailure(id, e) {
  if (e instanceof RateLimited) return rest(id, Math.max(e.ms || 60_000, 30_000), e.message)
  if (e instanceof KeyRefused) return rest(id, 6 * 3600e3, e.message)
  return rest(id, 2 * 60_000, e && e.message)
}
export async function status() {
  let rows = []
  try { await ensure(); rows = (await q('select id, rest_until, last_error, wins, fails, avg_first_ms, last_ok, last_model from ai_providers')).rows } catch {}
  const by = Object.fromEntries(rows.map((r) => [r.id, r]))
  return ALL.map((id) => {
    const r = by[id] || {}, key = hasKey(id), resting = r.rest_until && new Date(r.rest_until) > new Date()
    return { id, label: LABEL[id], env: id === 'gemini' ? 'GEMINI_API_KEY' : id === 'cloudflare' ? 'CLOUDFLARE_AI_TOKEN' : PROVIDERS[id].env, key,
      state: !key ? 'no key' : resting ? 'resting' : r.last_ok ? 'ready' : 'not used yet',
      restUntil: resting ? new Date(r.rest_until).toISOString() : null, lastError: r.last_error || null, wins: r.wins || 0, fails: r.fails || 0,
      firstMs: r.avg_first_ms || null, model: r.last_model || null }
  })
}
