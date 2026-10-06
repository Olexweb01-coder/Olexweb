import V2Html from '@/components/V2Html'
import html from '@/v2/pages/work-with-me'
import { pageMetadata } from '@/lib/seo'
export const metadata = pageMetadata('workWithMe')
export default function Page() { return <V2Html html={html} /> }
