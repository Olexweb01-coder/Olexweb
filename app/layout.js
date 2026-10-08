import LeadClicks from '@/components/site/LeadClicks'
// Root layout shared by both versions: fonts and site-wide settings only. No styles here:
// the new site brings its own, and the studio's live in app/(studio)/layout.js.
import { Manrope } from 'next/font/google'
import localFont from 'next/font/local'
import { SITE } from '@/lib/seo'

const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-manrope', display: 'swap' })   // the studio's font
const hubot = localFont({ src: './fonts/hubot-sans.woff2', variable: '--font-hubot', weight: '200 900', display: 'swap', declarations: [{ prop: 'font-stretch', value: '75% 125%' }], adjustFontFallback: 'Arial' })
const mona = localFont({ src: './fonts/mona-sans.woff2', variable: '--font-mona', weight: '200 900', display: 'swap', declarations: [{ prop: 'font-stretch', value: '75% 125%' }], adjustFontFallback: 'Arial' })

export const metadata = {
  metadataBase: new URL(SITE),
  applicationName: 'Olexweb',
  manifest: '/site.webmanifest',
  formatDetection: { telephone: false },
}
export const viewport = { themeColor: '#0a0b0a', colorScheme: 'dark', width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={[manrope.variable, hubot.variable, mona.variable].join(' ')} data-time="day" style={{ backgroundColor: '#0a0b0a' }} suppressHydrationWarning>
      {/* the page scripts set classes here before React takes over (the opening, the About name animation); that is expected */}
      <body suppressHydrationWarning>{children}<LeadClicks /></body>
    </html>
  )
}
