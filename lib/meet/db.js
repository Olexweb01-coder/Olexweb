// Olexweb Meet's database connection (server only). Meet's own database (MEET_DATABASE_URL_POOLED / MEET_DATABASE_URL)
// when it's set, so busy public meetings can't use up the admin database's monthly limits; otherwise the main one.
import 'server-only'
import pg from 'pg'
import * as main from '@/lib/admin/db'

const raw = () => process.env.MEET_DATABASE_URL_POOLED || process.env.MEET_DATABASE_URL || ''
export const ownDatabase = () => !!raw()
function config() {
  const u = new URL(raw()), local = ['localhost', '127.0.0.1'].includes(u.hostname)
  u.searchParams.delete('sslmode'); u.searchParams.delete('channel_binding')   // TLS is configured below instead
  return { connectionString: u.toString(), ssl: local ? false : { rejectUnauthorized: true }, max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 15_000 }
}
const pool = () => (globalThis.__olexMeetPool ||= new pg.Pool(config()))   // opened on the first query, never at build time
// Every query is parameterized: values never become part of the SQL text.
export const q = (text, params = []) => (ownDatabase() ? pool().query(text, params) : main.q(text, params))
export const one = async (text, params = []) => (ownDatabase() ? (await pool().query(text, params)).rows[0] || null : main.one(text, params))
