// Chat: Olaitan writes naturally; the AI only chooses an action. The server performs it under the same rules.
import 'server-only'
import { q } from '@/lib/admin/db'
import { askJSON, Busy } from './llm'
import { refreshResearch, suggestions, readable } from './research'
import { writeArticle, reviseArticle } from './write'

const SCHEMA = { type: 'object', properties: { reply: { type: 'string' }, action: { type: 'string', enum: ['none', 'research', 'write', 'revise'] },
  topic: { type: 'string' }, researchId: { type: 'integer' }, postId: { type: 'integer' }, instructions: { type: 'string' } }, required: ['reply', 'action'] }
const say = async (text, postId = null) => (await q("insert into assistant_messages (role, text, post_id) values ('assistant', $1, $2) returning id, role, text, post_id, created_at", [text.slice(0, 4000), postId])).rows[0]

export async function handleMessage(text) {
  const msg = String(text || '').trim().slice(0, 2000)
  if (!msg) throw new Error('Write a message first.')
  await q("insert into assistant_messages (role, text) values ('you', $1)", [msg])
  const history = (await q('select role, text from assistant_messages order by id desc limit 12')).rows.reverse()
  const research = (await q('select id, topic from research_items where used_by is null order by id desc limit 8')).rows
  const drafts = (await q("select id, title from posts where status in ('draft', 'waiting') and origin = 'assistant' order by id desc limit 8")).rows
  const s = (await q('select mode from assistant_settings where id = 1')).rows[0]
  let plan
  try {
    plan = await askJSON({ schema: SCHEMA, temperature: 0.3, maxTokens: 1024,
      system: 'You are the writing assistant inside the Olexweb admin, talking to Olaitan, the owner. Be brief, plain and friendly. Choose one action. "research": find today\'s topics. "write": draft an article (use researchId if he picks a listed topic, otherwise put his topic in "topic"). "revise": change a draft (postId and his instructions). "none": just answer. You never publish; Olaitan does, or autopilot after 24 hours.',
      prompt: `Today's unused research topics: ${research.map((r) => `#${r.id} ${r.topic}`).join('; ') || 'none yet'}\nDrafts waiting: ${drafts.map((d) => `#${d.id} ${d.title}`).join('; ') || 'none'}\n\nConversation:\n${history.map((h) => (h.role === 'you' ? 'Olaitan: ' : 'Assistant: ') + h.text).join('\n')}` })
  } catch (e) { return [await say(e instanceof Busy ? e.message : 'I couldn’t think that through just now: ' + e.message)] }
  const out = [await say(plan.reply || 'On it.')]
  try {
    if (plan.action === 'research') {
      const t = await refreshResearch()
      out.push(await say(t.length ? `I found ${t.length} topic${t.length === 1 ? '' : 's'} people are searching for. They're in Today's research.` : 'I couldn’t find topics with real searches behind them today. I’ll try again tomorrow.'))
    } else if (plan.action === 'write') {
      let item = plan.researchId ? (await q('select id, topic, why, searches, sources from research_items where id = $1', [plan.researchId])).rows[0] : null
      if (!item) {
        const topic = String(plan.topic || msg).slice(0, 160), searches = await suggestions(topic)
        if (!searches.length) { out.push(await say(`I couldn't find real Google searches for "${topic}", so I won't write it. Try wording it the way a customer would search.`)); return out }
        item = { id: null, topic, why: '', searches: searches.slice(0, 6), sources: (await readable(topic)).slice(0, 4) }
      }
      const s2 = (await q('select mode from assistant_settings where id = 1')).rows[0]
      const r = await writeArticle({ topic: item.topic, why: item.why, searches: item.searches, sources: item.sources, researchId: item.id }, { mode: s2.mode })
      out.push(await say(`The draft is ready${r.checks.ok ? ' and passes every check' : ', but some checks need attention'}${r.claims.length ? `. ${r.claims.length} claim${r.claims.length === 1 ? '' : 's'} need${r.claims.length === 1 ? 's' : ''} your check` : ''}.${s.mode === 'autopilot' ? ' If you don’t review it within 24 hours, I’ll remove anything unconfirmed and publish it.' : ''}`, r.id))
    } else if (plan.action === 'revise' && plan.postId) {
      const r = await reviseArticle(plan.postId, plan.instructions || msg)
      out.push(await say(`Done. The draft is updated${r.checks.ok ? ' and passes every check' : '; some checks need attention'}.`, r.id))
    }
  } catch (e) { out.push(await say(e instanceof Busy ? e.message : 'That didn’t work: ' + e.message)) }
  return out
}
