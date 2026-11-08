// Olex Sales, Install 19: the one-page brief Olaitan reads before a call. Written after a booking (the background step picks
// up any booked business without one). Facts come from the database (code); the AI only reads the conversation and suggests
// what they want, their worries, questions to ask, what to show and how to close. Prices come from the playbook, never the AI.
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { askJSON } from '@/lib/assistant/llm'
import { notify } from '@/lib/assistant/notify'
import { PROOF, priceOf, offersFor, TIERS } from './playbook'
import { threadOf } from './converse'
import { factsFor } from './write'

const list = (v, n, len = 220) => (Array.isArray(v) ? v : []).map((x) => String(x || '').replace(/\s+/g, ' ').trim().slice(0, len)).filter(Boolean).slice(0, n)
const SIG = { NO_WEBSITE: 'No website', SITE_DOWN: 'Site down', SLOW_MOBILE: 'Slow on phones', NOT_MOBILE: 'Not mobile-friendly', NO_HTTPS: 'No padlock', NO_BOOKING: 'No online booking', OLD_COPYRIGHT: 'Looks out of date', PLATFORM: 'Built on a platform',
  CUE_LOCATIONS: 'More than one location', CUE_HIRING: 'Hiring', CUE_TEAM: 'A team of 10+', CUE_INVEST: 'Investors or franchising' }

export async function makeBrief(companyId) {
  const c = await one('select * from sales_companies where id = $1', [companyId]); if (!c) return null
  const booking = await one('select * from sales_bookings where company_id = $1 order by starts_at desc limit 1', [companyId])
  const contact = await one('select name, email from sales_contacts where company_id = $1 and opted_out_at is null order by id limit 1', [companyId])
  const signals = (await q('select * from sales_signals where company_id = $1', [companyId])).rows
  const thread = await threadOf(companyId), plan = c.plan || {}
  const tier = plan.tier || c.tier || 'starter', cur = plan.currency || 'USD'
  const prices = offersFor(tier).map((o) => ({ name: o.name, price: priceOf(o.key, tier, cur).text }))
  const convo = thread.map((m) => `${m.who === 'us' ? 'OLAITAN' : 'THEM'}: ${String(m.text).split('\n--\n')[0].slice(0, 900)}`).join('\n\n')
  const j = await askJSON({ kind: 'quick', temperature: 0.3, system: `You prepare Olaitan Adebayo (Olexweb, a web studio: every build motion-led, unique, never static) for a 30-minute sales call.
Read the conversation and the facts. Be specific to this business; no generic advice. Never write prices (they're shown separately). Never invent facts.
JSON: {"summary": "2 sentences: who they are and why they booked", "wants": ["what they want, in their words"], "worries": ["concerns or objections they raised or are likely to have"],
"ask": ["3 to 5 questions Olaitan should ask on the call"], "show": ["which of these past projects to show and why: ${PROOF.join('; ')}"], "close": "one sentence: the next step to agree at the end of the call"}`,
    prompt: `Business: ${c.name}, ${c.category || ''} ${c.city || ''} (${c.country}). Website: ${c.website || 'none'}.\nFacts:\n- ${factsFor(signals).join('\n- ') || 'none'}\nOur read: ${plan.tierLabel || 'Starter'} level, offer "${plan.offerName || ''}". ${booking && booking.note ? `\nWhat they wrote when booking: "${booking.note}"` : ''}\n\nConversation:\n${convo || '(none: they booked straight from the first email)'}` }).catch(() => null)
  const brief = {
    at: new Date().toISOString(), company: { id: c.id, name: c.name, website: c.website, category: c.category, city: c.city, country: c.country },
    contact: booking ? { name: booking.name, email: booking.email } : contact || null,
    call: booking ? { at: booking.starts_at.toISOString(), code: booking.meeting_code, note: booking.note || null } : null,
    level: { label: plan.tierLabel || TIERS[tier].label, reasons: plan.reasons || [] },
    offer: plan.offerName ? { name: plan.offerName, price: plan.price, care: plan.care } : null, prices,
    signals: signals.map((s) => ({ label: SIG[s.code] || s.code, evidence: s.evidence || null })),
    summary: String((j && j.summary) || `${c.name} booked a call${plan.offerName ? `; the offer that fits is a ${plan.offerName.toLowerCase()}` : ''}.`).slice(0, 500),
    wants: list(j && j.wants, 5), worries: list(j && j.worries, 5), ask: list(j && j.ask, 5), show: list(j && j.show, 3),
    close: String((j && j.close) || 'Agree the scope, then send the invoice for the deposit (bank transfer).').slice(0, 300),
    thread: thread.map((m) => ({ who: m.who, at: new Date(m.at).toISOString(), text: String(m.text).split('\n--\n')[0].slice(0, 3000) })),
    ai: !!j,
  }
  await q('update sales_companies set brief = $2, brief_at = now() where id = $1', [companyId, JSON.stringify(brief)])
  const when = brief.call ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(brief.call.at)) : null
  notify('sales', `Your brief for ${c.name} is ready${when ? ` (call ${when}, Lagos time)` : ''}.`, `/admin/sales/brief/${c.id}`)
  return brief
}
export const briefOf = async (companyId) => { const r = await one('select brief from sales_companies where id = $1', [companyId]); return r && r.brief }
