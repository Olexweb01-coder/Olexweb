import { requireUser } from '@/lib/admin/auth'
export const metadata = { title: 'Assistant' }
export default async function Assistant() {
  await requireUser()
  return (<><div className="top"><h1 className="d">Assistant</h1></div><div className="empty">The assistant arrives in Phase 5, once projects, the blog and reviews are in place.</div></>)
}
