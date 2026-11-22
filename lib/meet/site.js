// The Meet website's pages (Install 58g): which address we are on, and each page's canonical link.
// On meet.olexweb.com the pages live at /features, /pricing…; on the main address at /meet/features… (that address
// sends people on to meet.olexweb.com when it is set up, so search engines see one copy of each page).
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { meetBase, meetHost, mainOrigin } from '@/lib/site/meet'

export function siteBase(path = '/') {
  const mh = meetHost(), here = String(headers().get('x-forwarded-host') || headers().get('host') || '')
  if (mh && here !== mh) redirect(meetBase() + path)
  return mh ? '' : '/meet'
}
export const siteUrl = (path) => (meetBase() || mainOrigin() + '/meet') + path
export function pageMeta(path, title, description) {
  const url = siteUrl(path), image = (meetBase() ? meetBase() : mainOrigin()) + '/meet/og.png?v=2'
  return { title: { absolute: title + ' | Olexweb Meet' }, description, alternates: { canonical: url }, robots: { index: true, follow: true },
    openGraph: { type: 'website', url, siteName: 'Olexweb Meet', title, description, images: [{ url: image, width: 1200, height: 630, alt: 'Olexweb Meet' }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] } }
}
