// The admin's database connection (server only). Uses Neon's pooled address; verifies the TLS certificate fully.
import 'server-only'
import pg from 'pg'

function config() {
  const raw = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL
  if (!raw) throw new Error('DATABASE_URL_POOLED is not set')
  const u = new URL(raw)
  const local = ['localhost', '127.0.0.1'].includes(u.hostname)
  u.searchParams.delete('sslmode'); u.searchParams.delete('channel_binding')   // TLS is configured below instead
  return { connectionString: u.toString(), ssl: local ? false : { rejectUnauthorized: true }, max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 15_000 }
}
// Opened on the first query, not when the file loads (so building the site never needs the database).
const pool = () => (globalThis.__olexPool ||= new pg.Pool(config()))
// Every query is parameterized: values never become part of the SQL text.
export const q = (text, params = []) => pool().query(text, params)
export const one = async (text, params = []) => (await pool().query(text, params)).rows[0] || null
