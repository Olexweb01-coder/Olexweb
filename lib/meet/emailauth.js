// Olexweb Meet: signing in with email, alongside Google and the others (lib/meet/auth.js).
//  - Create an account: name, email, password → a 6-digit code by email → the account exists once the code is typed.
//  - Sign in with the password, or with an emailed code (no password needed). Forgot password: a code, then a new one.
// SAFETY: passwords are scrypt hashes (salted, deliberately slow); codes are random, stored as hashes, valid 10 minutes,
// 5 tries each; codes are limited per address (1 a minute, 5 an hour) and per network (20 an hour); failed passwords are
// limited per address (8 in 15 minutes). Answers never reveal whether an address has an account. An email account and a
// Google account with the same verified address are one account (upsertUser). Emails go through Olexweb Mail.
import 'server-only'
import { createHash, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { q, one } from './db'
import { upsertUser, createSession } from './auth'
import { send, codeEmail, welcomeEmail, emailReady } from './email'
import { Refused } from '@/lib/admin/content'

const scrypt = promisify(scryptCb)
const EMAIL = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,24}$/i
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n)
const secret = () => process.env.AUTH_SECRET || ''
const h = (s) => createHash('sha256').update(s).digest('hex')
const codeHash = (email, code) => h(`meet-code:${secret()}:${email}:${code}`)
export const ipHash = (ip) => h(`meet-ip:${secret()}:${ip || ''}`).slice(0, 32)
const GENERIC = 'If that address can sign in, a code is on its way. Check your inbox (and spam).'
export const emailSignInReady = () => emailReady()

function addr(e) { const a = String(e || '').trim().toLowerCase(); if (!EMAIL.test(a)) throw new Refused('Check your email address.'); return a }
const COMMON = new Set(['password', 'password1', '12345678', '123456789', '1234567890', 'qwerty123', 'iloveyou', 'abc12345', 'password123', '11111111', '00000000', 'olexweb123'])
function checkPassword(pw, email) {
  const p = String(pw || '')
  if (p.length < 8) throw new Refused('Use at least 8 characters for your password.')
  if (p.length > 200) throw new Refused('That password is too long.')
  if (COMMON.has(p.toLowerCase()) || p.toLowerCase() === email || p.toLowerCase() === email.split('@')[0]) throw new Refused('That password is too easy to guess. Try a longer one.')
  return p
}
export async function hashPassword(pw) { const salt = randomBytes(16); const k = await scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }); return `scrypt$16384$8$1$${salt.toString('base64')}$${k.toString('base64')}` }
async function passwordMatches(pw, stored) {
  const [alg, N, r, p, salt, key] = String(stored || '').split('$'); if (alg !== 'scrypt') return false
  const want = Buffer.from(key, 'base64'), got = await scrypt(String(pw || ''), Buffer.from(salt, 'base64'), want.length, { N: Number(N), r: Number(r), p: Number(p) })
  return got.length === want.length && timingSafeEqual(got, want)
}
async function liveUser(email) { return one('select id, name, email, password_hash, banned_at from meet_users where lower(email) = $1 and email_verified order by id limit 1', [email]) }

// a code by email: limited per address and per network; the answer is the same whether or not the address has an account
async function issueCode(email, purpose, ip, extra = {}) {
  const ih = ipHash(ip)
  const lim = await one(`select count(*) filter (where lower(email) = $1 and created_at > now() - interval '1 minute')::int as minute,
      count(*) filter (where lower(email) = $1 and created_at > now() - interval '1 hour')::int as hour,
      (select count(*)::int from meet_codes where ip_hash = $2 and created_at > now() - interval '1 hour') as net from meet_codes where lower(email) = $1`, [email, ih])
  if (lim.minute >= 1) throw new Refused('A code was just sent. Wait a minute before asking for another.', 429)
  if (lim.hour >= 5 || lim.net >= 20) throw new Refused('Too many codes asked for. Try again in an hour.', 429)
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  await q(`insert into meet_codes (email, purpose, code_hash, name, pw_hash, ip_hash, expires_at) values ($1, $2, $3, $4, $5, $6, now() + interval '10 minutes')`,
    [email, purpose, codeHash(email, code), extra.name || null, extra.pwHash || null, ih])
  const m = codeEmail({ code, purpose, name: extra.name || '' })
  await send({ to: email, subject: m.subject, html: m.html, text: m.text, kind: 'code' })
}

// create an account (the account exists only once the emailed code is typed)
export async function startSignUp({ name, email, password }, ip) {
  const e = addr(email), n = clean(name, 80)
  if (!n) throw new Refused('Type your name.')
  const pw = checkPassword(password, e)
  const u = await liveUser(e)
  if (u) { if (!u.banned_at) await issueCode(e, 'signin', ip, { name: u.name }); return { next: 'code', message: GENERIC } }   // already has an account: a sign-in code instead
  await issueCode(e, 'signup', ip, { name: n, pwHash: await hashPassword(pw) })
  return { next: 'code', message: GENERIC }
}
// a sign-in code, or a password-reset code (only sent if the address has an account; same answer either way)
export async function sendCode({ email, purpose }, ip) {
  const e = addr(email), p = purpose === 'reset' ? 'reset' : 'signin', u = await liveUser(e)
  if (u && !u.banned_at) await issueCode(e, p, ip, { name: u.name })
  return { next: 'code', message: GENERIC }
}
// the code: signs in (creating the account for a sign-up; setting the new password for a reset)
export async function verifyCode({ email, code, password }) {
  const e = addr(email), c = String(code || '').replace(/\D/g, '')
  const row = await one("select * from meet_codes where lower(email) = $1 and used_at is null and expires_at > now() order by id desc limit 1", [e])
  if (!row || row.attempts >= 5) throw new Refused('That code has expired. Ask for a new one.')
  if (c.length !== 6 || !timingSafeEqual(Buffer.from(codeHash(e, c)), Buffer.from(row.code_hash))) {
    await q('update meet_codes set attempts = attempts + 1 where id = $1', [row.id])
    throw new Refused(row.attempts + 1 >= 5 ? 'Too many wrong codes. Ask for a new one.' : 'That code isn’t right. Check the email and try again.')
  }
  let newPw = null
  if (row.purpose === 'reset') newPw = await hashPassword(checkPassword(password, e))                          // checked before the code is used up
  const used = await one('update meet_codes set used_at = now() where id = $1 and used_at is null returning id', [row.id]); if (!used) throw new Refused('That code was already used. Ask for a new one.')
  const existing = await liveUser(e)
  const user = await upsertUser('email', { subject: e, email: e, verified: true, name: row.name || (existing && existing.name) || e.split('@')[0] })
  if (user.banned_at) throw new Refused('This account can’t use Olexweb Meet.', 403)
  if (row.purpose === 'signup' && row.pw_hash && !user.password_hash) await q('update meet_users set password_hash = $2 where id = $1', [user.id, row.pw_hash])
  if (newPw) await q('update meet_users set password_hash = $2 where id = $1', [user.id, newPw])
  if (newPw) await q('delete from meet_sessions where user_id = $1', [user.id])                                   // a new password signs out everywhere else
  if (row.purpose === 'signup' && !existing) { const w = welcomeEmail({ name: user.name }); send({ to: e, subject: w.subject, html: w.html, text: w.text, kind: 'welcome' }).catch(() => {}) }
  return { token: await createSession(user.id), created: row.purpose === 'signup' && !existing }
}
// sign in with the password (8 wrong tries in 15 minutes pauses it for that address)
export async function passwordSignIn({ email, password }, ip) {
  const e = addr(email)
  const f = await one("select count(*)::int as n from meet_login_fails where lower(email) = $1 and at > now() - interval '15 minutes'", [e])
  if (f.n >= 8) throw new Refused('Too many tries. Wait 15 minutes, or sign in with an emailed code.', 429)
  const u = await liveUser(e)
  const ok = u && u.password_hash ? await passwordMatches(password, u.password_hash) : (await hashPassword('timing-equaliser'), false)   // same effort either way
  if (!ok || u.banned_at) {
    await q('insert into meet_login_fails (email, ip_hash) values ($1, $2)', [e, ipHash(ip)])
    throw new Refused(u && u.banned_at ? 'This account can’t use Olexweb Meet.' : 'Wrong email or password.', u && u.banned_at ? 403 : 400)
  }
  await q('delete from meet_login_fails where lower(email) = $1', [e])
  return { token: await createSession(u.id) }
}
