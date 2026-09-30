import { Manrope } from 'next/font/google'
import './globals.css'
import './studio.css'
import { site, person } from '@/content/site'

const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-manrope', display: 'swap' })

export const metadata = {
  metadataBase: new URL(site.domain),
  title: { default: 'Olexweb — Digital experiences that matter', template: '%s — Olexweb' },
  description: site.description,
  keywords: ['Olexweb', 'Olaitan Adebayo', 'Adebayo Olaitan', 'web developer', 'frontend developer', 'creative developer', 'web design', 'digital experiences', 'Next.js developer', '3D websites', 'Nigeria'],
  openGraph: { type: 'website', siteName: 'Olexweb', title: 'Olexweb — Digital experiences that matter', description: site.description, url: site.domain, images: [{ url: '/studio/pano.jpg', width: 4096, height: 2730, alt: 'The Olexweb studio' }] },
  twitter: { card: 'summary_large_image', title: 'Olexweb', description: site.description, images: ['/studio/pano.jpg'] },
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': site.domain + '/#org', name: 'Olexweb', url: site.domain, logo: site.domain + '/studio/logo.png', email: site.email, telephone: site.phone, founder: { '@id': site.domain + '/#person' }, description: site.description },
    { '@type': 'Person', '@id': site.domain + '/#person', name: person.name, alternateName: person.alternateNames, url: site.domain + '/olaitan', image: site.domain + person.photos[0], jobTitle: 'Creative ideator and web developer', worksFor: { '@id': site.domain + '/#org' }, knowsAbout: ['Web development', 'Frontend engineering', 'UI/UX', 'Digital products', 'SEO', 'Creative thinking'] },
    { '@type': 'WebSite', '@id': site.domain + '/#website', url: site.domain, name: 'Olexweb', publisher: { '@id': site.domain + '/#org' } },
  ],
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={manrope.variable} data-time="day">
      <head><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /></head>
      <body>{children}</body>
    </html>
  )
}
