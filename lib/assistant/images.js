// Free image generation, stacked: Cloudflare Workers AI (FLUX.1 schnell, then SDXL Lightning) and Pollinations.
// Each finished image is converted to WebP and kept in your private image storage, like uploads, so it can be
// downloaded or used on the site. If one service is busy or out of its free allowance, the next one is used.
import 'server-only'
import sharp from 'sharp'
import { randomBytes } from 'node:crypto'
import { q, one } from '@/lib/admin/db'
import { putImage } from '@/lib/admin/storage'

export const SHAPES = { square: [1024, 1024], wide: [1344, 768], tall: [768, 1344] }
const BLOCKED = /\b(nude|naked|nsfw|sexy|sexual|sex|porn|explicit|erotic|gore|beheaded|underage)\b/i
const cfBase = () => (process.env.ASSISTANT_CF_BASE || 'https://api.cloudflare.com').replace(/\/$/, '')
const cfReady = () => !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_AI_TOKEN)
export const imagesReady = () => cfReady() || process.env.OLEX_POLLINATIONS !== 'off'

async function timed(url, init, ms = 90000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms)
  try { return await fetch(url, { ...init, cache: 'no-store', signal: ctl.signal }) } catch { return null } finally { clearTimeout(t) }
}
async function flux(prompt) {
  if (!cfReady()) return null
  const r = await timed(`${cfBase()}/client/v4/accounts/${encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID)}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.CLOUDFLARE_AI_TOKEN }, body: JSON.stringify({ prompt, steps: 6 }) })
  if (!r || !r.ok) return null
  const j = await r.json().catch(() => null), b64 = j && j.result && j.result.image
  return b64 ? { buf: Buffer.from(b64, 'base64'), by: 'FLUX.1 schnell (Cloudflare)' } : null
}
async function sdxl(prompt, [w, h]) {
  if (!cfReady()) return null
  const r = await timed(`${cfBase()}/client/v4/accounts/${encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID)}/ai/run/@cf/bytedance/stable-diffusion-xl-lightning`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.CLOUDFLARE_AI_TOKEN }, body: JSON.stringify({ prompt, width: w, height: h }) })
  if (!r || !r.ok || !/image/.test(r.headers.get('content-type') || '')) return null
  return { buf: Buffer.from(await r.arrayBuffer()), by: 'SDXL Lightning (Cloudflare)' }
}
async function pollinations(prompt, [w, h]) {
  if (process.env.OLEX_POLLINATIONS === 'off') return null
  const base = (process.env.OLEX_POLLINATIONS_BASE || 'https://image.pollinations.ai').replace(/\/$/, '')
  const qs = new URLSearchParams({ width: String(w), height: String(h), nologo: 'true', model: 'flux', seed: String(Math.floor(Math.random() * 1e9)) })
  if (process.env.POLLINATIONS_TOKEN) qs.set('token', process.env.POLLINATIONS_TOKEN)
  const r = await timed(`${base}/prompt/${encodeURIComponent(prompt)}?${qs}`, { headers: { Referer: 'https://olexweb.com' } }, 120000)
  if (!r || !r.ok || !/image/.test(r.headers.get('content-type') || '')) return null
  return { buf: Buffer.from(await r.arrayBuffer()), by: 'Pollinations' }
}

export async function makeImage(prompt, shape = 'square', userId = null) {
  const p = String(prompt || '').replace(/\s+/g, ' ').trim().slice(0, 900)
  if (p.length < 3) throw new Error('Describe the image in a few words.')
  if (BLOCKED.test(p)) throw new Error('That image can’t be made here.')
  const size = SHAPES[shape] || SHAPES.square
  let out = null
  for (const tryIt of [() => flux(p), () => sdxl(p, size), () => pollinations(p, size)]) { out = await tryIt().catch(() => null); if (out) break }
  if (!out) throw new Error('Every free image service is busy or used up for today. Try again later.')
  let webp, info
  try { ({ data: webp, info } = await sharp(out.buf, { limitInputPixels: 60_000_000 }).resize(size[0], size[1], { fit: 'cover', position: 'attention' }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true })) }
  catch { throw new Error('The image service sent back something that isn’t an image. Try again.') }
  const key = 'img/' + randomBytes(12).toString('hex') + '.webp'
  await putImage(key, webp)
  await q('insert into media (key, mime, bytes, width, height, created_by) values ($1, $2, $3, $4, $5, $6)', [key, 'image/webp', webp.length, info.width, info.height, userId])
  return { url: '/media/' + key, by: out.by, width: info.width, height: info.height }
}

// The hidden line in an answer: <<<IMAGE {"prompt": "...", "shape": "square" | "wide" | "tall"}>>>
export function takeImageLines(full) {
  const found = []
  const text = String(full || '').replace(/<<<IMAGE\s*(\{[\s\S]*?\})\s*>>>/g, (_, json) => { try { const o = JSON.parse(json); if (o && o.prompt) found.push(o) } catch {} return '' })
  return { text, found: found.slice(0, 2) }
}
export const IMAGE_RULES = `IMAGES: you can create images (free, a few seconds each). When he asks for an image, picture, illustration, blog image, banner, poster idea, logo concept or design, reply in one or two short sentences, then add on its own line at the very end:
<<<IMAGE {"prompt": "a detailed English description: subject, setting, style, lighting, colours, composition; for text in the image keep it to one or two short words", "shape": "square" | "wide" | "tall"}>>>
Use "wide" for blog headers and banners, "tall" for phone stories and posters. You can add up to two IMAGE lines for two options. Never make images of real, named people, of copyrighted characters or brand logos, or anything sexual, violent or hateful; say so instead. Image models draw text badly, so suggest adding exact wording in a design tool.`
