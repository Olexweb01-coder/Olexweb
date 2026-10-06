// People: invite editors, set what they can do, remove access, and the two-step joining flow. Owner only, except joining.
import 'server-only'
import { randomInt } from 'node:crypto'
import { TOTP, Secret } from 'otpauth'
import QRCode from 'qrcode'
import { q, one } from './db'
import { token, sha256, encrypt, decrypt } from './crypto'
import { ownerOnly, audit, hashPassword } from './auth'
import { Refused } from './content'

const PERMS = ['publish', 'reviews', 'testimonials', 'ventures']
const perms = (p = {}) => Object.fromEntries(PERMS.map((k) => [k, p[k] === true]))
const SITE = 'https://olexweb.com'
const ownerCheck = (u) => { if (!ownerOnly(u)) throw new Refused('Only Olaitan can manage people.', 403) }

export async function invite(u, ip, d) {
  ownerCheck(u)
  const email = String(d.email || '').trim().toLowerCase().slice(0, 200)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Refused('Enter their email address.')
  if (await one('select 1 from admin_users where email = $1', [email])) throw new Refused('That email already has an account.')
  const t = token(24)
  await q('delete from invites where email = $1 and used_at is null', [email])          // one open invite per person
  await q("insert into invites (token_hash, email, perms, expires_at, created_by) values ($1, $2, $3, now() + interval '48 hours', $4)", [sha256(t), email, JSON.stringify(perms(d.perms)), u.id])
  await audit(u.id, 'editor_invited', { email }, ip)
  return { link: SITE + '/admin/join/' + t }
}
export async function setPerms(u, ip, d) {
  ownerCheck(u)
  const r = await one("update admin_users set perms = $2 where id = $1 and role = 'editor' returning email", [d.id, JSON.stringify(perms(d.perms))])
  if (!r) throw new Refused('That editor no longer exists.', 404)
  await audit(u.id, 'editor_permissions_changed', { email: r.email, perms: perms(d.perms) }, ip); return { ok: true }
}
export async function removeAccess(u, ip, d) {
  ownerCheck(u)
  const r = await one("update admin_users set disabled_at = now() where id = $1 and role = 'editor' and disabled_at is null returning email", [d.id])
  if (!r) throw new Refused('That editor no longer has access.', 404)
  await q('delete from sessions where user_id = $1', [d.id]); await q('delete from pending_logins where user_id = $1', [d.id])
  await audit(u.id, 'editor_removed', { email: r.email }, ip); return { ok: true }
}
export async function cancelInvite(u, ip, d) {
  ownerCheck(u)
  await q('delete from invites where email = $1 and used_at is null', [String(d.email || '').toLowerCase()])
  await audit(u.id, 'invite_cancelled', { email: d.email }, ip); return { ok: true }
}

// ---------- joining (the invited person, not signed in) ----------
async function openInvite(t) {
  if (!t || !/^[A-Za-z0-9_-]{20,64}$/.test(t)) return null
  return one('select token_hash, email, perms, name, password_hash, totp_secret_enc from invites where token_hash = $1 and used_at is null and expires_at > now()', [sha256(t)])
}
export async function inviteFor(t) { const i = await openInvite(t); return i ? { email: i.email } : null }

export async function joinStart(d) {
  const i = await openInvite(d.token); if (!i) throw new Refused('This invite has expired or was already used. Ask Olaitan for a new one.', 410)
  const name = String(d.name || '').replace(/\s+/g, ' ').trim().slice(0, 81), pw = String(d.password || '')
  if (name.length < 2 || name.length > 80) throw new Refused('Add your name.')
  if (pw.length < 10 || pw.length > 200) throw new Refused('Use at least 10 characters for your password.')
  if (['password', '123456', 'qwerty', 'olexweb', 'admin', 'letmein'].some((w) => pw.toLowerCase().includes(w))) throw new Refused('Avoid common words in your password.')
  const secret = new Secret({ size: 20 })
  await q('update invites set name = $2, password_hash = $3, totp_secret_enc = $4 where token_hash = $1', [i.token_hash, name, await hashPassword(pw), encrypt(secret.base32)])
  const uri = new TOTP({ issuer: 'Olexweb', label: i.email, algorithm: 'SHA1', digits: 6, period: 30, secret }).toString()
  return { qr: await QRCode.toString(uri, { type: 'svg', margin: 1, color: { dark: '#0a0b0a', light: '#f2efe9' } }), key: secret.base32.match(/.{1,4}/g).join(' ') }
}
export async function joinFinish(d, ip) {
  const i = await openInvite(d.token); if (!i) throw new Refused('This invite has expired or was already used. Ask Olaitan for a new one.', 410)
  if (!i.totp_secret_enc || !i.password_hash) throw new Refused('Start again from your invite link.', 400)
  const code = String(d.code || '').replace(/\s/g, '')
  const totp = new TOTP({ issuer: 'Olexweb', label: i.email, algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(decrypt(i.totp_secret_enc)) })
  const delta = /^\d{6}$/.test(code) ? totp.validate({ token: code, window: 1 }) : null
  if (delta === null) throw new Refused('That code didn’t match. Use the newest code in your app.', 401)
  const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789'
  const recovery = Array.from({ length: 10 }, () => { const r = Array.from({ length: 8 }, () => ALPHA[randomInt(ALPHA.length)]).join(''); return r.slice(0, 4) + '-' + r.slice(4) })
  const used = await one('update invites set used_at = now() where token_hash = $1 and used_at is null returning email', [i.token_hash])
  if (!used) throw new Refused('This invite was already used.', 410)
  const user = await one(`insert into admin_users (email, name, role, password_hash, totp_secret_enc, totp_enabled, totp_last_step, recovery_hashes, perms)
                          values ($1, $2, 'editor', $3, $4, true, $5, $6, $7) returning id`,
    [i.email, i.name, i.password_hash, i.totp_secret_enc, Math.floor(Date.now() / 30000) + delta, recovery.map((r) => sha256(r.replace('-', ''))), JSON.stringify(i.perms)])
  await q('update invites set password_hash = null, totp_secret_enc = null where token_hash = $1', [i.token_hash])   // nothing sensitive left behind
  await audit(user.id, 'editor_joined', { email: i.email }, ip)
  return { recovery }
}
