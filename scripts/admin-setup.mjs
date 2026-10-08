// npm run admin:setup
// Checks your settings, connects to Neon, creates the tables, copies in the current content (once),
// tests the private image bucket, and creates the owner account with two-step sign-in.
// Safe to run again: it skips anything already done.
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { createHash, randomBytes, randomInt, createCipheriv, hkdfSync } from 'node:crypto'
import pg from 'pg'
import { hash as argonHash } from '@node-rs/argon2'
import { TOTP, Secret } from 'otpauth'
import QRCode from 'qrcode'
import { AwsClient } from 'aws4fetch'

const ROOT = process.cwd()
const ok = (s) => console.log('  \u2713 ' + s)
const no = (s) => { console.log('  \u2717 ' + s); process.exitCode = 1 }
const step = (s) => console.log('\n' + s)

// ---------- 1. settings ----------
function loadEnv() {
  const f = path.join(ROOT, '.env.local')
  if (!fs.existsSync(f)) return
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const NEED = ['DATABASE_URL', 'DATABASE_URL_POOLED', 'STORAGE_ENDPOINT', 'STORAGE_ACCESS_KEY_ID', 'STORAGE_SECRET_ACCESS_KEY', 'STORAGE_REGION', 'STORAGE_BUCKET', 'AUTH_SECRET']

function dbConfig(raw) {
  const u = new URL(raw), local = ['localhost', '127.0.0.1'].includes(u.hostname)
  u.searchParams.delete('sslmode'); u.searchParams.delete('channel_binding')
  return { connectionString: u.toString(), ssl: local ? false : { rejectUnauthorized: true }, connectionTimeoutMillis: 20000 }
}
const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex')
function encrypt(plain) {     // must match lib/admin/crypto.js
  const key = Buffer.from(hkdfSync('sha256', process.env.AUTH_SECRET, 'olexweb-admin', 'totp-secret-v1', 32))
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([c.update(String(plain), 'utf8'), c.final()])
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), data.toString('base64url')].join('.')
}

// ---------- prompts (password typing is hidden) ----------
function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    if (hidden) {
      rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); else rl.output.write(s.includes('\n') || s.includes('\r') ? '\n' : '') }
    }
    rl.question(question, (a) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(a.trim()) })
  })
}
const COMMON = ['password', '123456', 'qwerty', 'olexweb', 'olaitan', 'letmein', 'admin', 'welcome', 'iloveyou', 'abc123']
function weak(pw, email) {
  if (pw.length < 10) return 'Use at least 10 characters.'
  const low = pw.toLowerCase()
  if (COMMON.some((w) => low.includes(w))) return 'Avoid common words (password, admin, your name or the site name).'
  if (email && low.includes(email.split('@')[0].toLowerCase())) return 'Don\u2019t include your email name.'
  if (new Set(pw).size < 6) return 'Use more varied characters.'
  return null
}

async function main() {
  console.log('Olexweb admin setup\n')
  loadEnv()
  step('1. Settings')
  const missing = NEED.filter((k) => !process.env[k])
  if (missing.length) { no('Missing in .env.local: ' + missing.join(', ')); return }
  if (process.env.AUTH_SECRET.length < 32) { no('AUTH_SECRET is too short. Make a new one with the command from the setup steps.'); return }
  ok('All 8 settings are present')

  step('2. Database')
  const db = new pg.Client(dbConfig(process.env.DATABASE_URL))
  try { await db.connect() } catch (e) { no('Could not connect to Neon: ' + e.message); return }
  const host = new URL(process.env.DATABASE_URL).hostname
  ok('Connected to ' + host + (host.includes('neon.tech') ? ' (certificate verified)' : ''))
  await db.query(fs.readFileSync(path.join(ROOT, 'db', 'schema.sql'), 'utf8'))
  await db.query("insert into schema_migrations (version) values ('2026-10-06-phase1') on conflict do nothing")
  await db.query("insert into schema_migrations (version) values ('2026-10-07-phase2') on conflict do nothing")
  await db.query("insert into schema_migrations (version) values ('2026-10-07-phase3') on conflict do nothing")
  await db.query("insert into schema_migrations (version) values ('2026-10-07-phase4') on conflict do nothing")
  await db.query("insert into schema_migrations (version) values ('2026-10-07-phase5') on conflict do nothing")
  await db.query("insert into schema_migrations (version) values ('2026-10-08-cloudflare-backup') on conflict do nothing")
  await db.query("insert into schema_migrations (version) values ('2026-10-08-blog-engagement') on conflict do nothing")
  await db.query("insert into schema_migrations (version) values ('2026-10-08-assistant-chat') on conflict do nothing")
  await db.query("insert into schema_migrations (version) values ('2026-10-08-olex-ai-schedule-notify') on conflict do nothing")
  await db.query("insert into schema_migrations (version) values ('2026-10-09-speed-leads-gsc') on conflict do nothing")
  ok('Tables are ready')

  step('3. Content')
  const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'db', 'seed.json'), 'utf8'))
  const seeded = await db.query("select 1 from schema_migrations where version = 'seed-v1'")
  if (seeded.rowCount) ok('Content was already copied in earlier (not touched again)')
  else {
    await db.query('begin')
    try {
      for (const [i, p] of seed.projects.entries())
        await db.query('insert into projects (slug, name, kind, role, text, built, result, url, image, sort, status) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict (slug) do nothing',
          [p.slug, p.name, p.kind, p.role, p.text, p.built, p.result, p.url, p.image, i, 'live'])
      for (const [i, v] of seed.ventures.entries())
        await db.query('insert into ventures (slug, name, line, kind, text, url, sort, status) values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (slug) do nothing',
          [v.slug, v.name, v.line, v.kind, JSON.stringify(v.text), v.url, i, 'live'])
      for (const a of seed.posts)
        await db.query('insert into posts (slug, title, summary, body, published_on, minutes, status, seo, sources) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (slug) do nothing',
          [a.slug, a.title, a.summary, JSON.stringify(a.body), a.published_on, a.minutes, 'live', JSON.stringify(a.seo), JSON.stringify(a.sources)])
      await db.query("insert into schema_migrations (version) values ('seed-v1')")
      await db.query('commit')
      ok(`Copied in ${seed.projects.length} projects, ${seed.ventures.length} ventures and ${seed.posts.length} articles`)
    } catch (e) { await db.query('rollback'); no('Copying content failed, nothing was changed: ' + e.message); await db.end(); return }
  }

  step('4. Private image storage')
  try {
    const s3 = new AwsClient({ accessKeyId: process.env.STORAGE_ACCESS_KEY_ID, secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY, region: process.env.STORAGE_REGION, service: 's3' })
    const base = process.env.STORAGE_ENDPOINT.replace(/\/$/, '') + '/' + process.env.STORAGE_BUCKET
    const key = 'healthcheck/' + randomBytes(8).toString('hex') + '.txt', body = 'olexweb ' + new Date().toISOString()
    const put = await s3.fetch(`${base}/${key}`, { method: 'PUT', body, headers: { 'content-type': 'text/plain' } })
    if (!put.ok) throw new Error('upload refused (' + put.status + ')')
    const get = await s3.fetch(`${base}/${key}`)
    if (!get.ok || (await get.text()) !== body) throw new Error('read back failed (' + get.status + ')')
    const anon = await fetch(`${base}/${key}`)
    const del = await s3.fetch(`${base}/${key}`, { method: 'DELETE' })
    if (!del.ok && del.status !== 204) throw new Error('delete failed (' + del.status + ')')
    ok('Uploaded, read back and deleted a test file')
    if (anon.ok) no('The bucket is PUBLIC: anyone can read files directly. In Neon, set the uploads bucket to Private.')
    else ok('The bucket is private: files can\u2019t be read without your keys')
  } catch (e) { no('Image storage check failed: ' + e.message) }

  step('5. Owner account')
  const owner = await db.query("select email, totp_enabled from admin_users where role = 'owner'")
  if (owner.rowCount && owner.rows[0].totp_enabled) { ok('Owner account exists: ' + owner.rows[0].email + ' (two-step sign-in is on)'); await db.end(); return finish() }
  const auto = process.env.ADMIN_SETUP_EMAIL && process.env.ADMIN_SETUP_PASSWORD   // only used by automated tests
  const email = (auto ? process.env.ADMIN_SETUP_EMAIL : await ask('  Your email: ')).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { no('That doesn\u2019t look like an email address.'); await db.end(); return }
  const name = auto ? (process.env.ADMIN_SETUP_NAME || 'Olaitan Adebayo') : ((await ask('  Your name [Olaitan Adebayo]: ')) || 'Olaitan Adebayo')
  let pw
  for (;;) {
    pw = auto ? process.env.ADMIN_SETUP_PASSWORD : await ask('  Choose a password (at least 10 characters; typing is hidden): ', { hidden: true })
    const w = weak(pw, email); if (w) { no(w); if (auto) { await db.end(); return } continue }
    if (auto || pw === await ask('  Type it again: ', { hidden: true })) break
    no('The two passwords didn\u2019t match. Try again.')
  }
  const secret = new Secret({ size: 20 })
  const totp = new TOTP({ issuer: 'Olexweb', label: email, algorithm: 'SHA1', digits: 6, period: 30, secret })
  const uri = totp.toString()
  if (!auto) {
    console.log('\n  Scan this with your authenticator app (Google Authenticator, Microsoft Authenticator, 1Password...):\n')
    console.log(await QRCode.toString(uri, { type: 'terminal', small: true }))
    console.log('  Can\u2019t scan? Add it by hand with this key: ' + secret.base32.match(/.{1,4}/g).join(' ') + '\n')
    for (;;) {
      const code = (await ask('  Type the 6-digit code your app shows now: ')).replace(/\s/g, '')
      if (totp.validate({ token: code, window: 1 }) !== null) break
      no('That code didn\u2019t match. Wait for a new code and try again.')
    }
  } else if (process.env.ADMIN_SETUP_PRINT_SECRET === '1') console.log('  TEST_TOTP_SECRET=' + secret.base32)
  // 10 codes like 'k7mq-w3zp': 8 characters from an alphabet without look-alikes (no 0/o, 1/l/i), from the system's secure random source
  const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789'
  const recovery = Array.from({ length: 10 }, () => { const r = Array.from({ length: 8 }, () => ALPHA[randomInt(ALPHA.length)]).join(''); return r.slice(0, 4) + '-' + r.slice(4) })
  const hashPw = await argonHash(pw, { memoryCost: 19456, timeCost: 2, parallelism: 1 })
  await db.query(`insert into admin_users (email, name, role, password_hash, totp_secret_enc, totp_enabled, recovery_hashes, perms)
                  values ($1, $2, 'owner', $3, $4, true, $5, '{"publish": true, "reviews": true, "testimonials": true, "ventures": true}')
                  on conflict (email) do update set password_hash = excluded.password_hash, totp_secret_enc = excluded.totp_secret_enc, totp_enabled = true, recovery_hashes = excluded.recovery_hashes, role = 'owner'`,
    [email, name, hashPw, encrypt(secret.base32), recovery.map((r) => sha256(r.replace('-', '')))])
  await db.query("insert into audit_log (action, detail) values ('owner_created', $1)", [JSON.stringify({ email })])
  ok('Owner account created for ' + email + ', with two-step sign-in on')
  console.log('\n  Your recovery codes. Each works once if you lose your phone. Save them somewhere safe now; they won\u2019t be shown again:\n')
  console.log('  ' + recovery.join('   ') + '\n')
  await db.end(); finish()
}
function finish() {
  if (process.exitCode) console.log('\nSome checks failed. Fix the items marked \u2717 and run npm run admin:setup again.')
  else console.log('\nAll done. Start the site (npm run dev) and sign in at http://localhost:3000/admin')
}
main().catch((e) => { console.error('\nSetup stopped: ' + e.message); process.exitCode = 1 })
