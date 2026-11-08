import StartChoice from '@/components/site/StartChoice'
import LeadClicks from '@/components/site/LeadClicks'
// Root layout shared by both versions: fonts and site-wide settings only. No styles here:
// the new site brings its own, and the studio's live in app/(studio)/layout.js.
import { Manrope } from 'next/font/google'
import localFont from 'next/font/local'
import { SITE } from '@/lib/seo'

// preload: false — fonts load when the page uses them instead of jumping the queue, so on slow connections the page
// itself (and the homepage opening, which carries its own small font) arrives first
const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-manrope', display: 'swap', preload: false })   // the studio's font
const hubot = localFont({ src: './fonts/hubot-sans.woff2', variable: '--font-hubot', weight: '200 900', display: 'swap', preload: false, declarations: [{ prop: 'font-stretch', value: '75% 125%' }], adjustFontFallback: 'Arial' })
const mona = localFont({ src: './fonts/mona-sans.woff2', variable: '--font-mona', weight: '200 900', display: 'swap', preload: false, declarations: [{ prop: 'font-stretch', value: '75% 125%' }], adjustFontFallback: 'Arial' })

export const metadata = {
  metadataBase: new URL(SITE),
  applicationName: 'Olexweb',
  manifest: '/site.webmanifest',
  formatDetection: { telephone: false },
  alternates: { types: { 'application/rss+xml': [{ url: '/feed.xml', title: 'Olexweb: tools, tech updates, how-tos and safety alerts' }] } },   // Install 16
}
export const viewport = { themeColor: '#0a0b0a', colorScheme: 'dark', width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={[manrope.variable, hubot.variable, mona.variable].join(' ')} data-time="day" style={{ backgroundColor: '#0a0b0a' }} suppressHydrationWarning>
      {/* the page scripts set classes here before React takes over (the opening, the About name animation); that is expected */}
      <body suppressHydrationWarning>{children}<LeadClicks /><StartChoice /></body>
    </html>
  )
}
