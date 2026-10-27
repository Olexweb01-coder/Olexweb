// olexweb.com/tools: the Olexweb Directory library
import DirLibrary from '@/components/DirLibrary'
import { liveEntries } from '@/lib/site/directory'
export const revalidate = 300
export const metadata = { title: 'The Olexweb Directory: useful websites, AI and tech tools, explained', description: 'Clear, checked guides to useful websites and AI tools for creators, students, freelancers and small businesses: what they do, if they’re free, and how to start.',
  alternates: { canonical: '/tools' }, openGraph: { title: 'The Olexweb Directory', description: 'Useful websites and AI tools, explained clearly and checked.', url: '/tools', type: 'website' } }
export default async function Page() { const entries = await liveEntries().catch(() => []); return <DirLibrary entries={JSON.parse(JSON.stringify(entries))} /> }
