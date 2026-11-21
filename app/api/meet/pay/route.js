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
  const to = r.ok && r.kind === 'meeting' && r.code ? `${home().replace(/\/$/, '')}/${r.code}` : `${home()}?paid=${r.ok ? '1' : '0'}#dashboard`
  return NextResponse.redirect(to, 303)
}
export async function POST(request) {
  const raw = await request.text()
  if (!paystackSigned(raw, request.headers.get('x-paystack-signature'))) return NextResponse.json({ error: 'Not signed.' }, { status: 401 })
  let ev = {}; try { ev = JSON.parse(raw) } catch {}
  if (ev.event === 'charge.success' && ev.data && ev.data.reference) await confirmPayment(ev.data.reference).catch(() => {})
  return NextResponse.json({ ok: true })
}
