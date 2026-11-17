// Install 28: a portfolio project from a link. Paste the address of a site you built: Olex AI reads the site (the home page
// and a few inside pages) and fills in the project (name, type, your role, description, what was built, the result) from
// what's really on it, never invented. The factory (GitHub, a real browser) then takes the screenshots: the whole page, the
// first screen, the best sections and the phone view. The whole page goes on the project; you can pick another. It all
// lands as a draft for you to check before it goes on the portfolio.
import 'server-only'
import sharp from 'sharp'
import { randomBytes } from 'node:crypto'
import { q, one } from '@/lib/admin/db'
import { putImage } from '@/lib/admin/storage'
import { safeFetch, pageText } from '@/lib/assistant/net'
import { askJSON } from '@/lib/assistant/llm'
import { run as contentRun, Refused } from '@/lib/admin/content'
import { factoryReady } from './factory'
import { SITE_ORIGIN } from './youtube'

const KINDS = ['Client website', 'Own product (SaaS)', 'Own product (AI)']
const clean = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n)
const decode = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;|&rsquo;/g, '’').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
export const MAX_SHOTS = 8

// ---------- reading the site ----------
function headingsOf(html) { return [...String(html).matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => decode(m[2])).filter((t) => t.length >= 3 && t.length <= 90) }
function insideLinks(html, base) {
  const out = [], seen = new Set(), host = new URL(base).host
  const score = (p) => (/about|service|work|portfolio|product|feature|menu|shop|pricing|contact/i.test(p) ? 0 : 1)
  for (const m of String(html).matchAll(/href=["']([^"'#]+)["']/gi)) {
    let u; try { u = new URL(m[1], base) } catch { continue }
    if (u.host !== host || !/^https?:$/.test(u.protocol) || /\.(png|jpe?g|webp|gif|svg|pdf|zip|css|js|ico|xml)$/i.test(u.pathname)) continue
    u.hash = ''; u.search = ''; const k = u.toString(); if (seen.has(k) || u.pathname === new URL(base).pathname) continue; seen.add(k); out.push(k)
  }
  return out.sort((a, b) => score(a) - score(b)).slice(0, 4)
}
export async function readSite(url) {
  const allowHttp = true
  const home = await safeFetch(url, { timeoutMs: 15000, allowHttp })
  if (home.status >= 400) throw new Refused(`The site answered ${home.status}. Check the address.`)
  if (!/html/i.test(home.type)) throw new Refused('That address isn’t a web page.')
  const pages = [{ url: home.url, ...pageText(home.text), heads: headingsOf(home.text) }]
  await Promise.all(insideLinks(home.text, home.url).map(async (l) => {
    try { const r = await safeFetch(l, { timeoutMs: 9000, allowHttp }); if (r.status < 400 && /html/i.test(r.type)) pages.push({ url: r.url, ...pageText(r.text), heads: headingsOf(r.text) }) } catch {}
  }))
  return { url: home.url, pages, homeHeads: pages[0].heads }
}

const SHAPE = { type: 'object', properties: {
  name: { type: 'string' }, kind: { type: 'string', enum: KINDS }, role: { type: 'string' }, text: { type: 'string' },
  built: { type: 'array', items: { type: 'string' } }, result: { type: 'string' }, best: { type: 'array', items: { type: 'string' } } },
  required: ['name', 'kind', 'role', 'text', 'built', 'result', 'best'] }
export async function describeSite(site) {
  const text = site.pages.map((p, i) => `--- PAGE ${i + 1}: ${p.url}\nTITLE: ${p.title}\n${p.text.slice(0, i ? 2500 : 5000)}`).join('\n\n').slice(0, 14000)
  const out = await askJSON({ kind: 'quick', temperature: 0.3, maxTokens: 1500,
    system: 'You write portfolio entries for Olexweb, a web design and development studio run by Olaitan Adebayo. Plain, confident British English. You only state what the site itself shows. Never invent numbers, clients, awards or results.',
    prompt: `Olexweb built this website. Write its portfolio entry from what is on the site.

${text}

HEADINGS ON THE HOME PAGE (exact): ${site.homeHeads.slice(0, 30).map((h) => '“' + h + '”').join(', ') || '(none)'}

Return:
- "name": the business or product name (as the site writes it).
- "kind": "Client website" for a business's site; "Own product (SaaS)" or "Own product (AI)" only if it is clearly Olexweb's own product.
- "role": what Olexweb did, short (e.g. "Design, build and launch").
- "text": 2–3 sentences: who the business is, who it serves, and what the site lets visitors do. No hype words (no "stunning", "cutting-edge", "seamless").
- "built": 3–6 short items (max 5 words each) of what the site has: features a visitor can see (e.g. "Online booking", "Menu with prices", "WhatsApp chat button", "Fast on phones").
- "result": one sentence on what the site makes possible for the business, based only on what the site shows (e.g. "Customers can now book a table online in under a minute."). No made-up numbers.
- "best": up to 4 home-page headings, copied exactly from the list above, of the sections that show the work best (the most visual or impressive parts, not the footer or contact form).` , schema: SHAPE })
  const heads = new Set(site.homeHeads)
  return {
    name: clean(out.name, 80) || new URL(site.url).host.replace(/^www\./, ''), kind: KINDS.includes(out.kind) ? out.kind : 'Client website',
    role: clean(out.role, 120), text: clean(out.text, 1000), built: (out.built || []).map((b) => clean(b, 60)).filter(Boolean).slice(0, 6),
    result: clean(out.result, 600), url: site.url, best: (out.best || []).map((b) => clean(b, 90)).filter((b) => heads.has(b)).slice(0, 4),
  }
}

// ---------- the whole thing, from your admin ----------
export async function fromLink(u, ip, raw) {
  let url = clean(raw, 300); if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  try { new URL(url) } catch { throw new Refused('That doesn’t look like a web address.') }
  let site; try { site = await readSite(url) } catch (e) { if (e instanceof Refused) throw e; throw new Refused('The site couldn’t be opened (' + clean(e.message, 80) + '). Check the address.') }
  const d = await describeSite(site)
  const { id } = await contentRun(u, ip, { action: 'save', type: 'project', data: { name: d.name, kind: d.kind, role: d.role, text: d.text, built: d.built, result: d.result, url: d.url, image: '' } })
  const job = await one('insert into portfolio_shots (project_id, url, headings, created_by) values ($1, $2, $3, $4) returning id', [id, d.url, JSON.stringify(d.best), u.id])
  const started = await startShots(job.id)
  return { id, data: { ...d, image: '' }, shots: started }
}
async function startShots(jobId) {
  if (!factoryReady()) { await q("update portfolio_shots set status = 'failed', error = $2 where id = $1", [jobId, 'The factory isn’t set up, so add a screenshot yourself.']); return { status: 'failed', error: 'The factory isn’t set up, so add a screenshot yourself.' } }
  const GH = String(process.env.FACTORY_GH_API || 'https://api.github.com').replace(/\/$/, ''), REPO = process.env.FACTORY_REPO || 'Olexweb01-coder/olexweb-factory'
  const r = await fetch(`${GH}/repos/${REPO}/actions/workflows/shots.yml/dispatches`, { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { Authorization: 'Bearer ' + process.env.FACTORY_GH_TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify({ ref: 'main', inputs: { id: String(jobId), api: SITE_ORIGIN() } }) }).catch(() => null)
  if (!r || r.status !== 204) {
    const why = r ? `GitHub said ${r.status} (push the factory’s new shots workflow).` : 'GitHub didn’t answer.'
    await q("update portfolio_shots set status = 'failed', error = $2 where id = $1", [jobId, 'Screenshots couldn’t start: ' + why]); return { status: 'failed', error: 'Screenshots couldn’t start: ' + why }
  }
  return { status: 'waiting' }
}
export async function retryShots(u, projectId) {
  const j = await one('select id from portfolio_shots where project_id = $1 order by id desc limit 1', [Number(projectId)]); if (!j) throw new Refused('Add the project from its link first.')
  await q("update portfolio_shots set status = 'waiting', error = null, shots = '[]', updated_at = now() where id = $1", [j.id])
  return startShots(j.id)
}
export async function shotsFor(projectId) {
  const j = await one('select id, status, shots, error, updated_at, created_at from portfolio_shots where project_id = $1 order by id desc limit 1', [Number(projectId)])
  if (!j) return { status: 'none', shots: [] }
  // nothing heard for 15 minutes: say so instead of waiting for ever
  if (['waiting', 'taking'].includes(j.status) && Date.now() - new Date(j.updated_at || j.created_at).getTime() > 15 * 60e3) {
    await q("update portfolio_shots set status = 'failed', error = 'The factory didn’t finish the screenshots. Try again.' where id = $1", [j.id]); return { status: 'failed', error: 'The factory didn’t finish the screenshots. Try again.', shots: j.shots }
  }
  return { status: j.status, shots: j.shots, error: j.error }
}

// ---------- the factory's side (signed calls, see app/api/factory) ----------
export async function shotJob(id) {
  const j = await one("update portfolio_shots set status = 'taking', updated_at = now() where id = $1 and status in ('waiting', 'taking') returning url, headings", [id])
  return j ? { url: j.url, best: j.headings || [], max: MAX_SHOTS } : null
}
const LABELS = { full: 'The whole page', hero: 'The first screen', phone: 'On a phone' }
export async function saveShot(id, label, buf) {
  const j = await one("select id, project_id, shots from portfolio_shots where id = $1 and status = 'taking'", [id]); if (!j) return false
  if ((j.shots || []).length >= MAX_SHOTS) return false
  const full = label === 'full'
  const { data, info } = await sharp(buf, { limitInputPixels: 80_000_000, failOn: 'error' }).resize({ width: 1600, height: full ? 9000 : 3000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toBuffer({ resolveWithObject: true })
  const key = 'img/' + randomBytes(12).toString('hex') + '.webp'
  await putImage(key, data)
  await q('insert into media (key, mime, bytes, width, height) values ($1, $2, $3, $4, $5)', [key, 'image/webp', data.length, info.width, info.height])
  const shot = { url: '/media/' + key, label: LABELS[label] || clean(label.replace(/^part:/, 'Section: '), 100), width: info.width, height: info.height }
  await q("update portfolio_shots set shots = shots || $2::jsonb, updated_at = now() where id = $1", [id, JSON.stringify([shot])])
  // the whole page goes on the project straight away (if it has no picture yet); the others are there to choose from
  if (full) await q("update projects set image = $2, updated_at = now() where id = $1 and coalesce(image, '') = ''", [j.project_id, shot.url])
  return true
}
export async function shotsDone(id, { error } = {}) {
  const j = await one("select id, project_id, shots from portfolio_shots where id = $1 and status = 'taking'", [id]); if (!j) return false
  const any = (j.shots || []).length > 0
  await q('update portfolio_shots set status = $2, error = $3, updated_at = now() where id = $1', [id, any ? 'done' : 'failed', any ? null : clean(error || 'No screenshot could be taken.', 300)])
  if (any && !(j.shots || []).some((s) => s.label === LABELS.full)) await q("update projects set image = $2, updated_at = now() where id = $1 and coalesce(image, '') = ''", [j.project_id, j.shots[0].url])
  return true
}
