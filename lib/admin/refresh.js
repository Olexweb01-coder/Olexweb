// After a change in the admin, the public pages that show it are refreshed straight away.
import 'server-only'
import { revalidatePath } from 'next/cache'
const PATHS = {
  project: [['/portfolio']],
  testimonial: [['/portfolio']],
  post: [['/insights'], ['/insights/[slug]', 'page'], ['/sitemap.xml']],
  venture: [['/ventures'], ['/ventures/[slug]', 'page'], ['/sitemap.xml']],
}
export function refreshSite(type) {
  for (const [p, kind] of PATHS[type] || []) {
    try { kind ? revalidatePath(p, kind) : revalidatePath(p) } catch (e) { console.error('could not refresh', p, e) }
  }
}
