// Olex Sales: the first email, written by the free AI pool from the company's real signals, then checked by plain code
// (no AI) before it reaches Olaitan's outbox. Rules (from Harvey's playbook, MIT): under 75 words, one specific
// observation, no pitch, no links, one simple question at the end, no AI-sounding phrases, nothing invented.
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { askJSON } from '@/lib/assistant/llm'
import { VOICE, FR_PS, FR_OPT_OUT, POSITIONING } from './playbook'

const BANNED = [/hope (this|you|all)[^.]{0,20}(finds|is|are) (you )?well/i, /i wanted to reach out/i, /reaching out/i, /circling back/i, /touch(ing)? base/i, /quick question/i,
  /synerg/i, /game[- ]?changer/i, /revolutioni[sz]e/i, /leverage/i, /cutting[- ]edge/i, /\bunlock\b/i, /elevate/i, /seamless/i, /in today'?s (digital|fast)/i, /as an ai/i, /dear sir/i, /\[.*?\]|\{\{.*?\}\}/]
const LINK = /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|co\.uk|uk|net|org|io|dev)\b/i

// what each signal lets the email say (facts only)
const FACT = {
  NO_WEBSITE: (s) => `They don't seem to have a website (${s.evidence}).`,
  SITE_DOWN: (s) => `Their website didn't load when checked (${s.evidence}).`,
  SLOW_MOBILE: (s) => `Their homepage is slow on phones: ${s.evidence}.`,
  NOT_MOBILE: () => 'Their website has no mobile layout, so it shows as a shrunken desktop page on phones.',
  NO_HTTPS: () => 'Their website has no padlock (not HTTPS), so browsers mark it "Not secure".',
  NO_BOOKING: () => 'Customers can’t book online on their website; they have to call or email.',
  OLD_COPYRIGHT: (s) => `Their website footer still says © ${s.value_num}, so it looks out of date.`,
  AGENCY: (s) => `They are an agency that sells websites or marketing to their own clients (${s.evidence}).`,   // Install 21
}
// Install 21: the address a contact-form message gives for replies (the outreach inbox the agent reads)
export const formReplyTo = () => process.env.GMAIL_USER || (process.env.SALES_TEST_BASE ? 'olaitan.test@gmail.test' : '')
const PARTNER_SYSTEM = (S, c, fr, contact) => `You write one short email from ${S.sender_name}, who runs Olexweb, a small web studio, to ${c.name}, an agency that sells websites or marketing to its own clients. ${{ GB: 'UK', US: 'US', FR: 'French' }[c.country] || ''} agency.
${POSITIONING}
${VOICE}
${fr ? 'Write the subject and the body in natural, polite French (vous), as a French professional would. ' : ''}The idea: Olaitan builds websites for agencies under the agency's own name (white-label), so they can take on more client work without hiring. He is a partner, not a competitor: the agency keeps the client and the margin. Rules, all required:
- 40 to 70 words in the body. Plain text. No links, no web addresses, no prices.
- Open with what they do (from the facts), in one plain sentence. Then one sentence on the partner idea. Mention that every build is motion-led and unique.
- End with ONE simple yes/no question, for example whether a short call or a sample build would be useful. The body's last character must be "?".
- Use only the facts given. Never invent clients, numbers or details. ${fr ? 'French' : c.country === 'GB' ? 'British spelling' : 'American spelling'}. No "reaching out", no exclamation marks.
- Start with "${fr ? 'Bonjour' : 'Hi'}${contact && contact.name ? ' ' + contact.name.split(' ')[0] : ''}," and do not sign off (the signature is added later).
- Subject: 2 to 6 words, lowercase except names (e.g. "builds for ${c.name.split(' ').slice(0, 2).join(' ')} clients"). No "Re:".
Answer as JSON: {"subject": "...", "body": "..."}`
export function factsFor(signals) { return signals.filter((s) => FACT[s.code]).map((s) => FACT[s.code](s)) }

export function checkDraft({ subject, body }, { followUp = false } = {}) {
  const problems = []
  const words = String(body || '').trim().split(/\s+/).filter(Boolean).length, [lo, hi] = followUp ? [12, 50] : [25, 75]
  if (!subject || subject.length > (followUp ? 120 : 60)) problems.push('subject missing or too long')
  if (words < lo || words > hi) problems.push(`body is ${words} words (${lo}–${hi} allowed)`)
  if (LINK.test(body) || LINK.test(subject)) problems.push('contains a link (the first email has none)')
  for (const b of BANNED) if (b.test(body) || b.test(subject)) { problems.push('uses a phrase that sounds like a template: ' + b.source.slice(0, 30)); break }
  if (!/\?\s*$/.test(String(body).trim().split('\n').filter(Boolean).slice(-1)[0] || '')) problems.push('doesn’t end with a question')
  if (!followUp && /^re:|^fwd?:/i.test(subject || '')) problems.push('fake reply or forward subject')   // follow-ups really are in the same thread
  if (/<[a-z]/i.test(body)) problems.push('contains HTML')
  return problems
}

// draft the first email for one qualified company (to its best published address); returns the outbox id
export async function draftFirst(companyId) {
  const c = await one('select * from sales_companies where id = $1', [companyId]); if (!c) return null
  const contact = await one("select * from sales_contacts where company_id = $1 and email_status = 'deliverable' and opted_out_at is null order by (name is not null) desc, id limit 1", [companyId])
  const viaForm = !contact && c.channel === 'form' && !!c.form_url                 // Install 21: no email, but their contact form
  if (!contact && !viaForm) return null
  if (await one("select 1 from sales_outbox where company_id = $1 and status in ('waiting', 'approved', 'sent', 'held')", [companyId])) return null
  const signals = (await q('select * from sales_signals where company_id = $1', [companyId])).rows, facts = factsFor(signals)
  if (!facts.length) return null
  const S = await one('select * from sales_settings where id = 1')
  const first = String(S.sender_name || 'Olaitan').split(' ')[0]
  const fr = c.country === 'FR'
  // personal preview: a mock-up of a new homepage, made before the email so the email can offer it (lib/sales/preview.js)
  const isPartner = signals.some((x) => x.code === 'AGENCY')
  let preview = null
  if (S.previews_enabled !== false && !isPartner) { try { const { makePreview } = await import('./preview'); preview = await makePreview(companyId) } catch {} }
  const ask = preview ? (S.preview_in_first
      ? `- End with ONE simple yes/no question about whether the mock-up you made of a new homepage for them is worth a short chat (the link is added under the email). The body's last character must be "?".`
      : `- End with ONE simple yes/no question offering the mock-up you already made of a new homepage for them, for example "I put together a quick mock-up of how your homepage could look. Want me to send it over?". Don't say it's free, don't describe it in detail. The body's last character must be "?".`)
    : `- End with ONE simple yes/no question about whether they'd like a quick idea or a short call. The body's last character must be "?".`
  let system = `You write one short cold email from ${S.sender_name}, who runs Olexweb (a web studio building websites, redesigns, and booking and lead systems for small businesses), to a ${{ GB: 'UK', US: 'US', FR: 'French' }[c.country] || 'US'} business.
${POSITIONING}
${VOICE}
${fr ? 'Write the subject and the body in natural, polite French (vous), as a French professional would. ' : ''}Write like a real person writing one email, not a marketer. Rules, all required:
- 40 to 70 words in the body. Plain text. No links, no web addresses, no attachments, no prices.
- Open with the one most useful fact below, stated plainly and kindly (it's a helpful observation, never an insult).
- One sentence on what that likely costs them (missed calls, people leaving, bookings lost after hours). No pitch, no list of services.
${ask}
- Use only the facts given. Never invent numbers, names, reviews or details.
- ${fr ? 'French' : c.country === 'GB' ? 'British spelling' : 'American spelling'}. No greetings like "I hope this finds you well". No "reaching out". No exclamation marks.
- Start with "${fr ? 'Bonjour' : 'Hi'}${contact && contact.name ? ' ' + contact.name.split(' ')[0] : ''}," and do not sign off (the signature is added later).
- Subject: 2 to 6 words, lowercase except names, about their business (e.g. "${c.name.split(' ').slice(0, 3).join(' ')} website on phones"). No "Re:".
Answer as JSON: {"subject": "...", "body": "..."}`
  if (isPartner) system = PARTNER_SYSTEM(S, c, fr, contact)                    // Install 21: an agency gets the partner pitch
  const prompt = `Business: ${c.name}${c.city ? ', ' + c.city : ''} (${c.category || 'small business'}).\nFacts:\n- ${facts.join('\n- ')}`
  let draft = null, problems = []
  for (let attempt = 0; attempt < 3 && !draft; attempt++) {
    const j = await askJSON({ system, prompt: attempt ? prompt + `\n\nYour last draft had problems: ${problems.join('; ')}. Fix them.` : prompt, kind: 'quick', temperature: 0.5 }).catch(() => null)
    if (!j || !j.body) { problems = ['no draft came back']; continue }
    const d = { subject: String(j.subject || '').trim().replace(/^["']|["']$/g, ''), body: String(j.body || '').trim() }
    problems = checkDraft(d); if (!problems.length) draft = d
  }
  if (!draft) { await q("update sales_companies set status = 'write_failed', profile_error = $2 where id = $1", [companyId, 'The draft kept breaking the rules: ' + problems.join('; ')]); return null }
  // a contact form has no email footer, so the message itself says who it's from, how to reply and how to say no
  const formTail = viaForm ? `\n${S.sender_name}, Olexweb (olexweb.com)\n${fr ? 'Répondez simplement à cet e-mail : ' : 'Just reply to this address: '}${formReplyTo()}\n\n${fr ? FR_OPT_OUT : 'Not interested? Reply “no thanks” and I won’t contact you again.'}` : ''
  const link = preview && S.preview_in_first ? `\n\n${fr ? 'La maquette' : 'The mock-up'}: ${preview.url}` : ''     // only when "link in the first email" is on
  const body = `${draft.body}${link}\n\n${first}${viaForm ? formTail : '\nOlexweb'}${fr ? '\n\n' + FR_PS : ''}`   // French: replies come in English (said by code, not left to the AI)
  const r = await one(`insert into sales_outbox (company_id, contact_id, step, subject, body, status, channel) values ($1, $2, 1, $3, $4, $5, $6) returning id`,
    [companyId, contact ? contact.id : null, draft.subject, body, S.require_approval ? 'waiting' : 'approved', viaForm ? 'form' : 'email'])
  await q("update sales_companies set status = 'drafted' where id = $1", [companyId])
  if (link) await q('update sales_previews set shared_at = coalesce(shared_at, now()) where company_id = $1', [companyId])
  return r.id
}

// a follow-up (step 2 after 3 days, step 3 after 7), only when there has been no reply of any kind; same thread
export async function draftFollowUp(companyId, step) {
  const c = await one('select * from sales_companies where id = $1', [companyId]); if (!c || c.status !== 'contacted') return null
  if (await one("select 1 from sales_replies where company_id = $1", [companyId])) return null
  if (await one("select 1 from sales_outbox where company_id = $1 and status in ('waiting', 'approved', 'held')", [companyId])) return null
  const prev = await one("select * from sales_outbox where company_id = $1 and status = 'sent' order by step desc, id desc limit 1", [companyId])
  const firstMsg = await one("select * from sales_outbox where company_id = $1 and step = 1 and status = 'sent'", [companyId])
  if (!prev || !firstMsg || prev.step !== step - 1) return null
  const S = await one('select * from sales_settings where id = 1'), first = String(S.sender_name || 'Olaitan').split(' ')[0]
  const system = `Write a short follow-up (${step === 2 ? 'the first' : 'the last'} one) to a cold email from ${S.sender_name} of Olexweb, a web studio. Plain text, 15 to 45 words, kind and low-pressure,
${c.country === 'FR' ? 'Write it in natural, polite French (vous); start with "Bonjour,"' : c.country === 'GB' ? 'British spelling' : 'American spelling'}. ${step === 3 ? 'Say this is the last note and it is fine if now is not the time.' : 'Briefly bring the point back to mind with one new, useful angle (no new facts beyond the original email).'}
End with one simple yes/no question (last character "?"). No links. No "just following up", no "circling back", no guilt. Start with "${c.country === 'FR' ? 'Bonjour' : 'Hi'}," and don't sign off. Answer JSON: {"body": "..."}`
  let body = null, problems = []
  for (let i = 0; i < 3 && !body; i++) {
    const j = await askJSON({ system, prompt: `The original email:\n"""${String(firstMsg.body).slice(0, 900)}"""${i ? `\nYour last draft had problems: ${problems.join('; ')}. Fix them.` : ''}`, kind: 'quick', temperature: 0.5 }).catch(() => null)
    const b = String((j && j.body) || '').trim(); problems = checkDraft({ subject: 'Re: ' + firstMsg.subject, body: b }, { followUp: true }); if (b && !problems.length) body = b
  }
  if (!body) return null
  const r = await one(`insert into sales_outbox (company_id, contact_id, step, subject, body, status, in_reply_to) values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [companyId, firstMsg.contact_id, step, 'Re: ' + firstMsg.subject, `${body}\n\n${first}`, S.require_approval ? 'waiting' : 'approved', prev.message_id])
  return r.id
}
