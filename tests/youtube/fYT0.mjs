// Before the uploads: every test video's site gets a live Directory page (so its Short should carry the guide link)
import pg from 'pg'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
await db.query("delete from dir_entries where slug like 'guide-%'")
const r = await db.query("insert into dir_entries (slug, idea_id, name, url, status, content, quality, published_at) select 'guide-' || i.id, i.id, i.name, i.url, 'live', '{}'::jsonb, '{\"ok\":true}'::jsonb, now() from yt_ideas i where exists (select 1 from yt_scripts s where s.idea_id = i.id) and not exists (select 1 from dir_entries d where d.idea_id = i.id) returning slug")
console.log('  (guide pages ready for ' + r.rowCount + ' test videos)'); await db.end()
