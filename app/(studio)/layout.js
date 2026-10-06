// The studio (second version): olexweb.com/studio and the pages its objects open.
// Its styles stay here so they never touch the new site. Its inner pages are not indexed
// (the new site's pages cover the same content); /studio itself is indexed (see studio/page.js).
import '../globals.css'
import '../studio.css'
import JsonLd from '@/components/JsonLd'
import { siteGraph } from '@/lib/seo'

export const metadata = {
  title: { default: 'The 3D studio — Olexweb', template: '%s — Olexweb' },
  robots: { index: false, follow: true },
}

export default function StudioLayout({ children }) {
  return (<><JsonLd data={siteGraph()} />{children}</>)
}
