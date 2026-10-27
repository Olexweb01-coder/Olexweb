// Before the uploads: every test video's site gets a live Directory page (so its Short should carry the guide link)
import pg from 'pg'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
await db.query("delete from dir_entries where slug like 'guide-%'"); await db.query("delete from meta_pages; update meta_settings set enabled = false, paused_at = null, paused_reason = null; update yt_scripts set fb = null")   // every run starts with Facebook off
await db.query("update yt_scripts set uploaded_at = uploaded_at - interval '13 days' where status = 'uploaded'; delete from meta_posts")   // earlier runs' uploads don't take today's slots
const r = await db.query("insert into dir_entries (slug, idea_id, name, url, status, content, quality, published_at) select 'guide-' || i.id, i.id, i.name, i.url, 'live', '{}'::jsonb, '{\"ok\":true}'::jsonb, now() from yt_ideas i where exists (select 1 from yt_scripts s where s.idea_id = i.id) and not exists (select 1 from dir_entries d where d.idea_id = i.id) returning slug")
console.log('  (guide pages ready for ' + r.rowCount + ' test videos)'); await db.end()
