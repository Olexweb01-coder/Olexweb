import { notFound } from 'next/navigation'
import V2Html from '@/components/V2Html'
import elvanex from '@/v2/pages/venture-elvanex'
import needar from '@/v2/pages/venture-needar'
import aviirel from '@/v2/pages/venture-aviirel'
import { pageMetadata } from '@/lib/seo'
const PAGES = { elvanex, needar, aviirel }
export const dynamicParams = false
export function generateStaticParams() { return Object.keys(PAGES).map((slug) => ({ slug })) }
export function generateMetadata({ params }) { return PAGES[params.slug] ? pageMetadata(params.slug) : {} }
export default function Venture({ params }) { const html = PAGES[params.slug]; if (!html) notFound(); return <V2Html html={html} /> }
