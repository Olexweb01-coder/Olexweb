// The private image bucket (Neon Object Storage, S3-compatible). Server only: the keys never reach a browser.
import 'server-only'
import { AwsClient } from 'aws4fetch'

export const KEY_RE = /^img\/[a-f0-9]{24}\.webp$/
const client = () => (globalThis.__olexS3 ||= new AwsClient({ accessKeyId: process.env.STORAGE_ACCESS_KEY_ID, secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY, region: process.env.STORAGE_REGION, service: 's3' }))
const url = (key) => process.env.STORAGE_ENDPOINT.replace(/\/$/, '') + '/' + process.env.STORAGE_BUCKET + '/' + key

export async function putImage(key, body) {
  if (!KEY_RE.test(key)) throw new Error('bad key')
  const r = await client().fetch(url(key), { method: 'PUT', body, headers: { 'content-type': 'image/webp' } })
  if (!r.ok) throw new Error('storage refused the upload (' + r.status + ')')
}
export async function getImage(key) {
  if (!KEY_RE.test(key)) return null
  const r = await client().fetch(url(key))
  return r.ok ? r : null
}
export async function deleteImage(key) {
  if (!KEY_RE.test(key)) return
  await client().fetch(url(key), { method: 'DELETE' })
}
