// Sign-in, two-step codes, sessions, permissions and the audit log. Server only.
import 'server-only'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2'
import { TOTP, Secret } from 'otpauth'
import { q, one } from './db'
import { token, sha256, decrypt } from './crypto'

export const SESSION_COOKIE = '__Host-olex_sess'
export const PENDING_COOKIE = '__Host-olex_pend'
const LIMIT = { fails: 5, windowMin: 15, lockMin: 15 }
const LIFE = { owner: { idleH: 72, maxD: 14 }, editor: { idleH: 24, maxD: 7 } }
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 }          // OWASP's recommended Argon2id settings
// a real hash of a random password, so an unknown email costs the same time as a wrong password
const dummyHash = () => (globalThis.__olexDummy ||= argonHash(token(), ARGON))
if (process.env.NEXT_PHASE !== 'phase-production-build') dummyHash().catch(() => {})   // ready as the server starts, so the first sign-ins look alike too

export const hashPassword = (pw) => argonHash(pw, ARGON)

export function clientIp() {
  const h = headers()
  return (h.get('x-real-ip') || (h.get('x-forwarded-for') || '').split(',')[0] || 'unknown').trim().slice(0, 64)
}
export async function audit(userId, action, detail = {}, ip = null) {
  await q('insert into audit_log (user_id, action, detail, ip) values ($1, $2, $3, $4)', [userId, action, JSON.stringify(detail), ip])
}

// ---------- throttling: per email and per network ----------
async function lockedFor(key) {
  const r = await one('select locked_until from login_throttle where key = $1 and locked_until > now()', [key])
  return r ? Math.ceil((new Date(r.locked_until) - Date.now()) / 60000) : 0
}
async function fail(key) {
  await q(`insert into login_throttle (key, fails, window_start) values ($1, 1, now())
           on conflict (key) do update set
             fails = case when login_throttle.window_start < now() - make_interval(mins => $2) then 1 else login_throttle.fails + 1 end,
             window_start = case when login_throttle.window_start < now() - make_interval(mins => $2) then now() else login_throttle.window_start end`, [key, LIMIT.windowMin])
  await q(`update login_throttle set locked_until = now() + make_interval(mins => $2), fails = 0, window_start = now()
           where key = $1 and fails >= $3`, [key, LIMIT.lockMin, LIMIT.fails])
}
const clear = (key) => q('delete from login_throttle where key = $1', [key])

// ---------- step 1: email and password ----------
export async function checkPassword(emailRaw, password, ip) {
  const email = String(emailRaw || '').trim().toLowerCase().slice(0, 200)
  if (!email || !password || String(password).length > 200) return { error: 'Enter your email and password.' }
  const wait = Math.max(await lockedFor('e:' + email), await lockedFor('i:' + ip))
  if (wait) return { error: `Too many attempts. Try again in ${wait} minute${wait === 1 ? '' : 's'}.` }
  const u = await one("select id, password_hash, totp_enabled, disabled_at, role from admin_users where email = $1 and role in ('owner', 'editor')", [email])
  const ok = await argonVerify(u && u.password_hash ? u.password_hash : await dummyHash(), String(password)).catch(() => false)   // same work either way
  if (!u || !ok || u.disabled_at || !u.totp_enabled) {
    await fail('e:' + email); await fail('i:' + ip)
    await audit(u ? u.id : null, 'sign_in_failed', { email, step: 'password' }, ip)
    return { error: 'That email and password don’t match.' }
  }
  const t = token()
  await q("insert into pending_logins (id_hash, user_id, expires_at) values ($1, $2, now() + interval '5 minutes')", [sha256(t), u.id])
  return { pending: t }
}

// ---------- step 2: authenticator code or a recovery code ----------
export async function checkSecondStep(pendingToken, codeRaw, ip, userAgent) {
  const code = String(codeRaw || '').replace(/\s+/g, '').slice(0, 20)
  const p = await one('select p.user_id, p.attempts, u.totp_secret_enc, u.totp_last_step, u.recovery_hashes, u.role, u.email from pending_logins p join admin_users u on u.id = p.user_id where p.id_hash = $1 and p.expires_at > now() and u.disabled_at is null', [sha256(pendingToken || '')])
  if (!p) return { error: 'Your sign-in expired. Start again.', restart: true }
  if (await lockedFor('i:' + ip)) return { error: 'Too many attempts. Try again later.', restart: true }
  let ok = false, usedStep = null, usedRecovery = null
  if (/^\d{6}$/.test(code)) {
    const totp = new TOTP({ issuer: 'Olexweb', label: p.email, algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(decrypt(p.totp_secret_enc)) })
    const delta = totp.validate({ token: code, window: 1 })
    if (delta !== null) { const step = Math.floor(Date.now() / 30000) + delta; if (step > Number(p.totp_last_step)) { ok = true; usedStep = step } }
  } else if (/^[a-z2-9]{4}-?[a-z2-9]{4}$/i.test(code)) {      // recovery code, e.g. k7mq-w3zp
    const h = sha256(code.toLowerCase().replace('-', ''))
    if (p.recovery_hashes.includes(h)) { ok = true; usedRecovery = h }
  }
  if (!ok) {
    await q('update pending_logins set attempts = attempts + 1 where id_hash = $1', [sha256(pendingToken)])
    if (p.attempts + 1 >= 5) await q('delete from pending_logins where id_hash = $1', [sha256(pendingToken)])
    await fail('i:' + ip); await audit(p.user_id, 'sign_in_failed', { step: 'code' }, ip)
    return { error: 'That code didn’t work. Use the newest code in your app.', restart: p.attempts + 1 >= 5 }
  }
  await q('delete from pending_logins where id_hash = $1', [sha256(pendingToken)])
  if (usedStep !== null) await q('update admin_users set totp_last_step = $2 where id = $1', [p.user_id, usedStep])
  if (usedRecovery) await q('update admin_users set recovery_hashes = array_remove(recovery_hashes, $2) where id = $1', [p.user_id, usedRecovery])
  await clear('e:' + p.email)
  const life = LIFE[p.role] || LIFE.editor, t = token()
  await q('insert into sessions (id_hash, user_id, expires_at, ip, user_agent) values ($1, $2, now() + make_interval(days => $3), $4, $5)', [sha256(t), p.user_id, life.maxD, ip, String(userAgent || '').slice(0, 200)])
  await audit(p.user_id, 'signed_in', { recoveryCode: !!usedRecovery }, ip)
  return { session: t, maxAge: life.maxD * 86400 }
}

// ---------- sessions ----------
export async function currentUser() {
  const t = cookies().get(SESSION_COOKIE)?.value
  if (!t) return null
  const s = await one(`select s.id_hash, s.last_seen, u.id, u.email, u.name, u.role, u.perms from sessions s join admin_users u on u.id = s.user_id
                       where s.id_hash = $1 and s.expires_at > now() and u.disabled_at is null`, [sha256(t)])
  if (!s) return null
  const idle = (LIFE[s.role] || LIFE.editor).idleH * 3600e3
  if (Date.now() - new Date(s.last_seen) > idle) { await q('delete from sessions where id_hash = $1', [s.id_hash]); return null }
  if (Date.now() - new Date(s.last_seen) > 5 * 60e3) await q('update sessions set last_seen = now() where id_hash = $1', [s.id_hash])
  return { id: s.id, email: s.email, name: s.name, role: s.role, perms: s.perms, sessionHash: s.id_hash }
}
export async function requireUser() { const u = await currentUser(); if (!u) redirect('/admin/login'); return u }
// Permissions are checked here on the server, never only in the interface.
export const can = (u, perm) => !!u && (u.role === 'owner' || (u.role === 'editor' && !!(u.perms || {})[perm]))
export const ownerOnly = (u) => !!u && u.role === 'owner'
export async function endSession(hash) { await q('delete from sessions where id_hash = $1', [hash]) }
export async function endOtherSessions(userId, keepHash) { const r = await q('delete from sessions where user_id = $1 and id_hash <> $2', [userId, keepHash]); return r.rowCount }

// ---------- requests that change something must come from this site ----------
export function sameOrigin(request) {
  const origin = request.headers.get('origin'); if (!origin) return false
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  try { return new URL(origin).host === host } catch { return false }
}
