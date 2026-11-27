// Olexweb Meet's policies (Install 58), in plain English. Numbers come from lib/meet/money.js so the policy can never
// say something different from what the app charges. Olexweb's general Terms and Privacy policy (olexweb.com/terms,
// /privacy) still apply; these add what's specific to Meet. Version and date are shown on each page.
import { PCT, PS_FEE, INVITE_PCT, INVITE_MONTHS, INVITES_FOR_SPOT, HOLD_DAYS, AMBASSADOR, PAYOUT_MIN, breakdown, naira } from './money'

export const UPDATED = '2026-11-22', VERSION = '1.1', SUPPORT = 'support@olexweb.com'
const ex = breakdown(5000, 'ticket')
export const POLICIES = {
  earnings: { title: 'Earnings and Payouts', lead: 'How you earn on Olexweb Meet, what it costs, and when the money reaches your bank. Every fee is shown before you sell, never after.',
    sections: [
      ['What you keep', [
        `Every payment is split the moment it’s made. Olexweb’s share is fixed: ${PCT.ticket}% on tickets, one-on-one sessions, course bundles and certificates; ${PCT.membership}% on memberships (for running the platform); ${PCT.directory}% on sessions booked from Find a mentor (because we brought you the client).`,
        `Paystack, the payment company, charges its own fee on every payment, and you pay it. Today it is ${PS_FEE.pct10000 / 100}% plus ₦${PS_FEE.flat / 100} (the ₦${PS_FEE.flat / 100} is waived under ₦${(PS_FEE.waiveUnder / 100).toLocaleString('en-NG')}), at most ₦${(PS_FEE.cap / 100).toLocaleString('en-NG')} a payment. Paystack sets it; if it changes, we show you the new amount before your next sale.`,
        `A ₦5,000 ticket, to the kobo: ${naira(ex.paystack)} to Paystack, ${naira(ex.olexweb)} to Olexweb, ${naira(ex.host)} to you.`,
        'Olexweb’s share is rounded down to the kobo, so any part of a kobo stays with you.']],
      ['When you’re paid', [
        'Payments for your sales go straight to your own bank account through Paystack. Olexweb never holds your money.',
        'Paystack pays your sales into your bank every week. You can see every sale, with its exact split, in Earn.',
        `Money Olexweb pays you (referral commission and the Ambassador prize) is sent every Monday by bank transfer, once ${naira(PAYOUT_MIN)} or more is waiting. Smaller amounts wait for the next Monday.`]],
      ['Memberships', [
        'You choose a monthly price and promise a number of members-only meetings a month. Olexweb counts the members-only meetings you actually hold and shows that count on your membership page.',
        'If you hold no members-only meeting in a member’s month, that member is not charged for the next one. Their membership pauses and starts again (with a charge) when you hold one.',
        'Members can cancel any time and keep access until the end of the month they paid for. A new price applies to new members only.']],
      ['Referrals and the Ambassador prize', [
        `You earn ${INVITE_PCT}% of every Pro payment made by someone who joined through your invite link, for their first ${INVITE_MONTHS} months of Pro.`,
        `Commission can be paid out ${HOLD_DAYS} days after the payment it comes from (so refunds can be handled first), on the next Monday once ${naira(PAYOUT_MIN)} or more is ready. If that payment is refunded before then, its commission is cancelled.`,
        `${INVITES_FOR_SPOT} people you invite who host their first meeting within 15 days: the Super connector badge, a week in the spotlight and a day of Pro, free.`,
        `Ambassador of the month: whoever’s invites brought the most new hosts last month (at least ${AMBASSADOR.minInvites}) wins a fixed cash prize, paid when the payments of the people they invited that month cover it. Otherwise the prize is the Ambassador badge and a week in the spotlight.`]],
      ['Refunds and disputes', [
        'If a buyer is refunded, or wins a dispute with their bank, the refunded amount comes back out of that sale: your part and Olexweb’s part are both returned to the buyer. Paystack doesn’t give back its own fee on a refunded payment.',
        'See the Refunds policy for when buyers can ask for their money back.']],
      ['What’s not allowed', [
        'Inviting yourself, fake accounts, or paying people to sign up.',
        'Selling something you don’t deliver, or charging for meetings you don’t hold.',
        'Reviews that aren’t from real attendees, or certificates for people who didn’t attend.',
        'Breaking these rules cancels the rewards involved and can close your account. Money already paid for undelivered sales may be refunded to buyers.']],
      ['Taxes', ['You are responsible for any tax on what you earn. Your sales and payouts are listed in Earn, to help with your records.']],
      ['Changes and contact', [`We tell you in the app at least 30 days before we change Olexweb’s share. Questions about a payout: ${SUPPORT}.`]],
    ] },
  refunds: { title: 'Refunds', lead: 'When you can get your money back on Olexweb Meet, and how.',
    sections: [
      ['Tickets, bundles and one-on-one sessions', [
        'If a paid meeting or session never happens (the host doesn’t start it) or the host cancels it, ask for a refund within 14 days. We check our records, and if it didn’t happen, you get your money back in full through Paystack.',
        'If you couldn’t attend a meeting that did happen, the host decides whether to refund you. Ask them first; if they don’t answer within 7 days, contact us.',
        'For a course bundle, sessions that didn’t happen are refunded in proportion to the bundle’s price.']],
      ['Memberships', [
        'Cancel any time in the app; you won’t be charged again, and you keep access until your paid month ends. The current month isn’t refunded.',
        'If the host held no members-only meeting in your month, you aren’t charged for the next month at all: your membership pauses automatically.',
        'If you were charged by mistake, tell us within 14 days and we refund it.']],
      ['Certificates', ['A paid certificate is issued straight away, so it isn’t refunded once issued, unless it was issued with a mistake we can’t fix.']],
      ['Pro plans and invoices', [
        'Pro is not refunded for part of a month or year. If you were charged twice or by mistake, tell us within 14 days and we refund it.',
        'Bank transfers we can’t match to your account are refunded to the account they came from.']],
      ['How to ask', [`Use Help in the app (your request is answered there and by email), or write to ${SUPPORT}. Include the email you paid with and the date. Refunds go back to the card or account you paid with; Paystack usually takes 5 to 10 working days.`]],
    ] },
  community: { title: 'Community rules', lead: 'Olexweb Meet works because people can trust it. These rules apply to everyone: hosts, guests, mentors and members.',
    sections: [
      ['Be respectful', ['No harassment, hate, threats or bullying, in meetings, chat, reviews or profiles.', 'Hosts can remove anyone who breaks these rules from their meeting. Anyone can report a meeting from inside it.']],
      ['Keep it legal and safe', ['No illegal content, scams, or sharing someone else’s private information.', 'Nothing sexual involving anyone under 18, ever. We report it.']],
      ['Be honest', ['Your profile, prices and promises must be true. Sell only what you deliver.', 'Reviews come only from people who were in the meeting. Don’t ask for fake reviews or write them.', 'Certificates are only for people who really attended. Don’t sell them for meetings that didn’t happen.']],
      ['Play fair', ['One account per person. No self-invites, fake accounts or paid sign-ups to win rewards or climb the leaderboard.', 'Leaderboard numbers come from real meetings; gaming them removes you from the board and cancels the rewards.']],
      ['What happens if rules are broken', ['We may warn you, remove content, cancel rewards, stop payouts linked to the abuse, refund buyers, or close the account. Serious cases may be reported to the authorities.', `To appeal a decision, write to ${SUPPORT}.`]],
    ] },
}
