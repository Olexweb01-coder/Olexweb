// Automation: one place for every channel. YouTube and Facebook each have their own switch, times and queue, and both pick
// from the same library of finished videos (so if both post 2 a day, the same videos go to both and the factory must keep up).
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { queueList } from './publish'
import { metaStatus } from './meta'
import { sendNext } from './factory'
import { writeNextScript } from './scripts'

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

export async function overviewData() {
  const yt = await one('select yt_mode, publish_mode from yt_settings where id = 1')
  const acct = await one('select channel_id from yt_account where id = 1').catch(() => null)
  const queue = await queueList()
  const fb = await metaStatus().catch(() => null)
  const fbOn = !!(fb && fb.ready && fb.enabled && fb.page && !fb.paused)
  const ytAuto = yt.yt_mode === 'autopilot'

  // what the channels need a day: the same videos serve both, so it's the bigger of the two
  const need = Math.max(ytAuto ? queue.perDay : 0, fbOn ? fb.perDay : 0)
  const made = (await one(`select count(*)::int n from yt_scripts where kind is distinct from 'long' and video is not null
    and coalesce((video->>'made_at')::timestamptz, updated_at) > now() - interval '7 days' and status in ('rendered', 'uploaded')`)).n
  // finished videos at least one channel still has to post (YouTube: not uploaded yet; Facebook: waiting in its queue)
  // (with the Library's ticks: YouTube still wants it if ticked and not uploaded; Facebook if ticked and not posted or given up)
  const ready = (await one(`select count(*)::int n from yt_scripts s left join yt_ideas i on i.id = s.idea_id where s.kind is distinct from 'long' and s.video is not null and (s.video->>'bytes') is not null
    and ((s.status = 'rendered' and coalesce(i.channels->>'youtube', 'true') <> 'false')
      or (coalesce(i.channels->>'facebook', 'true') <> 'false' and coalesce(s.fb->>'status', '') not in ('posted', 'skipped', 'off')
        and (s.status = 'rendered' or (s.status = 'uploaded' and s.fb->>'status' in ('pending', 'failed')))))`)).n
  const perDay = Math.round((made / 7) * 10) / 10
  const days = need ? Math.floor(ready / need) : null
  const short = need > 0 && (perDay < need || days < 2)

  const waitingScripts = (await one("select count(*)::int n from yt_scripts where status in ('draft', 'needs_review')")).n
  const blogWaiting = (await one("select count(*)::int n from posts where status = 'waiting'")).n
  const needs = []
  if (waitingScripts) needs.push({ text: `${plural(waitingScripts, 'script')} waiting for approval`, href: '/admin/youtube?view=scripts' })
  if (blogWaiting) needs.push({ text: `Blog: ${plural(blogWaiting, 'draft')} waiting`, href: '/admin/blog' })
  if (fb && fb.paused) needs.push({ text: 'Facebook posting is paused', href: '/admin/automation/facebook' })
  if (!ytAuto) needs.push({ text: 'YouTube is on Approval: new scripts wait for you', href: '/admin/youtube?view=scripts' })

  const ytToday = queue.todayDone, next = queue.items.find((x) => x.day === queue.today)
  return {
    production: { need, perDay, ready, days, short, channels: [ytAuto ? 'YouTube' : null, fbOn ? 'Facebook' : null].filter(Boolean) },
    youtube: { connected: !!(acct && acct.channel_id), mode: yt.yt_mode, times: queue.times, todayDone: ytToday, nextToday: next ? next.time : null, queue: queue.items.length,
      queueDays: queue.perDay ? Math.round((queue.items.length / queue.perDay) * 2) / 2 : 0, status: yt.publish_mode === 'scheduled' ? 'Public at its posting times' : 'Private until the audit' },
    facebook: fb ? { ready: fb.ready, connected: !!fb.page, page: fb.page && fb.page.name, enabled: fb.enabled, paused: !!fb.paused, times: fb.times, perDay: fb.perDay,
      todayDone: fb.queue.todayDone, nextToday: (fb.queue.items.find((x) => x.when === 'today') || {}).time || null, queue: fb.queue.waiting } : null,
    needs,
  }
}

// "Make more": send the next approved script to the factory now; if none is waiting, write the next script from a picked idea
export async function makeMore() {
  const f = await sendNext().catch((e) => { throw new Error('The factory couldn’t start: ' + e.message) })
  if (f) return { ok: true, message: 'The next video is on its way to the factory.' }
  if (await one("select 1 from yt_scripts where status = 'rendering'")) return { ok: true, message: 'The factory is already making a video. The next one starts when it’s done.' }
  const w = await writeNextScript()
  if (w) return { ok: true, message: 'A new script is being written. On Autopilot it goes to the factory by itself.' }
  return { ok: true, message: 'No picked ideas are waiting. Olex AI finds new ones every day, or pick some in YouTube → Ideas.' }
}
