// Olex AI's memory. The AI models themselves never change; Olex AI gets better by remembering:
// 1. Lessons: corrections and lasting preferences ("never use that word", "I code in TypeScript"), saved automatically
//    when it notices them, or added by you on the Memory page. They go with every message.
// 2. Feedback: thumbs up and down on answers. A thumbs down with a reason becomes a lesson; answers you liked are
//    shown to it as examples when you ask something similar; each provider's approval rate shapes who answers first.
// Everything it has learned is on the Memory page, where you can edit, switch off or delete it.
import 'server-only'
import { q, one } from '@/lib/admin/db'

export const KINDS = { rule: 'Rules', preference: 'Preferences', fact: 'About you and the business', code: 'Coding' }
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
const SECRET = /(api[_ -]?key|password|passcode|secret|token|otp|pin\b|sk-|gsk_|AIza|bearer\s)/i
const CONTACT = /[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s().-]{7,}\d/

let ready = false
export async function ensureMemory() {
  if (ready) return
  await q(`create table if not exists ai_memory (id serial primary key, kind text not null default 'rule', text text not null, source text not null default 'chat',
    active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`)
  await q('alter table assistant_messages add column if not exists rating smallint')
  await q('alter table assistant_messages add column if not exists feedback text')
  await q('alter table assistant_messages add column if not exists memory jsonb')
  await q('alter table ai_providers add column if not exists ups int not null default 0').catch(() => {})
  await q('alter table ai_providers add column if not exists downs int not null default 0').catch(() => {})
  ready = true
}

// ---------- lessons ----------
export function cleanLesson(kind, text) {
  const t = clip(String(text || '').replace(/<<<|>>>/g, ''), 300)
  if (t.length < 4) return null
  if (SECRET.test(t) || CONTACT.test(t)) return null                    // never store keys, passwords or contact details
  return { kind: KINDS[kind] ? kind : 'rule', text: t }
}
export async function addLesson(kind, text, source = 'chat') {
  await ensureMemory()
  const l = cleanLesson(kind, text); if (!l) return null
  const same = await one('select id from ai_memory where lower(text) = lower($1)', [l.text])
  if (same) { await q('update ai_memory set active = true, updated_at = now() where id = $1', [same.id]); return { id: same.id, ...l, existed: true } }
  const r = await one('insert into ai_memory (kind, text, source) values ($1, $2, $3) returning id', [l.kind, l.text, source])
  return { id: r.id, ...l }
}
export async function listLessons() {
  await ensureMemory()
  return (await q('select id, kind, text, source, active, created_at, updated_at from ai_memory order by active desc, updated_at desc limit 300')).rows
}
export async function saveLesson({ id, kind, text, active }) {
  await ensureMemory()
  const l = cleanLesson(kind, text); if (!l) throw new Error('Write the lesson in a few words, without passwords, keys or contact details.')
  if (id) { await q('update ai_memory set kind = $2, text = $3, active = $4, updated_at = now() where id = $1', [id, l.kind, l.text, active !== false]); return { id } }
  const r = await one("insert into ai_memory (kind, text, source) values ($1, $2, 'you') returning id", [l.kind, l.text]); return { id: r.id }
}
export async function deleteLesson(id) { await ensureMemory(); await q('delete from ai_memory where id = $1', [id]); return { ok: true } }

// The lessons sent with a message: rules and facts always, the rest when they relate to the message. Kept compact.
const words = (s) => new Set(String(s || '').toLowerCase().match(/[a-z0-9]{4,}/g) || [])
export async function lessonsFor(message = '') {
  await ensureMemory()
  const rows = (await q('select kind, text from ai_memory where active order by updated_at desc limit 200')).rows
  if (!rows.length) return ''
  const w = words(message), isCode = /```|\b(code|function|component|bug|error|script|sql|react|next|python|javascript|typescript|css|api)\b/i.test(message)
  const score = (r) => (r.kind === 'rule' || r.kind === 'fact' ? 100 : 0) + (r.kind === 'code' && isCode ? 80 : 0) + [...words(r.text)].filter((x) => w.has(x)).length * 10 + (r.kind === 'preference' ? 20 : 0)
  const picked = []; let room = 2800
  for (const r of [...rows].sort((a, b) => score(b) - score(a))) { if (room - r.text.length < 0) break; if (r.kind === 'code' && !isCode && score(r) < 10) continue; picked.push(r); room -= r.text.length + 4 }
  if (!picked.length) return ''
  return '\n\nWHAT YOU HAVE LEARNED FROM OLAITAN (follow these every time; they override your defaults; he can edit them on the Memory page):\n' + picked.map((r) => `- ${r.text}`).join('\n')
}

// ---------- examples of answers he liked ----------
export async function likedExamples(message = '') {
  await ensureMemory()
  const w = words(message); if (w.size < 2) return ''
  const rows = (await q(`select a.text, (select u.text from assistant_messages u where u.chat_id = a.chat_id and u.id < a.id and u.role = 'you' order by u.id desc limit 1) as asked
    from assistant_messages a where a.role = 'assistant' and a.rating = 1 order by a.id desc limit 60`)).rows
  const best = rows.map((r) => ({ ...r, s: [...words(r.asked)].filter((x) => w.has(x)).length })).filter((r) => r.s >= 2).sort((a, b) => b.s - a.s).slice(0, 2)
  if (!best.length) return ''
  return '\n\nANSWERS HE LIKED TO SIMILAR QUESTIONS (match their approach, depth and tone; do not copy their content):\n' + best.map((r) => `He asked: "${clip(r.asked, 200)}"\nYou answered: "${clip(r.text, 1200)}"`).join('\n---\n')
}

// ---------- the hidden memory line in an answer: <<<MEMORY {"kind": "...", "text": "..."}>>> ----------
export function takeMemoryLines(full) {
  const found = []
  const text = String(full || '').replace(/<<<MEMORY\s*(\{[\s\S]*?\})\s*>>>/g, (_, json) => { try { const o = JSON.parse(json); if (o && o.text) found.push(o) } catch {} return '' })
  return { text, found: found.slice(0, 3) }
}
export const MEMORY_RULES = `MEMORY: when he corrects you, or tells you something lasting about how he wants things done, about himself, his business or how he codes (for example "always", "never", "from now on", "remember", "I prefer", "call me", "our prices start at"), also add at the very end, on its own line:
<<<MEMORY {"kind": "rule" | "preference" | "fact" | "code", "text": "a short instruction to yourself, e.g. Never use the word 'leverage' in articles."}>>>
Only for lasting things, not one-off requests. Never store passwords, keys or anyone's contact details. Put it after any ACTION line.`

// ---------- feedback ----------
const PROVIDER_PREFIX = [['Groq', 'groq'], ['Gemini', 'gemini'], ['Llama 3.3 (Cloudflare)', 'cloudflare'], ['OpenRouter', 'openrouter'], ['NVIDIA', 'nvidia'], ['Z.ai', 'zai'], ['Mistral', 'mistral'], ['Cohere', 'cohere'], ['Cerebras', 'cerebras']]
export const providerOf = (writtenBy) => (PROVIDER_PREFIX.find(([p]) => String(writtenBy || '').startsWith(p)) || [])[1] || null
export async function rate(messageId, rating, note) {
  await ensureMemory()
  const r = Math.max(-1, Math.min(1, Math.round(Number(rating) || 0)))
  const m = await one("select id, rating, written_by from assistant_messages where id = $1 and role = 'assistant'", [messageId])
  if (!m) throw new Error('That answer no longer exists.')
  const fb = clip(note, 400) || null
  await q('update assistant_messages set rating = $2, feedback = coalesce($3, feedback) where id = $1', [m.id, r || null, fb])
  const p = providerOf(m.written_by)
  if (p) {                                                            // keep each provider's approval count right when you change your mind
    const up = (r === 1 ? 1 : 0) - (m.rating === 1 ? 1 : 0), down = (r === -1 ? 1 : 0) - (m.rating === -1 ? 1 : 0)
    if (up || down) await q(`insert into ai_providers (id, ups, downs) values ($1, greatest($2, 0), greatest($3, 0))
      on conflict (id) do update set ups = greatest(ai_providers.ups + $2, 0), downs = greatest(ai_providers.downs + $3, 0)`, [p, up, down]).catch(() => {})
  }
  let lesson = null
  if (r === -1 && fb) lesson = await addLesson(/```|code|function|typescript|javascript|python|css|react/i.test(fb) ? 'code' : 'rule', 'From his feedback: ' + fb, 'feedback')
  return { ok: true, rating: r, lesson }
}
// Providers he often thumbs down move later in the line (after at least 5 ratings, below 50% approval).
export async function approvalPenalties() {
  try { await ensureMemory(); const rows = (await q('select id, ups, downs from ai_providers where ups + downs >= 5')).rows
    return Object.fromEntries(rows.map((r) => [r.id, r.ups / (r.ups + r.downs) < 0.5 ? 1 : 0])) } catch { return {} }
}
export async function feedbackStats() {
  await ensureMemory()
  const t = await one("select count(*) filter (where rating = 1)::int as up, count(*) filter (where rating = -1)::int as down from assistant_messages where role = 'assistant'")
  const by = (await q('select id, ups, downs from ai_providers where ups + downs > 0 order by ups + downs desc')).rows
  const recent = (await q("select id, chat_id, rating, feedback, written_by, created_at from assistant_messages where role = 'assistant' and rating = -1 and feedback is not null order by id desc limit 8")).rows
  return { ...t, by, recent }
}
