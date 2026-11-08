// olexweb.com/updates/<slug>: one Directory post (Install 16)
import { postMeta, postPage } from '../../_dir/kindPages'
export const revalidate = 3600
export const dynamicParams = true
export async function generateStaticParams() { return [] }
export const generateMetadata = postMeta('update')
export default postPage('update')
