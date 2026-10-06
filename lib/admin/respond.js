// One way to answer every action: refusals get their message, anything unexpected is logged and kept vague.
import 'server-only'
import { NextResponse } from 'next/server'
import { Refused } from './content'
export async function respond(fn) {
  try { return NextResponse.json(await fn()) }
  catch (e) {
    if (e instanceof Refused) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('action failed', e)
    return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500 })
  }
}
export const refuse = (msg, status) => NextResponse.json({ error: msg }, { status })
export async function readJson(request) { try { return (await request.json()) || {} } catch { return null } }
