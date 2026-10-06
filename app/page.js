import V2Html from '@/components/V2Html'
import html from '@/v2/pages/home'
import { pageMetadata } from '@/lib/seo'
export const metadata = pageMetadata('home')
export default function Home() { return <V2Html html={html} /> }
