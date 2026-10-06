import V2Html from '@/components/V2Html'
import html from '@/v2/pages/ventures'
import { pageMetadata } from '@/lib/seo'
export const metadata = pageMetadata('ventures')
export default function Ventures() { return <V2Html html={html} /> }
