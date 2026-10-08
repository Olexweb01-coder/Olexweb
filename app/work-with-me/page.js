import V2Html from '@/components/V2Html'
import raw from '@/v2/pages/work-with-me'
import { pageMetadata } from '@/lib/seo'
export const metadata = pageMetadata('workWithMe')
// One more contact option, in the page's own style, next to Email: the project form (WhatsApp stays exactly as it is).
const FORM = '<a href="/start?from=/work-with-me"><small>Project form</small><b>Send your project details</b></a> '
const html = raw.replace(/(<div class="ways rv">\s*)/, '$1' + FORM)          // whatever the spacing; if the row ever moved, the page simply shows as before
export default function Page() { return <V2Html html={html} /> }
