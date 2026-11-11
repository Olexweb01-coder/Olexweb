// Private apps (Install 24): software only people Olaitan approves can download. First: Graceville Fast Bible.
// 1. Someone opens olexweb.com/tools/<app>, taps Request download and gives their name and email (phone optional).
//    This browser gets a private key (a cookie; only its hash is kept) and Olaitan gets a notification.
// 2. He approves (or declines) in Admin → Downloads. The waiting page sees it and downloads the installer at once,
//    in 4 MiB pieces through the site (each checked against that key), saved as the real file in their Downloads.
//    He can also ban someone: no more downloads, on any device, and new requests from that email are refused.
// 3. Approved people download again any time on the same browser. On a new device they ask again with the same
//    email and get an email link that lets that device in, with no new approval needed.
// The installer lives in the private bucket, in pieces (lib/admin/storage.js); there's no public link to it.
import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { q, one } from '@/lib/admin/db'
import { Refused } from '@/lib/admin/content'
import { notify } from '@/lib/assistant/notify'
import { getAppPiece, putAppPiece, deleteAppPiece } from '@/lib/admin/storage'

export const APPS = { 'graceville-fast-bible': { name: 'Graceville Fast Bible', church: 'Graceville' } }
export const PIECE = 4 * 1024 * 1024
export const COOKIE = (app) => 'olx_app_' + app.replace(/-/g, '_')
const sha = (s) => createHash('sha256').update(String(s)).digest('hex')
const EMAIL = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,24}$/i
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001F\u007F<>]/g, '').trim().slice(0, max)
const mainOrigin = () => String(process.env.MAIN_ORIGIN || 'https://olexweb.com').trim().replace(/\/$/, '')
export const appOk = (app) => Object.prototype.hasOwnProperty.call(APPS, String(app || ''))
const key = (app, rel, n) => `app/${app}/${rel}/${String(n).padStart(4, '0')}.bin`

export async function liveRelease(app) {
  const r = await one("select id, version, filename, size, pieces, live_at from app_releases where app = $1 and status = 'live' order by live_at desc limit 1", [app])
  return r ? { id: Number(r.id), version: r.version, filename: r.filename, size: Number(r.size), pieces: r.pieces, live_at: r.live_at && r.live_at.toISOString() } : null
}
async function device(app, token) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null
  return one('select * from app_access where app = $1 and device_hash = $2', [app, sha(token)])
}
const banned = (app, email) => one("select 1 from app_access where app = $1 and lower(email) = lower($2) and status = 'banned' limit 1", [app, email])
const approvedBefore = (app, email) => one("select 1 from app_access where app = $1 and lower(email) = lower($2) and status = 'approved' limit 1", [app, email])

// what this browser may do now
export async function statusOf(app, token) {
  if (!appOk(app)) throw new Refused('Unknown app.', 404)
  const d = await device(app, token)
  if (!d) return { status: 'none' }
  if (d.status === 'approved' && await banned(app, d.email)) return { status: 'banned' }
  return { status: d.status, name: d.name, release: d.status === 'approved' ? await liveRelease(app) : null }
}

// a link by email: lets a new device in for someone already approved, or opens the download after approval
async function sendLink(app, row, why) {
  const t = randomBytes(32).toString('base64url')
  await q("update app_access set link_hash = $1, link_expires = now() + interval '2 days' where id = $2", [sha(t), row.id])
  const A = APPS[app], link = `${mainOrigin()}/api/apps/link?t=${t}`
  const { sendMail } = await import('@/lib/mail')
  await sendMail({ to: row.email, kind: 'code', source: 'apps', subject: why === 'device' ? `Your ${A.name} download link` : `You’re approved: download ${A.name}`,
    text: `Hello ${row.name},\n\n${why === 'device' ? `Here’s your link to download ${A.name} on this device.` : `You’ve been approved to download ${A.name}.`}\n\n${link}\n\nOpen it on the Windows computer you want to install it on. The link works for 2 days.\n\n${A.church} media team, via Olexweb`,
    html: `<p>Hello ${row.name.replace(/[<&]/g, '')},</p><p>${why === 'device' ? `Here’s your link to download <b>${A.name}</b> on this device.` : `You’ve been approved to download <b>${A.name}</b>.`}</p><p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#8fe36a;color:#0e1a0b;border-radius:99px;font-weight:700;text-decoration:none">Download ${A.name}</a></p><p style="color:#666">Open it on the Windows computer you want to install it on. The link works for 2 days.</p><p>${A.church} media team, via Olexweb</p>` }).catch(() => {})
}

// Request download: returns { status, token? } (token goes into this browser's cookie)
export async function requestAccess(app, b, ip) {
  if (!appOk(app)) throw new Refused('Unknown app.', 404)
  const name = clean(b.name, 80), email = clean(b.email, 200).toLowerCase(), phone = clean(b.phone, 30)
  if (name.length < 2) throw new Refused('Please type your name.')
  if (!EMAIL.test(email)) throw new Refused('That email address doesn’t look right.')
  if (phone && !/^[+\d][\d\s()-]{6,24}$/.test(phone)) throw new Refused('That phone number doesn’t look right.')
  const recent = await one("select count(*)::int as n from app_access where ip = $1 and created_at > now() - interval '1 hour'", [ip])
  if (recent.n >= 6) throw new Refused('Too many requests from here. Try again in an hour.', 429)
  if (await banned(app, email)) return { status: 'banned' }
  const token = randomBytes(32).toString('base64url')
  const known = await approvedBefore(app, email)
  const row = await one('insert into app_access (app, name, email, phone, device_hash, status, ip) values ($1, $2, $3, $4, $5, $6, $7) returning id, name, email',
    [app, name, email, phone || null, sha(token), 'waiting', ip])
  if (known) { await sendLink(app, row, 'device'); return { status: 'check-email', token } }     // approved before: the email link lets this device in
  notify('download', `${name} (${email}) asked to download ${APPS[app].name}. Approve or decline in Downloads.`, '/admin/downloads')
  return { status: 'waiting', token }
}

// the email link: approves the device that opens it (for someone already approved), and gives it a fresh key
export async function openLink(t) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(String(t || ''))) return null
  const row = await one('select * from app_access where link_hash = $1 and link_expires > now()', [sha(t)])
  if (!row || row.status === 'declined' || await banned(row.app, row.email)) return null
  const ok = row.status === 'approved' || await approvedBefore(row.app, row.email); if (!ok) return null
  const token = randomBytes(32).toString('base64url')
  await q("update app_access set device_hash = $1, status = 'approved', decided_at = coalesce(decided_at, now()), link_hash = null, link_expires = null where id = $2", [sha(token), row.id])
  return { app: row.app, token }
}

// one piece of the installer, for an approved, not-banned browser
export async function pieceFor(app, rel, token, n) {
  const d = await device(app, token)
  if (!d || d.status !== 'approved') throw new Refused('Not approved to download this.', 403)
  if (await banned(app, d.email)) throw new Refused('Downloads are switched off for you.', 403)
  const r = await one("select id, pieces from app_releases where id = $1 and app = $2 and status = 'live'", [rel, app])
  if (!r || !(n >= 0 && n < r.pieces)) throw new Refused('That version isn’t available any more. Refresh the page.', 410)
  const res = await getAppPiece(key(app, r.id, n)); if (!res) throw new Refused('The download couldn’t be read. Try again in a minute.', 503)
  return res
}
export async function downloaded(app, token) {
  const d = await device(app, token); if (!d || d.status !== 'approved') return { ok: false }
  await q('update app_access set downloads = downloads + 1, last_download_at = now() where id = $1', [d.id]); return { ok: true }
}

// ---------- the admin side ----------
export async function adminData() {
  const apps = []
  for (const [slug, A] of Object.entries(APPS)) {
    const people = (await q('select id, name, email, phone, status, created_at, decided_at, downloads, last_download_at from app_access where app = $1 order by created_at desc limit 300', [slug])).rows
      .map((r) => ({ ...r, id: Number(r.id), created_at: r.created_at.toISOString(), decided_at: r.decided_at && r.decided_at.toISOString(), last_download_at: r.last_download_at && r.last_download_at.toISOString() }))
    const up = await one("select id, version, filename, size, pieces, cardinality(got) as got from app_releases where app = $1 and status = 'uploading' and created_at > now() - interval '3 days' order by id desc limit 1", [slug])
    apps.push({ slug, ...A, release: await liveRelease(slug), people, uploading: up ? { filename: up.filename, size: Number(up.size), pieces: up.pieces, got: up.got, version: up.version } : null })
  }
  return { apps }
}
export async function decide(id, action) {
  const row = await one('select * from app_access where id = $1', [id]); if (!row) throw new Refused('Not found.', 404)
  if (action === 'approve') {
    await q("update app_access set status = 'approved', decided_at = now() where id = $1", [id])
    await sendLink(row.app, row, 'approved')                     // the page downloads by itself if it's still open; the email covers a closed page
    return { ok: true }
  }
  if (action === 'decline') { await q("update app_access set status = 'declined', decided_at = now() where id = $1 and status = 'waiting'", [id]); return { ok: true } }
  if (action === 'ban') { await q("update app_access set status = 'banned', decided_at = now(), link_hash = null where app = $1 and lower(email) = lower($2)", [row.app, row.email]); return { ok: true } }
  if (action === 'unban') { await q("update app_access set status = 'approved', decided_at = now() where app = $1 and lower(email) = lower($2) and status = 'banned'", [row.app, row.email]); return { ok: true } }
  if (action === 'forget') { await q('delete from app_access where id = $1', [id]); return { ok: true } }
  throw new Refused('Unknown action.')
}
// a new version: start, send the pieces, finish (then it's the one people get, and the old one's pieces are removed)
export async function startRelease(app, b) {
  if (!appOk(app)) throw new Refused('Unknown app.', 404)
  const filename = clean(b.filename, 120), size = Number(b.size), version = clean(b.version, 40) || new Date().toISOString().slice(0, 10)
  if (!/^[\w .()-]+\.(exe|msi|zip)$/i.test(filename)) throw new Refused('Choose the installer (.exe, .msi or .zip).')
  if (!(size > 0)) throw new Refused('That file is empty.')
  // the same file again (after a refresh or a dropped connection): carry on from the pieces that already arrived
  const open = await one("select id, pieces, got from app_releases where app = $1 and status = 'uploading' and filename = $2 and size = $3 and created_at > now() - interval '3 days' order by id desc limit 1", [app, filename, size])
  if (open) { if (version) await q('update app_releases set version = $1 where id = $2', [version, open.id]); return { id: Number(open.id), pieces: open.pieces, pieceSize: PIECE, got: open.got || [], resumed: (open.got || []).length > 0 } }
  const stale = (await q("select id, pieces from app_releases where app = $1 and status = 'uploading' and created_at < now() - interval '3 days'", [app])).rows
  for (const o of stale) { for (let n = 0; n < o.pieces; n++) await deleteAppPiece(key(app, o.id, n)); await q('delete from app_releases where id = $1', [o.id]) }
  const r = await one('insert into app_releases (app, version, filename, size, pieces) values ($1, $2, $3, $4, $5) returning id, pieces', [app, version, filename, size, Math.ceil(size / PIECE)])
  return { id: Number(r.id), pieces: r.pieces, pieceSize: PIECE, got: [], resumed: false }
}
export async function putReleasePiece(id, n, body) {
  const r = await one("select id, app, pieces, size from app_releases where id = $1 and status = 'uploading'", [id]); if (!r) throw new Refused('That upload isn’t open any more. Start again.', 410)
  if (!(n >= 0 && n < r.pieces)) throw new Refused('Bad piece.')
  const want = n < r.pieces - 1 ? PIECE : Number(r.size) - PIECE * (r.pieces - 1)
  if (body.byteLength !== want) throw new Refused(`Piece ${n + 1} arrived with ${body.byteLength} bytes instead of ${want}${body.byteLength < want ? ' (the connection may have cut it short, or the server limits uploads)' : ''}.`)
  try { await putAppPiece(key(r.app, r.id, n), body) } catch (e) { throw new Refused(`Your private storage didn’t take piece ${n + 1}: ${e.message}`, 502) }
  await q('update app_releases set got = case when $2 = any(got) then got else array_append(got, $2) end, received = cardinality(case when $2 = any(got) then got else array_append(got, $2) end) where id = $1', [id, n])
  return { ok: true }
}
export async function finishRelease(id) {
  const r = await one("select * from app_releases where id = $1 and status = 'uploading'", [id]); if (!r) throw new Refused('That upload isn’t open any more.', 410)
  const got = new Set(r.got || []), missing = []; for (let n = 0; n < r.pieces; n++) if (!got.has(n)) missing.push(n + 1)
  if (missing.length) throw new Refused(`${missing.length} piece${missing.length === 1 ? '' : 's'} didn’t arrive (${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}). Choose the same file and tap Upload: it carries on from there.`)
  const old = (await q("select id, pieces from app_releases where app = $1 and status = 'live'", [r.app])).rows
  await q("update app_releases set status = 'old' where app = $1 and status = 'live'", [r.app])
  await q("update app_releases set status = 'live', live_at = now() where id = $1", [id])
  for (const o of old) for (let n = 0; n < o.pieces; n++) await deleteAppPiece(key(r.app, o.id, n))
  return { ok: true, release: await liveRelease(r.app) }
}
