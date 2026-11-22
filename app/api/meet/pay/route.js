// Paystack: GET is where the payer comes back (?reference=…); POST is Paystack's webhook (Settings → API Keys & Webhooks →
// Webhook URL: https://meet.olexweb.com/api/meet/pay). Either way the payment is checked with Paystack before anything changes.
import { NextResponse } from 'next/server'
import { confirmPayment, paystackSigned } from '@/lib/meet/plans'
import { meetBase, mainOrigin } from '@/lib/site/meet'
export const dynamic = 'force-dynamic'
const home = () => (meetBase() ? meetBase() + '/' : mainOrigin() + '/meet')
export async function GET(request) {
  const ref = new URL(request.url).searchParams.get('reference') || ''
  const r = await confirmPayment(ref).catch(() => ({ ok: false }))
  const base = home().replace(/\/$/, '')
  let to = r.ok && r.kind === 'ticket' && r.code && r.pass ? `${base}/${r.code}?pass=${r.pass}` : r.ok && r.kind === 'meeting' && r.code ? `${base}/${r.code}` : `${home()}?paid=${r.ok ? '1' : '0'}#dashboard`
  // Install 58: where each kind of sale lands (always on the main or Meet address, never a page the payer chose)
  const site = (meetBase() || mainOrigin()).replace(/\/$/, ''), path = meetBase() ? '' : '/meet'
  if (r.ok && r.kind === 'bundle' && r.refId) { const pass = await (await import('@/lib/meet/bundles')).firstPass(r.id).catch(() => null); to = `${site}/meet/b/${r.refId}${pass ? '?pass=' + pass : ''}` }
  if (r.ok && r.kind === 'cert') { const serial = await (await import('@/lib/meet/certs')).serialOfPayment(r.id).catch(() => null); if (serial) to = `${site}${path}/v/${serial}` }
  if (r.ok && r.kind === 'membership') to = `${home()}?paid=1&member=1#dashboard`
  if (!r.ok && ref) to = `${home()}?paid=0#dashboard`
  return NextResponse.redirect(to, 303)
}
export async function POST(request) {
  const raw = await request.text()
  if (!paystackSigned(raw, request.headers.get('x-paystack-signature'))) return NextResponse.json({ error: 'Not signed.' }, { status: 401 })
  let ev = {}; try { ev = JSON.parse(raw) } catch {}
  if (ev.event === 'charge.success' && ev.data && ev.data.reference) await confirmPayment(ev.data.reference).catch(() => {})
  if (ev.event === 'refund.processed' && ev.data && ev.data.transaction_reference) {   // Install 58f: a refunded Pro payment cancels its unpaid commission
    const { one } = await import('@/lib/meet/db'); const p = await one('select id from meet_payments where reference = $1', [String(ev.data.transaction_reference).slice(0, 100)]).catch(() => null)
    if (p) await (await import('@/lib/meet/payouts')).inviteRefunded(p.id).catch(() => {})
  }
  if (/^transfer\.(success|failed|reversed)$/.test(ev.event || '') && ev.data && ev.data.reference) await (await import('@/lib/meet/payouts')).transferEvent(ev.data.reference).catch(() => {})   // Monday payouts
  return NextResponse.json({ ok: true })
}
