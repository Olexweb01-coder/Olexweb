import V2Shell from '@/components/V2Shell'
import V2Html from '@/components/V2Html'
import JsonLd from '@/components/JsonLd'
import body from '@/v2/legal/terms'
import { pageMetadata, pageJsonLd } from '@/lib/seo'
export const metadata = pageMetadata('terms')
export default function Page() {
  return (<V2Shell kind="legal"><JsonLd data={pageJsonLd('terms')} /><div className="legal"><V2Html html={body} /><p className="legal-back"><a href="/">Back to Olexweb</a></p></div></V2Shell>)
}
