import { requireUser } from '@/lib/admin/auth'
export const metadata = { title: 'Reviews' }
export default async function Reviews() {
  await requireUser()
  return (<><div className="top"><h1 className="d">Reviews</h1></div><div className="empty">Your review link and approvals arrive in Phase 3.</div></>)
}
