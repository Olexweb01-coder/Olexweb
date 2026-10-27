// Directory page views and lead clicks (anonymous counts only)
import { sameOrigin } from '@/lib/admin/auth'
import { countView } from '@/lib/site/directory'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return new Response(null, { status: 204 })
  const b = await request.json().catch(() => null); if (b && typeof b.slug === 'string') await countView(b.slug, b.lead === true).catch(() => {})
  return new Response(null, { status: 204 })
}
