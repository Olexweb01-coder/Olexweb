import { requireUser, can, ownerOnly } from '@/lib/admin/auth'
import { q } from '@/lib/admin/db'
import { currentLink } from '@/lib/admin/reviews'
import ReviewsBoard from '@/components/admin/Reviews'
export const metadata = { title: 'Reviews' }
export default async function Reviews() {
  const u = await requireUser()
  const rows = (await q("select id, name, role, text, stars, source, status, created_at from testimonials where status in ('waiting', 'published') order by created_at desc limit 200")).rows
  return <ReviewsBoard items={rows.map((r) => ({ ...r, created_at: r.created_at.toISOString() }))} link={ownerOnly(u) ? await currentLink() : null}
    isOwner={ownerOnly(u)} canReviews={can(u, 'reviews')} canTestimonials={can(u, 'testimonials')} />
}
