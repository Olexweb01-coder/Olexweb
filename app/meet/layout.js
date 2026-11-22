// Olexweb Meet's pages (meet.olexweb.com). The install files (manifest, worker) are offered only on the Meet address.
import { headers } from 'next/headers'
import './meet.css'
import './pub.css'
import './app.css'
export async function generateMetadata() {
  const onMeet = String(headers().get('x-forwarded-host') || headers().get('host') || '').startsWith('meet.')
  return { title: { default: 'Olexweb Meet', template: '%s | Olexweb Meet' }, description: 'Free audio and video meetings with no time limit. Join with a link, no account needed.',
    applicationName: 'Olexweb Meet', ...(onMeet ? { manifest: '/manifest.webmanifest' } : {}),
    appleWebApp: { capable: true, title: 'Meet', statusBarStyle: 'black-translucent' }, other: { 'mobile-web-app-capable': 'yes' } }
}
export const viewport = { themeColor: '#0a0b0a', colorScheme: 'dark', viewportFit: 'cover' }
export default function MeetLayout({ children }) { return children }
