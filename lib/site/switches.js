// Install 31: every on/off switch for the automation in one place, in plain words (Automation → Today, top).
import 'server-only'
import { q, one } from '@/lib/admin/db'
export async function switchesData() {
  const fb = await one('select enabled, paused_reason, story_on, story_time from meta_settings where id = 1').catch(() => null)
  const page = await one('select name from meta_pages where selected').catch(() => null)
  const yt = await one('select yt_mode, plan_on from yt_settings where id = 1').catch(() => null)
  const dir = await one('select auto_publish, per_day from dir_settings where id = 1').catch(() => null)
  const blog = await one('select mode, pace from assistant_settings where id = 1').catch(() => null)
  const list = []
  if (page) {
    list.push({ key: 'fb', on: !!(fb && fb.enabled && !fb.paused_reason), name: 'Facebook posting', page: page.name,
      onText: `Posts to ${page.name}: Reels on Monday, Wednesday and Friday, and the daily story.`, offText: `Nothing goes to ${page.name}.`, warn: fb && fb.paused_reason ? 'Stopped after a problem: ' + fb.paused_reason + ' Turn it on to try again.' : null })
    list.push({ key: 'stories', on: !!(fb && fb.story_on), name: 'Daily Facebook story', onText: `A story in words and pictures every day at ${(fb && fb.story_time) || '20:00'}.`, offText: 'No daily stories.' })
  }
  if (yt) list.push({ key: 'ytAuto', on: yt.yt_mode === 'autopilot', name: 'Videos post without asking me', onText: 'New videos are made and posted by themselves.', offText: 'Every new video waits for your Approve (Automation → Plan).' })
  if (dir) list.push({ key: 'dirAuto', on: !!dir.auto_publish, name: 'Directory posts by itself', onText: `About ${dir.per_day} checked posts a day (tools, tech stories, how-tos, alerts).`, offText: 'New Directory posts wait for you.' })
  if (blog) list.push({ key: 'blogAuto', on: blog.mode === 'autopilot', name: 'Blog posts by itself', onText: 'New articles are published after their checks.', offText: 'New articles wait for your OK.' })
  return list
}
export async function setSwitch(key, on) {
  on = !!on
  if (key === 'fb') { await q('update meta_settings set enabled = $1, paused_reason = case when $1 then null else paused_reason end, paused_at = case when $1 then null else paused_at end where id = 1', [on]); return }
  if (key === 'stories') { await q('update meta_settings set story_on = $1 where id = 1', [on]); return }
  if (key === 'ytAuto') { await q('update yt_settings set yt_mode = $1 where id = 1', [on ? 'autopilot' : 'approval']); return }
  if (key === 'dirAuto') { await q('update dir_settings set auto_publish = $1 where id = 1', [on]); return }
  if (key === 'blogAuto') {
    await q('update assistant_settings set mode = $1, updated_at = now() where id = 1', [on ? 'autopilot' : 'approval'])
    if (!on) await q("update posts set auto_publish_at = null where origin = 'assistant' and status = 'waiting'")
    return
  }
  throw new Error('Unknown switch.')
}
