// Olex Sales, Install 19: the agent runs the conversation. Every real reply is read with the whole thread, the agent's read of
// the business (tier.js) and the playbook, and the agent picks ONE next move:
//   answer    answer what they asked (the booking link when a call is the right next step)
//   book      they want to talk: a short reply with the booking link
//   later     "not now": a gracious reply, then a check-in when they said (or in 45 days), up to 3 times
//   referral  "talk to X": thank them, then a short introduction email to X (only at the business's own domain)
//   handover  it needs Olaitan: starting the project, payment, contracts, a complaint, anything unusual, a booked client,
//             or 5 answers without a booking. He's notified; a suggested reply waits for him, never sent by itself.
//   stop      a polite no the plain-code opt-out missed: no more emails
// Plain code, not AI, decides the things that must never go wrong: talk of payment or starting goes to Olaitan; prices only
// ever come from the playbook (the AI may not write a price, the code adds it); no links but the booking link and the rate
// card; no promised dates; English (French businesses were told replies come in English); length; banned phrases.
// Answers go out 9 to 38 minutes later (a person doesn't answer in 4 seconds); with "send without asking me" off they wait.
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { askJSON } from '@/lib/assistant/llm'
import { notify } from '@/lib/assistant/notify'
import { VOICE, POSITIONING, PROOF, OFFERS, priceOf, offerOf } from './playbook'
import { makeRateCard } from './docs'
import { factsFor } from './write'

export const MAX_TURNS = 5
const PRICE_ASK = /\b(how much|price|pricing|cost|costs|rates?|quote|budget|fees?|charge|prix|tarifs?|combien|co[uû]t|devis)\b/i
// talk of starting, paying or signing: always Olaitan's (he wants to be there for how a project starts and payment)
const START_PAY = /\b(invoice|deposit|bank (details|transfer)|pay(ment|ing)?|contract|agreement|sign (it|off|up)|let'?s (start|go ahead|do it|proceed|get started)|go ahead|ready to (start|begin|proceed|go)|when can you start|we'?ll take it|book (you|it) in|send (me )?(the|a|your) (invoice|proposal|contract))\b/i
const SENSITIVE = /\b(lawyer|solicitor'?s letter|legal action|sue|report (you|this)|spam(ming)?|gdpr|data protection|how did you get (my|this|our)|complain(t)?|scam|rude|harass)/i
const FAKE_LINK = /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|co\.uk|uk|net|org|io|dev|fr)\b/i
const MONEY = /[$£€]\s?\d|\d\s?(€|eur|euros?|usd|gbp|dollars?|pounds?)\b|\b\d+\s?k\b/i
const PROMISE = /\b(guarantee[ds]?|promise|100%|(by|before) (monday|tuesday|wednesday|thursday|friday|tomorrow|next week|the end of)|within \d+ (hours?|days?|weeks?)|in \d+ (days?|weeks?))\b/i
const BANNED = [/hope (this|you|all)[^.]{0,20}(finds|is|are) (you )?well/i, /reaching out/i, /circling back/i, /touch(ing)? base/i, /synerg/i, /game[- ]?changer/i, /leverage/i, /cutting[- ]edge/i,
  /\bunlock\b/i, /elevate/i, /seamless/i, /as an ai/i, /language model/i, /i'?m (an?|the) (assistant|bot)/i, /\[.*?\]|\{\{.*?\}\}/, /!/]
const FRENCH = /\b(bonjour|merci|vous|votre|nous|avec|pour|est|sont|je suis|c'est)\b/gi

// the conversation so far, oldest first
export async function threadOf(companyId) {
  const ours = (await q("select sent_at as at, body, step from sales_outbox where company_id = $1 and status = 'sent' order by sent_at", [companyId])).rows.map((r) => ({ who: 'us', at: r.at, text: r.body, step: r.step }))
  const theirs = (await q("select received_at as at, body, intent from sales_replies where company_id = $1 and intent not in ('auto_reply', 'bounce') order by received_at", [companyId])).rows.map((r) => ({ who: 'them', at: r.at, text: r.body }))
  return [...ours, ...theirs].sort((a, b) => new Date(a.at) - new Date(b.at))
}
const asText = (t) => t.map((m) => `${m.who === 'us' ? 'OLAITAN' : 'THEM'} (${new Date(m.at).toISOString().slice(0, 10)}):\n${String(m.text).split('\n--\n')[0].slice(0, 1200)}`).join('\n\n')
const later = (s) => { const d = new Date(String(s || '') + 'T09:00:00Z'); const now = Date.now(); return isNaN(d) || d < now + 7 * 864e5 || d > now + 400 * 864e5 ? null : d }

// plain-code checks on an answer (no AI)
export function checkAnswer(body, move) {
  const p = [], b = String(body || '').trim(), words = b.split(/\s+/).filter(Boolean).length
  if (words < 12 || words > 150) p.push(`it is ${words} words (12–150 allowed)`)
  if (FAKE_LINK.test(b.replace(/BOOKING_LINK/g, ''))) p.push('it has a link (only BOOKING_LINK is allowed)')
  if (MONEY.test(b)) p.push('it names a price or amount (never write prices; the code adds them)')
  if (PROMISE.test(b)) p.push('it promises a date, a time frame or a result')
  for (const re of BANNED) if (re.test(b)) { p.push('it uses a phrase that sounds like a template or a bot: ' + re.source.slice(0, 24)); break }
  if ((b.match(FRENCH) || []).length >= 3) p.push('it is in French (answers are in English)')
  if (/<[a-z]/i.test(b)) p.push('it has HTML')
  if (move === 'book' && !b.includes('BOOKING_LINK')) p.push('a "book" move needs BOOKING_LINK on its own line')
  if ((b.match(/BOOKING_LINK/g) || []).length > 1) p.push('BOOKING_LINK appears more than once')
  if (/\n\s*(olaitan|best|regards|thanks,|cheers|kind regards)\s*$/i.test(b)) p.push('it signs off (the signature is added later)')
  return p
}

const SYSTEM = (c, plan, S, fr, mock = null) => `You are the email side of ${S.sender_name}, who runs Olexweb. You write AS him, in the first person, to a business that replied to his email.
${POSITIONING}
${VOICE}
What Olexweb offers (names only; NEVER write a price, amount or currency: the code adds the right price when it's needed):
${OFFERS.map((o) => `- ${o.name}: ${o.what}`).join('\n')}
Real past work you may mention (only these): ${PROOF.join('; ')}.
Your read of this business: ${plan ? `${plan.tierLabel} level; the offer that fits is "${plan.offerName}"; the opening angle was: ${plan.angle || 'their website'}.` : 'not read yet.'}
${mock ? `You made them a mock-up of a new homepage${mock.shared_at ? ' and already sent them the link' : ' (offered in your first email, not sent yet)'}. ${mock.shared_at ? 'If they mention it, talk about it naturally.' : 'If they want to see it or say yes, say it is just below your message: the code adds the link under your answer. Never write the link yourself.'}
` : ''}
Pick ONE move:
- "answer": they asked something. Answer it honestly in plain words. If a call is the natural next step, invite them to pick a time with BOOKING_LINK on its own line.
- "book": they want to talk, see ideas, or know more. Short and warm, then BOOKING_LINK on its own line.
- "later": not now. Be gracious, no pressure. If they said when, put that date in "later" (YYYY-MM-DD).
- "referral": they point to someone else. Thank them. Put that person in "referral" {"name", "email"} if they gave an email.
- "stop": a clear no. No body needed.
- "handover": anything about starting the project, paying, a deposit, an invoice, a contract or a proposal; anger, complaints, legal or data questions; a request you can't answer from what's here; anything odd. Write a suggested reply for Olaitan in "body" anyway, and say why in "why".
Rules for the body (all required): English only, ${c.country === 'GB' ? 'British' : 'American'} spelling (they ${fr ? 'were told replies come in English; keep it simple and clear' : 'are a native speaker'}). 25 to 120 words. Plain text.
Sound like a real person who read their message: answer what they actually said, use their words, ask at most one question. No links except BOOKING_LINK. No prices or amounts. No dates or time frames promised. No exclamation marks.
Start with "Hi ${'{their first name}'}," if you know it, otherwise "Hi,". Don't sign off (added later).
Answer JSON only: {"move": "...", "intent": "interested" | "question" | "price" | "wants_call" | "not_now" | "wrong_person" | "objection" | "not_interested" | "other", "summary": "one short sentence on what they said", "body": "...", "later": null, "referral": null, "why": null, "confidence": 0.0-1.0}`

// what to do with a real reply (called by inbox.js after bounces, out-of-office and opt-outs are handled by code)
export async function respond(c, sent, m, text) {
  const S = await one('select * from sales_settings where id = 1'), first = String(S.sender_name || 'Olaitan').split(' ')[0]
  const fresh = await one('select * from sales_companies where id = $1', [c.id]), plan = fresh.plan || null, fr = c.country === 'FR'
  const turns = (await one("select count(*)::int n from sales_outbox where company_id = $1 and step between 9 and 19 and status in ('sent', 'approved', 'waiting')", [c.id])).n
  const thread = await threadOf(c.id)
  const { previewOf } = await import('./preview'), mock = await previewOf(c.id).catch(() => null)
  const prompt = `The business: ${c.name}${c.city ? ', ' + c.city : ''} (${c.category || 'small business'}). Their contact: ${m.fromName || m.from}.\n\nThe conversation so far:\n${asText(thread)}\n\nTheir newest reply (answer this):\n"""${text.slice(0, 2500)}"""`
  let j = null, problems = []
  for (let i = 0; i < 3; i++) {
    const r = await askJSON({ kind: 'quick', temperature: 0.4, system: SYSTEM(c, plan, S, fr, mock), prompt: i ? prompt + `\n\nYour last answer broke these rules: ${problems.join('; ')}. Write it again, fixing them.` : prompt }).catch(() => null)
    if (!r || !r.move) { problems = ['no answer came back']; continue }
    j = r; if (j.move === 'stop') break
    problems = checkAnswer(j.body, j.move); if (!problems.length) break
  }
  const move0 = j && ['answer', 'book', 'later', 'referral', 'handover', 'stop'].includes(j.move) ? j.move : 'handover'
  const intent = String((j && j.intent) || 'other').slice(0, 30), summary = String((j && j.summary) || 'A reply arrived').slice(0, 200)
  // the code's own handover rules come first, whatever the AI chose
  let move = move0, why = j && j.why ? String(j.why).slice(0, 200) : null
  if (START_PAY.test(text)) { move = 'handover'; why = 'They want to start or asked about paying: that’s your part.' }
  else if (SENSITIVE.test(text)) { move = 'handover'; why = 'A sensitive message (a complaint, legal or data question).' }
  else if (fresh.status === 'booked') { move = 'handover'; why = 'They already have a call booked with you.' }
  else if (move !== 'stop' && move !== 'handover' && turns >= MAX_TURNS) { move = 'handover'; why = `${turns} answers and no call yet: worth a personal touch.` }
  else if (move !== 'stop' && move !== 'handover' && (!j || problems.length)) { move = 'handover'; why = 'The agent couldn’t write an answer that passed every check.' }
  if (move === 'handover' && !why) why = 'The agent thinks this needs you.'
  await q('update sales_replies set intent = $2, summary = $3, move = $4 where id = (select id from sales_replies where company_id = $1 order by id desc limit 1)', [c.id, intent, summary, move])

  if (move === 'stop') {
    await q("update sales_companies set status = 'lost', lost_reason = $2 where id = $1", [c.id, 'Said no: ' + summary])
    await q("update sales_replies set handled = true where company_id = $1", [c.id])
    return { move }
  }
  let body = move === 'handover' && j && problems.length && j.move !== 'stop' ? '' : String((j && j.body) || '').trim()   // a draft that broke the rules is never kept, even as a suggestion
  // the price, from the playbook (never from the AI), when they asked
  let extra = ''
  if (body && move !== 'handover' && (PRICE_ASK.test(text) || intent === 'price')) {
    const p = plan && priceOf(plan.offer, plan.tier, plan.currency)
    if (p) extra += `\n\nFor ${/^[aeiou]/i.test(plan.offerName) ? 'an' : 'a'} ${plan.offerName.toLowerCase()}, which is what I’d suggest for you, it’s ${p.text}. The exact figure comes after a short call, once I know what you need.`
    const d = await makeRateCard({ country: c.country, tier: (plan && plan.tier) || 'starter', companyId: c.id }).catch(() => null)
    if (d) extra += `\n\nMy current rates: ${d.url}`
  }
  const { bookLink } = await import('./inbox')
  // the mock-up (lib/sales/preview.js): its link goes under the first positive answer, once
  const showMock = !!(body && mock && !mock.shared_at && (move === 'answer' || move === 'book'))
  if (showMock) extra = `\n\nHere’s the mock-up I made for ${c.name}: ${mock.url}\nIt’s just a first idea. Nothing on your live site has changed.` + extra
  const final = body ? `${body.replace('BOOKING_LINK', bookLink(c.id))}${extra}\n\n${first}\nOlexweb` : ''
  const subject = (/^re:/i.test(m.subject || '') ? m.subject : 'Re: ' + (m.subject || sent.subject)).slice(0, 200)
  const auto = !S.require_approval && move !== 'handover' && Number((j && j.confidence) ?? 1) >= 0.6
  if (final) await q(`insert into sales_outbox (company_id, contact_id, step, subject, body, status, in_reply_to, send_after, held_reason) values ($1, $2, 9, $3, $4, $5, $6, $7, $8)`,
    [c.id, sent.contact_id, subject, final, auto ? 'approved' : 'waiting', m.messageId, auto ? new Date(Date.now() + (9 + Math.floor(Math.random() * 30)) * 60e3) : null, move === 'handover' ? 'For you: ' + why : null])
  if (final && showMock) await q('update sales_previews set shared_at = now() where company_id = $1', [c.id])

  if (move === 'handover') {
    await q("update sales_companies set handover = $2 where id = $1", [c.id, JSON.stringify({ why, summary, at: new Date().toISOString() })])
    notify('sales', `${c.name} needs you: ${why} (${summary})`, '/admin/sales')
  } else {
    await q("update sales_replies set handled = true where company_id = $1", [c.id])
    if (move === 'later') {
      const when = later(j.later) || new Date(Date.now() + 45 * 864e5)
      await q("update sales_companies set status = 'nurture', next_touch_after = $2 where id = $1", [c.id, when])
    }
    if (move === 'referral' && j.referral) await introduce(c, j.referral, m).catch(() => {})
    if (!auto) notify('sales', `${c.name} replied (${intent.replace('_', ' ')}): ${summary}. The agent's answer is waiting for you.`, '/admin/sales')
  }
  return { move, intent }
}

// "talk to X": an introduction to X, only at the business's own domain (or the replier's), never anyone else
async function introduce(c, ref, m) {
  const email = String(ref.email || '').trim().toLowerCase(), dom = email.split('@')[1]
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/.test(email)) return null
  const own = [c.domain, String(m.from || '').split('@')[1]].filter(Boolean).map((d) => d.toLowerCase().replace(/^www\./, ''))
  if (!own.includes(dom)) return null
  if (await one('select 1 from sales_dnc where entry = $1 or entry = $2', [email, dom])) return null
  const k = await one(`insert into sales_contacts (company_id, name, email, email_status, source_url) values ($1, $2, $3, 'deliverable', 'referred by ' || $4)
    on conflict (lower(email)) do nothing returning id`, [c.id, String(ref.name || '').slice(0, 80) || null, email, String(m.from).slice(0, 120)])
  if (!k) return null
  const S = await one('select * from sales_settings where id = 1'), first = String(S.sender_name || 'Olaitan').split(' ')[0]
  const who = (m.fromName || '').split(' ')[0] || 'Your colleague'
  const signals = (await q('select * from sales_signals where company_id = $1', [c.id])).rows, facts = factsFor(signals)
  const j = await askJSON({ kind: 'quick', temperature: 0.4, system: `Write a short introduction email from ${S.sender_name} of Olexweb (a web studio) to ${ref.name || 'someone'} at ${c.name}. ${who} suggested he write to them.
${VOICE}
English, ${c.country === 'GB' ? 'British' : 'American'} spelling. 30 to 70 words, plain text, no links, no prices. Say who suggested it, the one useful observation, and end with one yes/no question (last character "?").
Start with "Hi${ref.name ? ' ' + String(ref.name).split(' ')[0] : ''}," and don't sign off. Subject: 2 to 6 words, lowercase. JSON: {"subject": "...", "body": "..."}`, prompt: `What we noticed:\n- ${facts.join('\n- ') || 'their website could do more for them'}` }).catch(() => null)
  const body = String((j && j.body) || '').trim(), subj = String((j && j.subject) || '').trim()
  const { checkDraft } = await import('./write')
  if (!body || checkDraft({ subject: subj, body }).length) return null
  await q(`insert into sales_outbox (company_id, contact_id, step, subject, body, status) values ($1, $2, 12, $3, $4, $5)`,
    [c.id, k.id, subj, `${body}\n\n${first}\nOlexweb`, S.require_approval ? 'waiting' : 'approved'])
  return k.id
}

// ---------- keeping the conversation going ----------
// a talking lead went quiet after our answer: a nudge after 3 days, a last one 4 days later; then a check-in in 45 days
export async function draftNudge(companyId) {
  const c = await one('select * from sales_companies where id = $1', [companyId]); if (!c || c.status !== 'replied' || c.handover) return null
  if (await one("select 1 from sales_outbox where company_id = $1 and status in ('waiting', 'approved', 'held')", [companyId])) return null
  const last = await one("select * from sales_outbox where company_id = $1 and status = 'sent' order by sent_at desc limit 1", [companyId])
  const lastThem = await one('select max(received_at) t from sales_replies where company_id = $1', [companyId])
  if (!last || last.step < 9 || (lastThem.t && lastThem.t > last.sent_at)) return null
  const n = (await one("select count(*)::int n from sales_outbox where company_id = $1 and step in (10, 11) and status = 'sent' and sent_at > coalesce($2::timestamptz, 'epoch'::timestamptz)", [companyId, lastThem.t])).n
  if (n >= 2) { await q("update sales_companies set status = 'nurture', next_touch_after = now() + interval '45 days' where id = $1", [companyId]); return null }
  const S = await one('select * from sales_settings where id = 1'), first = String(S.sender_name || 'Olaitan').split(' ')[0]
  const thread = await threadOf(companyId)
  const body = await shortNote(S, c, `They replied earlier, Olaitan answered, and they haven't written back. Write ${n ? 'the last, very light' : 'a light'} nudge that picks up exactly where the conversation stopped (their words, their situation). ${n ? 'Say it is fine if the timing is wrong.' : ''}`, asText(thread))
  if (!body) return null
  await q(`insert into sales_outbox (company_id, contact_id, step, subject, body, status, in_reply_to) values ($1, $2, $3, $4, $5, $6, $7)`,
    [companyId, last.contact_id, 10 + n, last.subject, `${body}\n\n${first}`, S.require_approval ? 'waiting' : 'approved', last.message_id])
  return true
}
// "later": a check-in when the time comes (at most 3, 45 days apart), useful on its own, then the agent lets it rest
export async function draftCheckIn(companyId) {
  const c = await one('select * from sales_companies where id = $1', [companyId]); if (!c || c.status !== 'nurture') return null
  if (await one("select 1 from sales_outbox where company_id = $1 and status in ('waiting', 'approved', 'held')", [companyId])) return null
  if ((c.nurture_count || 0) >= 3) { await q("update sales_companies set status = 'lost', lost_reason = 'No answer after 3 check-ins' where id = $1", [companyId]); return null }
  const last = await one("select * from sales_outbox where company_id = $1 and status = 'sent' order by sent_at desc limit 1", [companyId]); if (!last) return null
  const S = await one('select * from sales_settings where id = 1'), first = String(S.sender_name || 'Olaitan').split(' ')[0]
  const signals = (await q('select * from sales_signals where company_id = $1', [companyId])).rows
  const body = await shortNote(S, c, `Some time ago they said "not now". Write a friendly check-in that is useful on its own: one small, specific idea for their business from the facts below, then ask if now is a better time. No guilt, no "just checking in".`,
    asText(await threadOf(companyId)) + `\n\nFacts about their website:\n- ${factsFor(signals).join('\n- ') || 'none recorded'}`)
  if (!body) return null
  await q(`insert into sales_outbox (company_id, contact_id, step, subject, body, status, in_reply_to) values ($1, $2, $3, $4, $5, $6, $7)`,
    [companyId, last.contact_id, 20 + (c.nurture_count || 0), last.subject, `${body}\n\n${first}`, S.require_approval ? 'waiting' : 'approved', last.message_id])
  await q("update sales_companies set nurture_count = coalesce(nurture_count, 0) + 1, next_touch_after = now() + interval '45 days' where id = $1", [companyId])
  return true
}
async function shortNote(S, c, task, context) {
  const { checkDraft } = await import('./write')
  let problems = []
  for (let i = 0; i < 3; i++) {
    const j = await askJSON({ kind: 'quick', temperature: 0.5, system: `You write a short follow-up email AS ${S.sender_name} of Olexweb (a web studio). ${task}
${VOICE}
English, ${c.country === 'GB' ? 'British' : 'American'} spelling. 15 to 50 words, plain text, no links, no prices. End with one simple question (last character "?"). Start with "Hi," and don't sign off. JSON: {"body": "..."}`,
      prompt: context + (i ? `\n\nYour last draft broke these rules: ${problems.join('; ')}. Fix them.` : '') }).catch(() => null)
    const b = String((j && j.body) || '').trim()
    problems = [...checkDraft({ subject: 'Re: x', body: b }, { followUp: true }), ...checkAnswer(b + ' x x x x x x x x x x x x', 'answer').filter((x) => !/words/.test(x))]
    if (b && !problems.length) return b
  }
  return null
}
export { offerOf }
