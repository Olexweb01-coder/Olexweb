// Olexweb Meet's emails: sign-in and sign-up codes, password resets, and the welcome email. Sent through Olexweb Mail
// (lib/mail), the site's own email platform: its pipes, limits, log and do-not-send list apply. Codes always go first.
// DESIGN: table layout and inline styles (what Gmail, Outlook and phone mail apps reliably show), Olexweb's colours,
//   a plain-text version for spam filters and simple mail apps, and no tracking pixels or links to click for codes.
import 'server-only'
import { sendMail, mailReady } from '@/lib/mail'
import { frame, p, esc } from '@/lib/mail/design'                       // the shared Olexweb Mail design

export const emailReady = () => mailReady()
export const send = ({ to, subject, html, text, kind = 'code' }) => sendMail({ to, subject, html, text, kind, source: 'meet' })

// ---------- the designs ----------
const site = () => (process.env.MEET_ORIGIN || 'https://meet.olexweb.com').replace(/\/$/, '')
function codeBox(code) {
  const digits = String(code).split('').map((d) => `<td style="width:44px;height:54px;background:#f3f6f0;border:1px solid #d9e6d0;border-radius:10px;text-align:center;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:28px;font-weight:700;color:#151815">${d}</td><td style="width:6px"></td>`).join('')
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 20px"><tr>${digits}</tr></table>`
}
const WHAT = { signup: ['Confirm your email', 'to finish creating your Olexweb Meet account'], signin: ['Your sign-in code', 'to sign in to Olexweb Meet'], reset: ['Reset your password', 'to choose a new password for Olexweb Meet'] }

export function codeEmail({ code, purpose = 'signin', name = '' }) {
  const [heading, why] = WHAT[purpose] || WHAT.signin
  const hi = name ? `Hi ${esc(name.split(' ')[0])},` : 'Hi,'
  const body = p(hi) + p(`Use this code ${why}. It works for 10 minutes.`) + codeBox(code)
    + p('<span style="color:#6b6f69;font-size:14px">Type it on the page where you asked for it. We’ll never ask for this code by phone, chat or email.</span>')
  const foot = 'Didn’t ask for this? You can ignore this email; nobody can get in without the code. If you keep getting these, reply and let us know.'
  return { subject: `${code} is your Olexweb Meet code`, html: frame({ preheader: `Your code is ${code}. It works for 10 minutes.`, heading, body, foot }),
    text: `${heading}\n\n${hi}\n\nUse this code ${why}: ${code}\nIt works for 10 minutes.\n\nWe’ll never ask for this code by phone, chat or email.\nDidn’t ask for this? Ignore this email; nobody can get in without the code.\n\nOlexweb Meet: ${site()}` }
}
export function welcomeEmail({ name = '' }) {
  const s = site(), first = name ? esc(name.split(' ')[0]) : 'there'
  const item = (t, d) => `<tr><td style="padding:0 0 12px;vertical-align:top;width:26px;font-size:16px;color:#4c8a33">✓</td><td style="padding:0 0 12px;font-size:15px;line-height:1.55;color:#2b2f2a"><b>${t}</b><br><span style="color:#5d615b">${d}</span></td></tr>`
  const body = p(`Welcome, ${first}. Your Olexweb Meet account is ready.`) + p('Here’s what you can do now:')
    + `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 18px">${item('Start or schedule a meeting', 'Share the link; guests join from their browser, no account needed.')}${item('Keep calls clear on weak networks', 'Voice comes first, video adjusts, and Data saver helps on small bundles.')}${item('Record and take AI notes', 'Recordings save on your device; AI notes give you a summary and action items.')}</table>`
    + `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr><td style="background:#8fe36a;border-radius:999px"><a href="${s}/" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:700;color:#0e1a0b;text-decoration:none">Open Olexweb Meet</a></td></tr></table>`
    + p('<span style="color:#6b6f69;font-size:14px">Tip: install it as an app from your browser’s menu, so it’s one tap away.</span>')
  return { subject: 'Welcome to Olexweb Meet', html: frame({ preheader: 'Your account is ready. Start a meeting in seconds.', heading: 'You’re all set', body, foot: 'Questions or ideas? Just reply to this email.' }),
    text: `You’re all set\n\nWelcome, ${name ? name.split(' ')[0] : 'there'}. Your Olexweb Meet account is ready.\n\n- Start or schedule a meeting: share the link; guests join from their browser, no account needed.\n- Keep calls clear on weak networks.\n- Record and take AI notes.\n\nOpen Olexweb Meet: ${s}/\n\nQuestions or ideas? Just reply to this email.` }
}
