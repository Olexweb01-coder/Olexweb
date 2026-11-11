// olexweb.com/tools/graceville-fast-bible: the private app's page. Anyone can read it; only people Olaitan approves
// can download (lib/site/apps.js). A fixed route, so it wins over the Directory's /tools/[slug].
import FastBible from '@/components/site/FastBible'
export const metadata = {
  title: 'Graceville Fast Bible: scripture on screen the moment it’s preached',
  description: 'Church presentation software custom-built for Graceville: speech to screen, every Bible verse in seconds, songs, media and stage display. For Graceville members only.',
  alternates: { canonical: '/tools/graceville-fast-bible' },
  openGraph: { title: 'Graceville Fast Bible', description: 'Scripture on screen the moment it’s preached. Custom-built for Graceville by Olexweb.', url: '/tools/graceville-fast-bible', type: 'website' },
}
export default function Page() { return <FastBible /> }
