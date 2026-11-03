// Automation → Library: every idea and its Short in one list, at whatever stage it's in, with a tick per channel that
// decides where the Short goes. The ticks live on the idea (yt_ideas.channels), so they're set before a script exists and
// the queues read them: YouTube's (publish.js autoQueue / uploadNext) and Facebook's (meta.js WAITING / fbWants).
// A tick can change only before that channel has posted (and not while YouTube is uploading). At least one stays ticked.
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { queueList } from './publish'
import { fbQueue, metaReady } from './meta'
import { dropVideo } from './factory'

export class LibraryError extends Error {}
const MAKING = ['draft', 'needs_review', 'approved', 'rendering']
const on = (ch, k) => !(ch && ch[k] === false)

function stageOf(r) {
  if (!r.sid) return ['skipped', 'passed'].includes(r.istatus) ? 'aside' : 'idea'
  if (r.status === 'uploaded' || (r.fb && r.fb.status === 'posted')) return 'posted'
  if (r.status === 'rendered') return 'ready'
  return 'making'                                                  // writing, waiting for approval, in the factory, or stopped
}
function stageNote(r) {
  if (!r.sid) return r.istatus === 'passed' ? 'Turned down by Olex AI' : r.istatus === 'skipped' ? 'Skipped' : r.istatus === 'picked' ? (r.first ? 'Next in line for a script' : 'Picked, waiting for a script') : `Score ${r.score}`
  return { draft: 'Script written', needs_review: 'Script needs your review', approved: 'Script approved, waiting for the factory', rendering: 'Being made in the factory', failed: 'Stopped: see YouTube → Scripts', rendered: 'Finished video', uploaded: 'Finished video' }[r.status] || ''
}
const when = (day, time, today) => `${day === today ? 'Today' : new Date(day + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })} ${time}`
const date = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' })

export async function libraryData() {
  const rows = (await q(`select i.id, i.name, i.url, i.source, i.signal, i.status as istatus, i.score, i.channels, i.first, i.what, i.why, i.created_at,
      s.id as sid, s.status, s.part, s.fb, s.yt_video_id, s.uploaded_at, s.queue_pos, (s.upload is not null and s.status = 'rendered') as uploading
    from yt_ideas i left join yt_scripts s on s.idea_id = i.id
    where i.status in ('new', 'picked', 'made', 'skipped') or (i.status = 'passed' and i.source = 'You')
    order by case when s.id is null and i.status in ('new', 'picked') then 1 else 0 end, coalesce(s.uploaded_at, s.created_at, i.created_at) desc limit 300`)).rows
  const yq = await queueList().catch(() => ({ items: [], today: '' }))
  const fq = await fbQueue(12).catch(() => ({ items: [] }))
  const fbSet = await one('select enabled from meta_settings where id = 1').catch(() => null), page = await one('select 1 from meta_pages where selected').catch(() => null)
  const fbLive = !!(metaReady() && fbSet && fbSet.enabled && page)
  const ytNext = new Map(yq.items.map((x) => [x.id, when(x.day, x.time, yq.today)])), fbNext = new Map(fq.items.map((x) => [x.id, when(x.day, x.time, fq.today || yq.today)]))
  const items = rows.map((r) => {
    const stage = stageOf(r), made = r.sid && !MAKING.includes(r.status) && r.status !== 'failed'
    const yt = { on: on(r.channels, 'youtube'), locked: r.status === 'uploaded' || !!r.uploading, text: '' }
    if (!yt.on) yt.text = r.status === 'uploaded' ? 'Posted' : 'Not posting'
    else if (r.status === 'uploaded') { yt.text = 'Posted ' + date(r.uploaded_at); yt.link = r.yt_video_id ? 'https://www.youtube.com/shorts/' + r.yt_video_id : null }
    else if (r.uploading) yt.text = 'Uploading now'
    else if (r.status === 'rendered') yt.text = ytNext.has(r.sid) ? 'Next: ' + ytNext.get(r.sid) : r.queue_pos != null ? 'In the queue' : 'Waiting for the queue'
    else if (r.sid && r.status !== 'failed') yt.text = 'When ready'
    const f = r.fb || {}, fb = { on: on(r.channels, 'facebook'), locked: f.status === 'posted', text: '' }
    if (f.status === 'posted') fb.text = 'Posted ' + (f.at ? date(f.at) : '')
    else if (!fb.on || f.status === 'off') fb.text = 'Not posting'
    else if (!fbLive) fb.text = made ? 'Facebook is off' : ''
    else if (f.status === 'failed') fb.text = `Failed (${f.tries || 1} of 3 tries)`
    else if (f.status === 'skipped') fb.text = 'Skipped'
    else if (fbNext.has(r.sid)) fb.text = 'Next: ' + fbNext.get(r.sid)
    else if (made) fb.text = r.status === 'uploaded' && !f.status ? 'Not kept for Facebook' : 'Waiting'
    else if (r.sid && r.status !== 'failed') fb.text = 'When ready'
    return { id: r.id, name: r.name, url: r.url, own: r.source === 'You', first: r.first, part: r.part, stage, note: stageNote(r), what: r.what, why: r.istatus === 'passed' ? r.why : null,
      youtube: yt, facebook: fb, aside: stage === 'aside' }
  })
  const counts = { all: items.filter((x) => !x.aside).length }
  for (const k of ['idea', 'making', 'ready', 'posted', 'aside']) counts[k] = items.filter((x) => x.stage === k).length
  return { items, counts, fbLive }
}

// one tick: 'youtube' or 'facebook', on or off
export async function setChannel(ideaId, channel, value) {
  if (!['youtube', 'facebook'].includes(channel)) throw new LibraryError('Choose YouTube or Facebook.')
  const r = await one(`select i.id, i.name, i.status as istatus, i.channels, s.id as sid, s.status, s.fb, (s.upload is not null and s.status = 'rendered') as uploading
    from yt_ideas i left join yt_scripts s on s.idea_id = i.id where i.id = $1`, [Number(ideaId)])
  if (!r) throw new LibraryError('That idea is no longer there.')
  const ch = { youtube: on(r.channels, 'youtube'), facebook: on(r.channels, 'facebook') }, want = value === true
  if (ch[channel] === want) return { ok: true, channels: ch }
  const f = r.fb || {}
  if (channel === 'youtube') {
    if (r.status === 'uploaded') throw new LibraryError('It’s already on YouTube, so this can’t change.')
    if (r.uploading) throw new LibraryError('It’s uploading to YouTube right now. Try again when it’s done.')
    if (want && r.istatus === 'made' && f.status === 'posted') throw new LibraryError('Its copy was freed after Facebook posted it, so YouTube can’t have it now.')
  } else {
    if (f.status === 'posted') throw new LibraryError('It’s already on Facebook, so this can’t change.')
    if (want && r.status === 'uploaded' && ['off', 'skipped'].includes(f.status)) throw new LibraryError('Its copy was freed after YouTube posted it, so Facebook can’t have it now.')
  }
  const next = { ...ch, [channel]: want }
  if (!next.youtube && !next.facebook) throw new LibraryError('Keep at least one channel ticked, or skip the idea in YouTube → Ideas.')
  await q('update yt_ideas set channels = $2 where id = $1', [r.id, JSON.stringify(next)])
  if (r.sid && channel === 'youtube' && !want) await q('update yt_scripts set queue_pos = null where id = $1', [r.sid])        // out of YouTube's queue
  if (r.sid && channel === 'youtube' && !want && f.status === 'posted') {                           // Facebook already has it: it's done
    await dropVideo(r.sid).catch(() => {}); await q("update yt_ideas set status = 'made' where id = $1", [r.id])
  }
  if (r.sid && channel === 'facebook') {
    if (!want) {
      await q(`update yt_scripts set fb = '{"status":"off"}'::jsonb where id = $1`, [r.sid])
      if (r.status === 'uploaded') await dropVideo(r.sid).catch(() => {})                       // its copy was only kept for Facebook
    } else if (f.status === 'off') await q('update yt_scripts set fb = null where id = $1', [r.sid])
  }
  return { ok: true, channels: next }
}
