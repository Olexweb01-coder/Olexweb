// Olexweb Meet's money maths, in one place (Install 58). Everything is counted in kobo (₦1 = 100 kobo) as whole
// numbers, so nothing is ever lost to rounding. Prices people type are whole naira.
//   Olexweb's share: a fixed percent of the price, rounded DOWN to the kobo (any part-kobo stays with the host).
//   Paystack's fee: set by Paystack, paid by the host (bearer = subaccount). Today: 1.5% + ₦100, the ₦100 waived under
//   ₦2,500, capped at ₦2,000 (support.paystack.com/en/articles/2130306). We show it as "about", since Paystack works it out.
//   The host gets: price − Olexweb's share − Paystack's fee.
// No server-only import here: the pages show the same numbers the server charges.

export const PCT = { ticket: 5, booking: 5, bundle: 5, cert: 5, directory: 10, membership: 7 }
export const WHY = { ticket: 'Olexweb', booking: 'Olexweb', bundle: 'Olexweb', cert: 'Olexweb', directory: 'Olexweb (we brought you this client)', membership: 'Olexweb (platform management)' }
export const PS_FEE = { pct10000: 150, flat: 10000, waiveUnder: 250000, cap: 200000 }   // 1.5% = 150 / 10,000; kobo
export const INVITE_PCT = 15                                               // of each Pro payment by someone you invited (Install 64; was 30)
export const INVITE_MONTHS = 6                                             // ...for the first 6 months after their first Pro payment (was 12)
export const INVITES_FOR_SPOT = 10                                         // invites who host within 15 days: spotlight, badge and a day of Pro (was 5 for a week)
export const HOLD_DAYS = 14                                                // commission can be paid out 14 days after the payment (refund window)
// Ambassador of the month: a fixed prize (set in the admin; ₦5,000 to start), paid only when what Olexweb kept from that
// person's invitees that month (after Paystack and their commission) is at least twice the prize. Otherwise the badge and spotlight only.
export const AMBASSADOR = { prizeNaira: 5000, cover: 2, minInvites: 3 }
export const PAYOUT_MIN = 100_000                                          // ₦1,000: smaller amounts wait for the next Monday

const int = (n) => { if (!Number.isSafeInteger(n) || n < 0) throw new Error('money: bad amount ' + n); return n }
export const kobo = (naira) => int(Math.round(Number(naira) * 100))
export const share = (koboAmount, pct) => int(Math.floor((int(koboAmount) * int(pct)) / 100))
export function paystackFee(koboAmount) {
  const k = int(koboAmount)
  const f = Math.ceil((k * PS_FEE.pct10000) / 10000) + (k >= PS_FEE.waiveUnder ? PS_FEE.flat : 0)
  return Math.min(f, PS_FEE.cap)
}
// what one sale splits into (all kobo). price: whole naira; kind: a key of PCT
export function breakdown(priceNaira, kind) {
  if (!(kind in PCT)) throw new Error('money: unknown kind ' + kind)
  const price = kobo(priceNaira), olexweb = share(price, PCT[kind]), paystack = paystackFee(price), host = price - olexweb - paystack
  if (host <= 0) throw new Error('money: price too small')
  return { price, pct: PCT[kind], olexweb, paystack, host }
}
export const naira = (k) => '₦' + (k / 100).toLocaleString('en-NG', { minimumFractionDigits: k % 100 ? 2 : 0, maximumFractionDigits: 2 })
// a discount (members) or early-bird: whole naira, never below ₦100
export const discounted = (priceNaira, pct) => Math.max(100, Math.round(Number(priceNaira) * (100 - Math.min(Math.max(Math.round(Number(pct) || 0), 0), 50)) / 100))
