// The Assistant tab (owner only).
import { currentUser, sameOrigin, ownerOnly, audit, clientIp } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import { q } from '@/lib/admin/db'
import { handleMessage } from '@/lib/assistant/chat'
import { refreshResearch } from '@/lib/assistant/research'
import { writeArticle } from '@/lib/assistant/write'
import { dailyRun } from '@/lib/assistant/autopilot'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
const TOPIC = /^[\p{L}\p{N} .,'&+\-]{2,60}$/u
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const u = await currentUser(); if (!u) return refuse('Sign in again.', 401)
  if (!ownerOnly(u)) return refuse('Only Olaitan can use the assistant.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(async () => {
    if (b.action === 'message') return { messages: await handleMessage(b.text) }
    if (b.action === 'research') return { topics: await refreshResearch() }
    if (b.action === 'write') {
      const item = (await q('select id, topic, why, searches, sources from research_items where id = $1 and used_by is null', [Number(b.researchId)])).rows[0]
      if (!item) throw new Refused('That topic was already used or no longer exists.')
      const s = (await q('select mode from assistant_settings where id = 1')).rows[0]
      return writeArticle(item, { mode: s.mode })
    }
    if (b.action === 'run') return dailyRun()
    if (b.action === 'settings') {
      const mode = b.mode === 'autopilot' ? 'autopilot' : 'approval', pace = Math.min(3, Math.max(1, Number(b.pace) || 2))
      const topics = (Array.isArray(b.topics) ? b.topics : []).map((t) => String(t).trim()).filter((t) => TOPIC.test(t)).slice(0, 8)
      if (!topics.length) throw new Refused('Add at least one topic.')
      const socials = {}; for (const k of ['linkedin', 'x', 'facebook']) { const v = String((b.socials || {})[k] || '').trim(); if (v && !/^https:\/\/[^\s<>"]{4,200}$/.test(v)) throw new Refused('Social links need to start with https://'); socials[k] = v }
      await q('update assistant_settings set mode = $1, pace = $2, topics = $3, socials = $4, updated_at = now() where id = 1', [mode, pace, JSON.stringify(topics), JSON.stringify(socials)])
      if (mode === 'approval') await q("update posts set auto_publish_at = null where origin = 'assistant' and status = 'waiting'")
      await audit(u.id, 'assistant_settings_changed', { mode, pace }, clientIp())
      return { ok: true }
    }
    throw new Refused('Unknown action.')
  })
}
