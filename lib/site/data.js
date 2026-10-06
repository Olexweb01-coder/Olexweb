// The public site's content. Server only.
// - No database configured (a local preview without settings): the built-in copy in db/seed.json is used.
// - Database configured but unreachable: the error is raised on purpose, so Next.js keeps serving the last good page
//   instead of replacing live content with the built-in copy.
import 'server-only'
import seed from '@/db/seed.json'

const configured = () => !!(process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL)
async function db() { return import('@/lib/admin/db') }
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d ? String(d).slice(0, 10) : null)

export async function getProjects() {
  if (!configured()) return seed.projects.map((p, i) => ({ ...p, id: i + 1 }))
  const { q } = await db()
  return (await q(`select p.slug, p.name, p.kind, p.role, p.text, p.built, p.result, p.url, p.image, m.width, m.height
                   from projects p left join media m on p.image = '/media/' || m.key where p.status = 'live' order by p.sort, p.id`)).rows
}
export async function getTestimonials() {
  if (!configured()) return []
  const { q } = await db()
  return (await q("select name, role, text, stars from testimonials where status = 'published' and consent order by coalesce(decided_at, created_at) desc limit 12")).rows
}
export async function getPosts() {
  if (!configured()) return seed.posts.map((p) => ({ ...p })).sort((a, b) => (a.published_on < b.published_on ? 1 : -1))
  const { q } = await db()
  return (await q("select slug, title, summary, published_on, minutes, updated_at from posts where status = 'live' order by published_on desc nulls last, id desc")).rows
    .map((p) => ({ ...p, published_on: iso(p.published_on), updated_at: p.updated_at ? p.updated_at.toISOString() : null }))
}
export async function getPost(slug) {  // body text may contain [words](address) links; the article page renders them safely
  if (!/^[a-z0-9-]{1,90}$/.test(slug)) return null
  if (!configured()) return seed.posts.find((p) => p.slug === slug) || null
  const { one } = await db()
  const p = await one("select slug, title, summary, body, seo, sources, published_on, minutes, updated_at from posts where slug = $1 and status = 'live'", [slug])
  return p ? { ...p, published_on: iso(p.published_on), updated_at: p.updated_at ? p.updated_at.toISOString() : null } : null
}
export async function getVentures() {
  if (!configured()) return seed.ventures.map((v) => ({ ...v }))
  const { q } = await db()
  return (await q("select slug, name, line, kind, summary, text, url, image from ventures where status = 'live' order by sort, id")).rows
}
export async function getVenture(slug) {
  if (!/^[a-z0-9-]{1,90}$/.test(slug)) return null
  return (await getVentures()).find((v) => v.slug === slug) || null
}

const SOCIALS = { linkedin: 'https://www.linkedin.com/in/olexweb', x: 'https://x.com/olexweb', facebook: 'https://www.facebook.com/share/17xWswJgGE/' }
export async function getSocials() {
  if (!configured()) return SOCIALS
  const { one } = await db(); const s = await one('select socials from assistant_settings where id = 1').catch(() => null)
  return { ...SOCIALS, ...((s && s.socials) || {}) }
}
