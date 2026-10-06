// Projects, articles and ventures: every field is checked and every action is permission-checked here, on the server.
import 'server-only'
import { q, one } from './db'
import { can, ownerOnly, audit } from './auth'
import { refreshSite } from './refresh'

export class Refused extends Error { constructor(msg, status = 400) { super(msg); this.status = status } }

// ---------- field checks ----------
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max)
function need(v, max, label) { const s = clean(v, max + 1); if (!s) throw new Refused(label + ' is missing.'); if (s.length > max) throw new Refused(label + ' is too long (' + max + ' characters at most).'); return s }
function opt(v, max, label) { const s = clean(v, max + 1); if (s.length > max) throw new Refused(label + ' is too long (' + max + ' characters at most).'); return s }
function link(v) {
  const s = clean(v, 301); if (!s) return ''
  let u; try { u = new URL(s) } catch { throw new Refused('The address needs to start with https://') }
  if (!['https:', 'http:'].includes(u.protocol) || s.length > 300) throw new Refused('The address needs to start with https://')
  return u.toString()
}
function image(v) {
  const s = clean(v, 200)
  if (!s || /^\/media\/img\/[a-f0-9]{24}\.webp$/.test(s) || /^\/v2\/sites\/[a-z0-9-]+\.webp$/.test(s)) return s
  throw new Refused('Upload the image again.')
}
const KINDS = ['Client website', 'Own product (SaaS)', 'Own product (AI)']
export const slugify = (s) => clean(s, 200).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '')

function project(d) {
  const kind = clean(d.kind, 40); if (!KINDS.includes(kind)) throw new Refused('Choose a project type.')
  const built = (Array.isArray(d.built) ? d.built : []).map((b) => clean(b, 61)).filter(Boolean)
  if (built.length > 12 || built.some((b) => b.length > 60)) throw new Refused('Keep "What was built" to 12 short items.')
  return { name: need(d.name, 80, 'Name'), kind, role: opt(d.role, 120, 'Your role'), text: opt(d.text, 1000, 'Description'), built, result: opt(d.result, 600, 'The result'), url: link(d.url), image: image(d.image) }
}
function post(d) {
  const body = (Array.isArray(d.body) ? d.body : []).map((b) => ({ type: b && b.type === 'h' ? 'h' : 'p', text: clean(b && b.text, 6001) })).filter((b) => b.text)
  if (!body.length) throw new Refused('Write at least one paragraph.')
  if (body.length > 300 || body.some((b) => b.text.length > 6000)) throw new Refused('The article is too long for one page.')
  const seo = d.seo || {}
  const words = body.reduce((n, b) => n + b.text.split(/\s+/).filter(Boolean).length, 0)
  return { title: need(d.title, 140, 'Title'), summary: opt(d.summary, 320, 'Summary'), body, minutes: Math.max(1, Math.round(words / 220)),
    seo: { keyword: opt(seo.keyword, 80, 'Focus keyword'), title: opt(seo.title, 70, 'Search title'), description: opt(seo.description, 170, 'Search description') }, slug: slugify(d.slug || d.title) }
}
function venture(d) {
  const text = (Array.isArray(d.text) ? d.text : []).map((p) => clean(p, 1501)).filter(Boolean)
  if (text.length > 10 || text.some((p) => p.length > 1500)) throw new Refused('Keep the story to 10 paragraphs.')
  return { name: need(d.name, 80, 'Name'), line: opt(d.line, 140, 'One line'), kind: opt(d.kind, 80, 'Type'), summary: opt(d.summary, 300, 'Short description'), text, url: link(d.url), image: image(d.image) }
}

// ---------- permissions ----------
const TABLE = { project: 'projects', post: 'posts', venture: 'ventures' }
const LIVE_EDIT = (u, type) => type === 'venture' ? can(u, 'ventures') : can(u, 'publish')
function mayTouch(u, type, row) {
  if (type === 'venture' && !can(u, 'ventures')) throw new Refused('Only Olaitan can change ventures.', 403)
  if (row && ['live', 'hidden'].includes(row.status) && !LIVE_EDIT(u, type)) throw new Refused('Only Olaitan can change what is on the site. Ask for publishing access.', 403)
  if (row && row.status === 'bin') throw new Refused('Restore it from the bin first.', 403)
}

async function uniqueSlug(base, id) {
  const root = base || 'article'
  for (let i = 0; i < 50; i++) {
    const s = i ? `${root}-${i + 1}` : root
    const hit = await one('select id from posts where slug = $1 and ($2::int is null or id <> $2)', [s, id ?? null])
    if (!hit) return s
  }
  throw new Refused('Choose a different address.')
}
const projectSlug = async (name, id) => { const base = slugify(name) || 'project'; for (let i = 0; i < 50; i++) { const s = i ? `${base}-${i + 1}` : base; if (!(await one(`select id from projects where slug = $1 and ($2::int is null or id <> $2)`, [s, id ?? null]))) return s } throw new Refused('Choose a different name.') }
const ventureSlug = async (name, id) => { const base = slugify(name) || 'venture'; for (let i = 0; i < 50; i++) { const s = i ? `${base}-${i + 1}` : base; if (!(await one(`select id from ventures where slug = $1 and ($2::int is null or id <> $2)`, [s, id ?? null]))) return s } throw new Refused('Choose a different name.') }

// ---------- actions ----------
// Every action that succeeds refreshes the public pages that show that kind of content.
export async function run(u, ip, body) { const r = await runAction(u, ip, body); refreshSite(body.type); return r }

async function runAction(u, ip, { action, type, id, data, order }) {
  const table = TABLE[type]; if (!table) throw new Refused('Unknown item.')
  id = id == null ? null : Number(id)
  if (id !== null && !Number.isInteger(id)) throw new Refused('Unknown item.')
  const row = id !== null ? await one(`select id, status, slug from ${table} where id = $1`, [id]) : null
  if (id !== null && !row) throw new Refused('That item no longer exists.', 404)
  const log = (what, extra = {}) => audit(u.id, `${type}_${what}`, { id: id ?? extra.id, ...extra }, ip)

  if (action === 'save') {
    mayTouch(u, type, row)
    const v = type === 'project' ? project(data || {}) : type === 'post' ? post(data || {}) : venture(data || {})
    if (type === 'project') {
      if (row) await q('update projects set name=$2, kind=$3, role=$4, text=$5, built=$6, result=$7, url=$8, image=$9, updated_at=now(), updated_by=$10 where id=$1', [id, v.name, v.kind, v.role, v.text, v.built, v.result, v.url, v.image, u.id])
      else id = (await one(`insert into projects (slug, name, kind, role, text, built, result, url, image, sort, status, updated_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,(select coalesce(max(sort),0)+1 from projects),'draft',$10) returning id`, [await projectSlug(v.name), v.name, v.kind, v.role, v.text, v.built, v.result, v.url, v.image, u.id])).id
    } else if (type === 'post') {
      const slug = row && row.status === 'live' ? row.slug : await uniqueSlug(v.slug, id)        // a live article keeps its address
      if (row) await q('update posts set title=$2, summary=$3, body=$4, minutes=$5, seo=$6, slug=$7, updated_at=now(), updated_by=$8 where id=$1', [id, v.title, v.summary, JSON.stringify(v.body), v.minutes, JSON.stringify(v.seo), slug, u.id])
      else id = (await one(`insert into posts (slug, title, summary, body, minutes, seo, status, author_id, updated_by) values ($1,$2,$3,$4,$5,$6,'draft',$7,$7) returning id`, [slug, v.title, v.summary, JSON.stringify(v.body), v.minutes, JSON.stringify(v.seo), u.id])).id
    } else {
      if (row) await q('update ventures set name=$2, line=$3, kind=$4, text=$5, url=$6, image=$7, summary=$8, updated_at=now() where id=$1', [id, v.name, v.line, v.kind, JSON.stringify(v.text), v.url, v.image, v.summary])
      else id = (await one(`insert into ventures (slug, name, line, kind, text, url, image, summary, sort, status) values ($1,$2,$3,$4,$5,$6,$7,$8,(select coalesce(max(sort),0)+1 from ventures),'draft') returning id`, [await ventureSlug(v.name), v.name, v.line, v.kind, JSON.stringify(v.text), v.url, v.image, v.summary])).id
    }
    await log(row ? 'edited' : 'created', { id }); return { id }
  }
  if (!row && action !== 'reorder') throw new Refused('Save it first.')
  if (action === 'publish') {
    mayTouch(u, type, null); if (!LIVE_EDIT(u, type)) throw new Refused('Only Olaitan can publish. Send it for approval instead.', 403)
    if (row.status === 'bin') throw new Refused('Restore it from the bin first.', 403)
    if (type === 'post') await q("update posts set status='live', published_on=coalesce(published_on, (now() at time zone 'Africa/Lagos')::date), updated_at=now(), updated_by=$2 where id=$1", [id, u.id])
    else await q(`update ${table} set status='live', updated_at=now() where id=$1`, [id])
    await log('published'); return { id }
  }
  if (action === 'submit') {
    mayTouch(u, type, row); await q(`update ${table} set status='waiting', updated_at=now() where id=$1`, [id]); await log('sent_for_approval'); return { id }
  }
  if (action === 'hide') {
    if (!LIVE_EDIT(u, type)) throw new Refused('Only Olaitan can change what is on the site.', 403)
    await q(`update ${table} set status=$2, updated_at=now() where id=$1 and status <> 'bin'`, [id, type === 'post' ? 'draft' : 'hidden']); await log('hidden'); return { id }
  }
  if (action === 'reorder') {
    if (type === 'post') throw new Refused('Articles are ordered by date.')
    if (!LIVE_EDIT(u, type)) throw new Refused('Only Olaitan can change the order on the site.', 403)
    const ids = (Array.isArray(order) ? order : []).map(Number).filter(Number.isInteger).slice(0, 500)
    for (const [i, x] of ids.entries()) await q(`update ${table} set sort=$2 where id=$1`, [x, i])
    await audit(u.id, `${type}_reordered`, { count: ids.length }, ip); return { ok: true }
  }
  if (action === 'bin') {
    if (!ownerOnly(u)) throw new Refused('Only Olaitan can delete.', 403)
    await q(`update ${table} set status='bin', binned_at=now() where id=$1`, [id]); await log('moved_to_bin'); return { id }
  }
  if (action === 'restore') {
    if (!ownerOnly(u)) throw new Refused('Only Olaitan can restore.', 403)
    await q(`update ${table} set status=$2, binned_at=null where id=$1 and status='bin'`, [id, type === 'post' ? 'draft' : 'hidden']); await log('restored'); return { id }
  }
  if (action === 'purge') {
    if (!ownerOnly(u)) throw new Refused('Only Olaitan can delete for good.', 403)
    if (row.status !== 'bin') throw new Refused('Move it to the bin first.')
    await q(`delete from ${table} where id=$1`, [id]); await log('deleted_for_good'); return { ok: true }
  }
  throw new Refused('Unknown action.')
}

// Items in the bin for more than 30 days are deleted for good.
export async function purgeOldBin() {
  for (const t of Object.values(TABLE)) await q(`delete from ${t} where status='bin' and binned_at < now() - interval '30 days'`)
}
