// Install 58l: entry codes. Registering for a meeting that asks for it, or buying a ticket, gives one person one short
// code (like K7QM-29XA). It works for the whole meeting: drop out, get removed, change phones, come back with the same
// code. It's one person at a time: joining with it on a second device takes the first one out of the room.
import 'server-only'
import { randomInt } from 'node:crypto'
import { q, one } from './db'

const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'                       // no 0/O, 1/I/L
export const newEntry = () => { let s = ''; for (let i = 0; i < 8; i++) s += A[randomInt(A.length)]; return s }
export const showEntry = (e) => (e ? e.slice(0, 4) + '-' + e.slice(4) : '')
export const normEntry = (s) => { const x = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return x.length === 8 && [...x].every((c) => A.includes(c)) ? x : null }
// which registration or ticket a code (or a ticket's long key) belongs to, for this meeting
export async function entryFor(code, key) {
  const e = normEntry(key)
  if (e) {
    const r = await one('select id, live_identity from meet_regs where code = $1 and entry = $2', [code, e]); if (r) return { t: 'meet_regs', k: 'id', id: r.id, live: r.live_identity }
    const p = await one('select pass, live_identity from meet_passes where entry = $2 and (code = $1 or bundle_id in (select bundle_id from meet_bundle_items where code = $1))', [code, e]); if (p) return { t: 'meet_passes', k: 'pass', id: p.pass, live: p.live_identity }
    return null
  }
  if (key && String(key).length === 22) {
    const p = await one('select pass, live_identity from meet_passes where pass = $2 and (code = $1 or bundle_id in (select bundle_id from meet_bundle_items where code = $1))', [code, String(key)]); if (p) return { t: 'meet_passes', k: 'pass', id: p.pass, live: p.live_identity }
  }
  return null
}
// the person is in with this code now; whoever held it before (another device) is returned so they can be taken out
export async function holdEntry(ent, identity) {
  const prev = ent.live && ent.live !== identity ? ent.live : null
  await q(`update ${ent.t} set live_identity = $2 where ${ent.k} = $1`, [ent.id, identity])
  return prev
}
export async function entryOfPass(pass) {
  const p = await one('select entry from meet_passes where pass = $1', [pass]); if (!p) return null
  if (p.entry) return p.entry
  for (let i = 0; i < 5; i++) { const e = newEntry(); const r = await one('update meet_passes set entry = $2 where pass = $1 and entry is null returning entry', [pass, e]).catch(() => null); if (r) return r.entry }
  return null
}
