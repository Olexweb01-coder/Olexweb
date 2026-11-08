// olexweb.com/tools: the Olexweb Directory library
import DirLibrary from '@/components/DirLibrary'
import { liveEntries } from '@/lib/site/directory'
export const revalidate = 300
export const metadata = { title: 'The Olexweb Directory: useful tools, tech updates, how-tos and scam alerts', description: 'Useful websites and AI tools, tech updates that matter, how-tos and scam alerts for creators, students and small businesses. New every day, every fact checked.',
  alternates: { canonical: '/tools', types: { 'application/rss+xml': '/feed.xml' } }, openGraph: { title: 'The Olexweb Directory', description: 'Useful websites and AI tools, explained clearly and checked.', url: '/tools', type: 'website' } }
export default async function Page() { const entries = await liveEntries().catch(() => []); return <DirLibrary entries={JSON.parse(JSON.stringify(entries))} /> }
