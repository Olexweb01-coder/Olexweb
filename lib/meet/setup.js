// Install 58i: Olexweb Meet's setup check, read from the live server. Only "connected or not" is shown, never a key.
// Each line says what it unlocks and where it is set, so nothing quietly stays off.
import 'server-only'
import { providerReady } from './auth'
import { anyServer, selfServer, cloudServer } from './servers'
import { paystackReady } from './plans'
import { emailReady } from './email'
import { voiceReady } from '@/lib/assistant/voice'
import { notifyReady } from '@/lib/assistant/notify'

const has = (...k) => k.every((x) => String(process.env[x] || '').trim().length > 0)
export function setupChecklist() {
  const L = (group, label, ok, unlocks, how, need = false) => ({ group, label, ok: !!ok, unlocks, how, need })
  return [
    L('Basics', 'Meet’s own address', has('MEET_ORIGIN'), 'meet.olexweb.com as the home of Meet (links, invites, search engines).', 'Vercel: MEET_ORIGIN = https://meet.olexweb.com', true),
    L('Basics', 'Sign-in safety key', String(process.env.AUTH_SECRET || '').length >= 32, 'Any sign-in at all.', 'Vercel: AUTH_SECRET (32+ random characters)', true),
    L('Basics', 'Database', has('DATABASE_URL') || has('MEET_DATABASE_URL'), 'Everything.', 'Vercel: DATABASE_URL', true),
    L('Basics', 'Timed jobs (cron)', has('CRON_SECRET'), 'Reminders, membership renewals, Monday payouts, monthly awards.', 'Vercel: CRON_SECRET, and the OLEX AI job on cron-job.org', true),
    L('Meetings', 'Meeting server (LiveKit Cloud)', cloudServer(), 'Audio and video calls. 5,000 free minutes a month.', 'Vercel: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET', !anyServer()),
    L('Meetings', 'Your own meeting server', selfServer(), 'Calls with no monthly minutes limit (later, on Oracle).', 'Vercel: LIVEKIT_SELF_URL, LIVEKIT_SELF_API_KEY, LIVEKIT_SELF_API_SECRET'),
    L('Sign in', 'Email sign-in', emailReady(), 'Sign up and sign in with email and a code. Also every email Meet sends.', 'Olexweb Mail: GMAIL_USER + GMAIL_APP_PASSWORD, or RESEND_API_KEY, or MAILJET keys', true),
    L('Sign in', 'Google', providerReady('google'), '“Continue with Google”.', 'Vercel: MEET_GOOGLE_CLIENT_ID, MEET_GOOGLE_CLIENT_SECRET'),
    L('Sign in', 'Microsoft', providerReady('microsoft'), '“Continue with Microsoft”.', 'Vercel: MEET_MICROSOFT_CLIENT_ID, MEET_MICROSOFT_CLIENT_SECRET'),
    L('Sign in', 'LinkedIn', providerReady('linkedin'), '“Continue with LinkedIn”.', 'Vercel: MEET_LINKEDIN_CLIENT_ID, MEET_LINKEDIN_CLIENT_SECRET'),
    L('Sign in', 'GitHub', providerReady('github'), '“Continue with GitHub”.', 'Vercel: MEET_GITHUB_CLIENT_ID, MEET_GITHUB_CLIENT_SECRET'),
    L('Sign in', 'Facebook', providerReady('facebook'), '“Continue with Facebook”.', 'Vercel: MEET_FACEBOOK_APP_ID, MEET_FACEBOOK_APP_SECRET'),
    L('Money', 'Paystack', paystackReady(), 'Pro, tickets, bundles, memberships, sessions, certificates and payouts.', 'Vercel: PAYSTACK_SECRET_KEY; Paystack webhook https://meet.olexweb.com/api/meet/pay'),
    L('Extras', 'AI notes', voiceReady(), 'Summaries, decisions and next steps after a meeting.', 'Vercel: GROQ_API_KEY (free) or another voice key'),
    L('Extras', 'Phone notifications', notifyReady(), 'Alerts to your phone from the admin.', 'Vercel: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY'),
  ]
}
