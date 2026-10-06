// Small, audited building blocks from Node's crypto module only.
import 'server-only'
import { createHash, randomBytes, createCipheriv, createDecipheriv, hkdfSync, timingSafeEqual } from 'node:crypto'

export const token = (bytes = 32) => randomBytes(bytes).toString('base64url')         // unguessable
export const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex')
export const sameText = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y) }

function key() {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) throw new Error('AUTH_SECRET is missing or too short')
  return Buffer.from(hkdfSync('sha256', secret, 'olexweb-admin', 'totp-secret-v1', 32))
}
// AES-256-GCM: confidentiality and tamper detection
export function encrypt(plain) {
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([c.update(String(plain), 'utf8'), c.final()])
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), data.toString('base64url')].join('.')
}
export function decrypt(box) {
  const [v, iv, tag, data] = String(box).split('.')
  if (v !== 'v1') throw new Error('unknown format')
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url')); d.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8')
}
