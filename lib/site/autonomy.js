// Hands-off automation (Install 9): on Autopilot nothing waits for you.
// - Drafts are approved at once.
// - A script with problems is mended in code (scripts.js autoFix). Critical problems → thrown away and the idea written
//   again (set aside after 2 tries, so the next idea takes its place). Anything else waits at most an hour, then goes ahead.
// - A video that failed in the factory is made again by itself, up to 3 tries.
// Runs in the frequent run (every 10 minutes). On Approval it does nothing: everything waits for you as before.
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { autoFix, replaceIdea, HOLD_MIN } from './scripts'
import { fixStory } from './story'
import { notify } from '@/lib/assistant/notify'

export const MAX_RENDER_TRIES = 3
const BLOCKED = 'answered (401|403|429)|captcha|access denied|blocked|forbidden'
const expired = (t) => t && new Date(t).getTime() <= Date.now()

export async function autonomySweep() {
  const m = await one('select yt_mode from yt_settings where id = 1').catch(() => null)
  if (!m || m.yt_mode !== 'autopilot') return null
  const out = { approved: 0, held: 0, replaced: 0, remade: 0 }

  out.approved += (await q("update yt_scripts set status = 'approved', approved_at = now(), hold_until = null, updated_at = now() where status = 'draft' returning id")).rowCount

  const rows = (await q(`select s.id, s.idea_id, s.kind, s.script, s.package, s.claims, s.checks, s.page, s.hold_until, s.auto_fixes, coalesce(i.name, case when s.kind = 'story' then replace(s.package->>'title', ' #shorts', '') else 'Long video' end) as name
    from yt_scripts s left join yt_ideas i on i.id = s.idea_id where s.status = 'needs_review' order by s.id limit 10`)).rows
  for (const s of rows) {
    if (!s.hold_until) {                                                // first seen: start its hour
      await q(`update yt_scripts set hold_until = now() + interval '${HOLD_MIN} minutes' where id = $1`, [s.id]); out.held++; continue
    }
    if (!expired(s.hold_until)) { out.held++; continue }
    if (s.kind === 'long' || s.kind === 'saga') {                       // long video or long story: goes ahead if its length and chapters are right
      const bad = (s.checks || []).filter((c) => !c.ok && ['length', 'chapters'].includes(c.key))
      if (bad.length) {
        await q('delete from yt_scripts where id = $1', [s.id])
        await notify('ideas', `Autopilot threw away ${s.kind === 'saga' ? 'the long story' : 'long video'} ${s.script && s.script.volume ? 'Vol. ' + s.script.volume : ''} (${bad.map((c) => c.note).join('; ').slice(0, 90)}). The next long-video day writes a new one.`, '/admin/youtube?view=scripts')
        out.replaced++
      } else {
        await q("update yt_scripts set status = 'approved', approved_at = now(), hold_until = null, auto_fixes = $2, updated_at = now() where id = $1", [s.id, JSON.stringify(['Went ahead after an hour; the chapters that didn’t pass were kept as written'])])
        out.approved++
      }
      continue
    }
    if (s.kind === 'story' && s.script && s.script.mode === 'tale') {    // Install 32, a story Short: its important checks already passed when it was written
      await q("update yt_scripts set status = 'approved', approved_at = now(), hold_until = null, auto_fixes = $2, updated_at = now() where id = $1 and status = 'needs_review'", [s.id, JSON.stringify(['Went ahead after an hour: ' + (s.checks || []).filter((c) => !c.ok).map((c) => c.note).join('; ')])])
      out.approved++; continue
    }
    if (s.kind === 'story') {                                            // a story: mended in code, or written again
      const f = fixStory({ site: s.script.site, beats: s.script.story.beats, claims: s.claims, package: s.package, ask: s.script.story.ask }, s.page || '')
      if (f.critical.length) { await replaceIdea({ id: s.idea_id, name: s.name }, f.critical, f.res); out.replaced++; continue }
      const fixes = [...(s.auto_fixes || []), ...f.fixes, ...(f.res.ok ? [] : ['Went ahead after an hour: ' + f.res.checks.filter((c) => !c.ok).map((c) => c.note).join('; ')])]
      await q(`update yt_scripts set script = jsonb_set(script, '{story}', $2::jsonb), package = $3, claims = $4, checks = $5, seconds = $6, auto_fixes = $7,
          status = 'approved', approved_at = now(), hold_until = null, updated_at = now() where id = $1 and status = 'needs_review'`,
        [s.id, JSON.stringify({ beats: f.story.beats, ask: f.story.ask }), JSON.stringify(f.story.package), JSON.stringify(f.story.claims), JSON.stringify(f.res.checks), f.res.seconds, JSON.stringify(fixes.slice(0, 20))])
      out.approved++; continue
    }
    const f = autoFix({ ...s.script, package: s.package, claims: s.claims }, s.page || '', s.name)
    if (f.critical.length) { await replaceIdea({ id: s.idea_id, name: s.name }, f.critical, f.res); out.replaced++; continue }
    const fixes = [...(s.auto_fixes || []), ...f.fixes, ...(f.res.ok ? [] : ['Went ahead after an hour: ' + f.res.checks.filter((c) => !c.ok).map((c) => c.note).join('; ')])]
    await q(`update yt_scripts set script = jsonb_set(script, '{scenes}', $2::jsonb), package = $3, claims = $4, checks = $5, seconds = $6, auto_fixes = $7,
        status = 'approved', approved_at = now(), hold_until = null, updated_at = now() where id = $1 and status = 'needs_review'`,
      [s.id, JSON.stringify(f.script.scenes), JSON.stringify(f.script.package), JSON.stringify(f.script.claims), JSON.stringify(f.res.checks), f.res.seconds, JSON.stringify(fixes.slice(0, 20))])
    out.approved++
  }

  // videos that failed in the factory (or couldn't upload) are made again: recent ones only, up to MAX_RENDER_TRIES
  // (a website that blocks filming, 401/403/captcha, is never tried again: it would only fail the same way)
  out.remade = (await q(`update yt_scripts set status = 'approved', approved_at = coalesce(approved_at, now()), updated_at = now()
    where status = 'failed' and render_tries < $1 and coalesce(render_error, '') !~* $2 and updated_at < now() - interval '10 minutes' and updated_at > now() - interval '2 days' returning id`, [MAX_RENDER_TRIES, BLOCKED])).rowCount
  out.dropped = await dropDead()
  return out
}

// For the screens: what Autopilot is doing on its own right now.
export async function autonomyState() {
  const held = (await q(`select s.id, s.hold_until, coalesce(i.name, case when s.kind = 'story' then replace(s.package->>'title', ' #shorts', '') else 'Long video' end) as name from yt_scripts s left join yt_ideas i on i.id = s.idea_id
    where s.status = 'needs_review' order by s.hold_until nulls last limit 5`)).rows.map((r) => ({ id: r.id, name: r.name, until: r.hold_until ? r.hold_until.toISOString() : null }))
  const gaveUp = (await q(`select s.id, s.render_error, coalesce(i.name, case when s.kind = 'story' then replace(s.package->>'title', ' #shorts', '') else 'Long video' end) as name from yt_scripts s left join yt_ideas i on i.id = s.idea_id
    where s.status = 'failed' and s.render_tries >= $1 and s.updated_at > now() - interval '7 days' order by s.updated_at desc limit 5`, [MAX_RENDER_TRIES])).rows
  const replaced = (await one("select count(*)::int n from audit_log where action = 'yt_script_replaced' and at > now() - interval '7 days'")).n
  return { held, gaveUp, replaced }
}

// Install 41: on its own, so it also runs while the plan is on
export async function dropDead() {
  let dropped = 0
  // Install 37: a video the factory can't make is dropped by itself: its idea is set aside with the reason, its plan slot is
  // written again, and the next video takes its place. Nothing waits for you.
  const dead = (await q(`select s.id, s.idea_id, s.render_error, coalesce(i.name, replace(s.package->>'title', ' #shorts', ''), 'A video') as name from yt_scripts s left join yt_ideas i on i.id = s.idea_id
    where s.status = 'failed' and (s.render_tries >= $1 or coalesce(s.render_error, '') ~* $2) and s.updated_at < now() - interval '10 minutes' order by s.id limit 10`, [MAX_RENDER_TRIES, BLOCKED])).rows
  for (const d of dead) {
    const why = String(d.render_error || 'the factory kept failing').slice(0, 200)
    if (d.idea_id) await q("update yt_ideas set status = 'passed', first = false, risks = $2, decided_at = now() where id = $1", [d.idea_id, ('Set aside by itself: the video couldn’t be made (' + why + ')').slice(0, 400)])
    await q("update plan_slots set script_id = null where script_id = $1 and status = 'planned'", [d.id]).catch(() => {})
    await q('delete from yt_scripts where id = $1 and status = $2', [d.id, 'failed'])
    await q("insert into audit_log (action, detail) values ('yt_video_dropped', $1)", [JSON.stringify({ id: d.id, idea: d.idea_id, name: d.name, why })])
    await notify('ideas', `${d.name} couldn’t be made (${why.slice(0, 90)}), so it was dropped and the next video takes its place. Nothing to do.`, '/admin/youtube?view=progress').catch(() => {})
    dropped++
  }
  return dropped
}
