// Clean-up of repeats already on the site (the checks in lib/site/samey.js stop new ones). Lists pairs of live blog
// articles, and pairs of live Directory posts, that say the same thing; "merge" keeps the older one and takes the newer
// one down, leaving its address as a permanent redirect to the kept one, so Google drops the copy and keeps the links.
import 'server-only'
import { revalidatePath } from 'next/cache'
import { q, one } from '@/lib/admin/db'
import { Refused } from '@/lib/admin/content'
import { refreshSite } from '@/lib/admin/refresh'
import { repeatPairs } from './samey'

const KP = { tool: 'tools', update: 'updates', guide: 'guides', alert: 'alerts', story: 'stories' }
export async function listRepeats() {
  const posts = (await q("select id, slug, title, published_on from posts where status = 'live' order by published_on asc nulls last, id asc")).rows
  const blog = repeatPairs(posts).map((p) => ({ type: 'post', keep: { id: p.keep.id, title: p.keep.title, url: '/insights/' + p.keep.slug }, repeat: { id: p.repeat.id, title: p.repeat.title, url: '/insights/' + p.repeat.slug } }))
  const ents = (await q("select id, slug, kind, name as title from dir_entries where status = 'live' and kind <> 'tool' order by published_at asc nulls last, id asc")).rows
  const dir = repeatPairs(ents).map((p) => ({ type: 'entry', keep: { id: p.keep.id, title: p.keep.title, url: `/${KP[p.keep.kind]}/${p.keep.slug}` }, repeat: { id: p.repeat.id, title: p.repeat.title, url: `/${KP[p.repeat.kind]}/${p.repeat.slug}` } }))
  return { blog, dir }
}
export async function mergeRepeat(type, keepId, repeatId) {
  keepId = Number(keepId); repeatId = Number(repeatId)
  if (!Number.isInteger(keepId) || !Number.isInteger(repeatId) || keepId === repeatId) throw new Refused('Choose the two posts.')
  if (type === 'post') {
    const k = await one("select slug from posts where id = $1 and status = 'live'", [keepId]), r = await one("select slug from posts where id = $1 and status = 'live'", [repeatId])
    if (!k || !r) throw new Refused('One of those articles is no longer live.')
    await q("update posts set status = 'draft', merged_into = $2 where id = $1", [repeatId, k.slug])
    refreshSite('post'); try { revalidatePath('/insights/' + r.slug) } catch {}
    return { ok: true, from: '/insights/' + r.slug, to: '/insights/' + k.slug }
  }
  if (type === 'entry') {
    const k = await one("select slug, kind from dir_entries where id = $1 and status = 'live'", [keepId]), r = await one("select slug, kind from dir_entries where id = $1 and status = 'live'", [repeatId])
    if (!k || !r) throw new Refused('One of those posts is no longer live.')
    await q("update dir_entries set status = 'draft', merged_into = $2, updated_at = now() where id = $1", [repeatId, `/${KP[k.kind]}/${k.slug}`])
    for (const p of [`/${KP[r.kind]}/${r.slug}`, '/' + KP[r.kind], '/tools', '/sitemap.xml']) { try { revalidatePath(p) } catch {} }
    return { ok: true, from: `/${KP[r.kind]}/${r.slug}`, to: `/${KP[k.kind]}/${k.slug}` }
  }
  throw new Refused('Unknown type.')
}
// where a taken-down repeat now points (used by the public pages before they answer "not found")
export async function mergedPost(slug) { if (!/^[a-z0-9-]{1,90}$/.test(String(slug))) return null; const r = await one("select merged_into from posts where slug = $1 and status <> 'live' and merged_into is not null", [slug]).catch(() => null); return r ? '/insights/' + r.merged_into : null }
export async function mergedEntry(slug) { if (!/^[a-z0-9-]{1,90}$/.test(String(slug))) return null; const r = await one("select merged_into from dir_entries where slug = $1 and status <> 'live' and merged_into is not null", [slug]).catch(() => null); return r ? r.merged_into : null }
