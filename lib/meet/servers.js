// Which video server a meeting runs on. Two are possible:
//   self  — our own LiveKit server (free, no minutes limit): LIVEKIT_SELF_URL, LIVEKIT_SELF_API_KEY, LIVEKIT_SELF_API_SECRET
//   cloud — LiveKit Cloud (the backup, 5,000 free minutes a month): LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
// A new meeting goes to our own server when it answers, else to the backup. A meeting stays on one server for its whole
// life (everyone in it must be on the same one), saved in meetings.server (empty = cloud, the meetings from before).
// Without the LIVEKIT_SELF_* variables everything works exactly as before: LiveKit Cloud only.
import 'server-only'
import { RoomServiceClient } from 'livekit-server-sdk'

const env = (k) => String(process.env[k] || '').trim()
const make = (id, u, k, s) => (env(u) && env(k) && env(s) ? { id, url: env(u).replace(/\/$/, ''), key: env(k), secret: env(s) } : null)
export const selfServer = () => make('self', 'LIVEKIT_SELF_URL', 'LIVEKIT_SELF_API_KEY', 'LIVEKIT_SELF_API_SECRET')
export const cloudServer = () => make('cloud', 'LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET')
export const anyServer = () => !!(selfServer() || cloudServer())
// the server for a saved name; if that one isn't set up any more, whichever is
export const serverFor = (id) => (id === 'self' ? selfServer() : cloudServer()) || cloudServer() || selfServer()
export const roomsOf = (s) => new RoomServiceClient(s.url.replace(/^ws(s?):\/\//, 'http$1://'), s.key, s.secret)

// is our own server answering? asked at most once a minute (fresh = ask now, used before moving a meeting off it)
let seen = { at: 0, ok: false }
export async function selfHealthy(fresh = false) {
  const s = selfServer()
  if (!s) return false
  if (!fresh && Date.now() - seen.at < 60_000) return seen.ok
  let t
  const ok = await Promise.race([roomsOf(s).listRooms().then(() => true, () => false), new Promise((r) => { t = setTimeout(() => r(false), fresh ? 4000 : 2500) })])
  clearTimeout(t)
  seen = { at: Date.now(), ok }
  return ok
}
// where a meeting starting now would go
export const pickServer = async () => ((await selfHealthy()) || !cloudServer() ? 'self' : 'cloud')
// for the admin: 'ok' | 'down' | 'off'
export const status = async () => ({ self: !selfServer() ? 'off' : (await selfHealthy()) ? 'ok' : 'down', cloud: !!cloudServer() })
