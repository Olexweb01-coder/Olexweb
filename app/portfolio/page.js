import V2Html from '@/components/V2Html'
import html from '@/v2/pages/portfolio'
import { pageMetadata } from '@/lib/seo'
export const metadata = pageMetadata('portfolio')
export default function Page() { return <V2Html html={html} /> }
