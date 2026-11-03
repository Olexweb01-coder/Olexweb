// Olexweb Meet accounts. Joining a meeting never needs one; creating or scheduling does.
// Sign-in with Google, Microsoft, GitHub or Facebook (each appears once its keys are in Vercel): the standard OAuth
// "authorization code" flow, with a random state signed with AUTH_SECRET (a forged sign-in is refused) and PKCE where the
// provider supports it. The signed-in browser holds a random secret in an HttpOnly cookie; only its SHA-256 is stored.
// Accounts are joined by email only when the provider says the email is verified (Google, GitHub); Microsoft and Facebook
// sign-ins stay their own accounts, so an unverified email can never take over someone else's. The same verified email as
// the admin's owner makes a Meet account the owner.
import 'server-only'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { q, one } from './db'
import { one as mainOne } from '@/lib/admin/db'

export class AuthError extends Error {}
export const SESSION_COOKIE = '__Host-meet_sess'
const STATE_COOKIE = '__Host-meet_oauth'
const DAYS = 30
const b64 = (buf) => Buffer.from(buf).toString('base64url')
const sha = (s) => createHash('sha256').update(s).digest('hex')
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n)

// Tests point every provider at a stand-in (MEET_OAUTH_TEST_BASE); in production this is never set.
const T = () => String(process.env.MEET_OAUTH_TEST_BASE || '').replace(/\/$/, '')
const at = (provider, real) => (T() ? `${T()}/${provider}${new URL(real).pathname}` : real)
export const PROVIDERS = {
  google: { name: 'Google', id: 'MEET_GOOGLE_CLIENT_ID', secret: 'MEET_GOOGLE_CLIENT_SECRET', pkce: true, scope: 'openid email profile',
    auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', extra: { prompt: 'select_account' } },
  microsoft: { name: 'Microsoft', id: 'MEET_MICROSOFT_CLIENT_ID', secret: 'MEET_MICROSOFT_CLIENT_SECRET', pkce: true, scope: 'openid email profile User.Read',
    auth: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token', extra: { prompt: 'select_account' } },
  github: { name: 'GitHub', id: 'MEET_GITHUB_CLIENT_ID', secret: 'MEET_GITHUB_CLIENT_SECRET', pkce: false, scope: 'read:user user:email',
    auth: 'https://github.com/login/oauth/authorize', token: 'https://github.com/login/oauth/access_token', extra: {} },
  facebook: { name: 'Facebook', id: 'MEET_FACEBOOK_APP_ID', secret: 'MEET_FACEBOOK_APP_SECRET', pkce: false, scope: 'public_profile,email',
    auth: 'https://www.facebook.com/v21.0/dialog/oauth', token: 'https://graph.facebook.com/v21.0/oauth/access_token', extra: {} },
}
export const providerReady = (p) => !!(PROVIDERS[p] && process.env[PROVIDERS[p].id] && process.env[PROVIDERS[p].secret])
export const providers = () => Object.keys(PROVIDERS).filter(providerReady).map((k) => ({ id: k, name: PROVIDERS[k].name }))
const secret = () => { const s = process.env.AUTH_SECRET || ''; if (s.length < 32) throw new AuthError('Sign-in isn’t set up yet.'); return s }
const sign = (v) => v + '.' + createHmac('sha256', secret()).update('meet-oauth:' + v).digest('base64url')
function unsign(s) {
  const i = String(s || '').lastIndexOf('.'); if (i < 1) return null
  const v = s.slice(0, i), a = Buffer.from(s.slice(i + 1)), b = Buffer.from(sign(v).slice(i + 1))
  return a.length === b.length && timingSafeEqual(a, b) ? v : null
}
const safeNext = (n) => (typeof n === 'string' && /^\/(?!\/)[\w\-./?=&%#]*$/.test(n) && n.length < 300 ? n : '/')
export const callbackUrl = (origin, p) => `${origin}/api/meet/auth/${p}/callback`

// step 1: send the person to the provider, remembering (in a signed, 10-minute cookie) where to bring them back
export function startSignIn(p, origin, next) {
  if (!providerReady(p)) throw new AuthError('That sign-in option isn’t available.')
  const P = PROVIDERS[p], state = b64(randomBytes(24)), verifier = P.pkce ? b64(randomBytes(48)) : ''
  const params = new URLSearchParams({ client_id: process.env[P.id], redirect_uri: callbackUrl(origin, p), response_type: 'code', scope: P.scope, state, ...P.extra })
  if (P.pkce) { params.set('code_challenge', b64(createHash('sha256').update(verifier).digest())); params.set('code_challenge_method', 'S256') }
  const cookie = sign(b64(JSON.stringify({ p, state, verifier, next: safeNext(next), t: Date.now() })))
  return { url: at(p, P.auth) + '?' + params, cookie: { name: STATE_COOKIE, value: cookie, httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600 } }
}

async function getJson(url, init, what) {
  let r
  try { r = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(15000) }) } catch { throw new AuthError(`${what} didn’t answer. Try again.`) }
  const j = await r.json().catch(() => null)
  if (!r.ok || !j) throw new AuthError(`${what} refused the sign-in. Try again.`)
  return j
}
// the person's id, email (and whether the provider verified it), name and picture
async function profile(p, token) {
  const H = { Authorization: 'Bearer ' + token, Accept: 'application/json', 'User-Agent': 'Olexweb-Meet' }
  if (p === 'google') { const u = await getJson(at(p, 'https://openidconnect.googleapis.com/v1/userinfo'), { headers: H }, 'Google'); return { subject: u.sub, email: u.email, verified: u.email_verified === true, name: u.name, picture: u.picture } }
  if (p === 'microsoft') { const u = await getJson(at(p, 'https://graph.microsoft.com/oidc/userinfo'), { headers: H }, 'Microsoft'); return { subject: u.sub, email: u.email, verified: false, name: u.name || [u.given_name, u.family_name].filter(Boolean).join(' '), picture: null } }
  if (p === 'github') {
    const u = await getJson(at(p, 'https://api.github.com/user'), { headers: H }, 'GitHub')
    const emails = await getJson(at(p, 'https://api.github.com/user/emails'), { headers: H }, 'GitHub').catch(() => [])
    const e = (Array.isArray(emails) ? emails : []).find((x) => x.primary && x.verified) || (Array.isArray(emails) ? emails : []).find((x) => x.verified)
    return { subject: String(u.id), email: e ? e.email : null, verified: !!e, name: u.name || u.login, picture: u.avatar_url }
  }
  const u = await getJson(at(p, 'https://graph.facebook.com/v21.0/me') + '?fields=id,name,email,picture.type(large)', { headers: H }, 'Facebook')
  return { subject: String(u.id), email: u.email || null, verified: false, name: u.name, picture: u.picture && u.picture.data && u.picture.data.url }
}

// step 2: back from the provider. Checks the state, swaps the code for a token, finds or makes the account, signs in.
export async function finishSignIn(p, origin, query, stateCookie) {
  if (!providerReady(p)) throw new AuthError('That sign-in option isn’t available.')
  const raw = unsign(stateCookie); let st = null
  try { st = raw && JSON.parse(Buffer.from(raw, 'base64url').toString()) } catch {}
  if (!st || st.p !== p || Date.now() - st.t > 600_000) throw new AuthError('The sign-in took too long or was started elsewhere. Try again.')
  if (query.get('error')) throw new AuthError('Sign-in was cancelled.')
  const sa = Buffer.from(String(query.get('state') || '')), sb = Buffer.from(st.state)
  if (sa.length !== sb.length || !timingSafeEqual(sa, sb)) throw new AuthError('That sign-in didn’t match. Try again.')
  const code = query.get('code'); if (!code) throw new AuthError('Sign-in was cancelled.')
  const P = PROVIDERS[p], form = new URLSearchParams({ client_id: process.env[P.id], client_secret: process.env[P.secret], code, redirect_uri: callbackUrl(origin, p), grant_type: 'authorization_code' })
  if (P.pkce) form.set('code_verifier', st.verifier)
  const tok = await getJson(at(p, P.token), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: form }, P.name)
  if (!tok.access_token) throw new AuthError(`${P.name} refused the sign-in. Try again.`)
  const u = await profile(p, tok.access_token)
  if (!u.subject) throw new AuthError(`${P.name} didn’t say who you are. Try again.`)
  const user = await upsertUser(p, u)
  if (user.banned_at) throw new AuthError('This account can’t use Olexweb Meet.')
  return { token: await createSession(user.id), next: st.next || '/', user }
}

async function upsertUser(p, u) {
  const email = u.email ? clean(u.email, 200).toLowerCase() : null, name = clean(u.name, 80) || (email ? email.split('@')[0] : 'Meet user')
  const picture = /^https:\/\/[^\s"'<>]{8,400}$/.test(String(u.picture || '')) ? u.picture : null
  let user = await one('select u.* from meet_identities i join meet_users u on u.id = i.user_id where i.provider = $1 and i.subject = $2', [p, String(u.subject)])
  if (!user && email && u.verified) user = await one('select * from meet_users where lower(email) = $1 and email_verified order by id limit 1', [email])   // same verified email: same person
  if (!user) user = await one('insert into meet_users (email, email_verified, name, picture) values ($1, $2, $3, $4) returning *', [email, !!(email && u.verified), name, picture])
  await q('insert into meet_identities (provider, subject, user_id, email) values ($1, $2, $3, $4) on conflict (provider, subject) do update set email = excluded.email', [p, String(u.subject), user.id, email])
  // the owner: a verified sign-in with the admin owner's email
  let role = user.role
  if (email && u.verified) { const o = await mainOne("select 1 from admin_users where role = 'owner' and disabled_at is null and lower(email) = $1", [email]).catch(() => null); if (o) role = 'owner' }
  return one(`update meet_users set name = case when name = '' then $2 else name end, picture = coalesce($3, picture), last_seen = now(), role = $4,
      email = coalesce(email, $5), email_verified = email_verified or $6 where id = $1 returning *`, [user.id, name, picture, role, email, !!(email && u.verified)])
}
async function createSession(userId) {
  const token = b64(randomBytes(32))
  await q(`insert into meet_sessions (id_hash, user_id, expires_at) values ($1, $2, now() + interval '${DAYS} days')`, [sha(token), userId])
  return token
}
export const sessionCookie = (token) => ({ name: SESSION_COOKIE, value: token, httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: DAYS * 86400 })
export const clearStateCookie = () => ({ name: STATE_COOKIE, value: '', httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
export const stateCookieName = STATE_COOKIE

// who is signed in to Meet in this browser (or null). Never throws.
export async function currentMeetUser() {
  try {
    const t = cookies().get(SESSION_COOKIE)?.value; if (!t || t.length > 100) return null
    const u = await one(`select u.id, u.email, u.name, u.picture, u.role, u.banned_at from meet_sessions s join meet_users u on u.id = s.user_id
      where s.id_hash = $1 and s.expires_at > now()`, [sha(t)])
    if (!u || u.banned_at) return null
    q('update meet_sessions set last_seen = now() where id_hash = $1 and last_seen < now() - interval \'10 minutes\'', [sha(t)]).catch(() => {})
    return { id: u.id, email: u.email, name: u.name, picture: u.picture, role: u.role }
  } catch { return null }
}
export async function signOut() {
  const t = cookies().get(SESSION_COOKIE)?.value
  if (t) await q('delete from meet_sessions where id_hash = $1', [sha(t)]).catch(() => {})
}
