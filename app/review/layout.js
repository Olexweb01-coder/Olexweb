// Clients' review pages: private links, never indexed, same look as the admin.
import '../admin/admin.css'
export const metadata = { title: 'Review Olexweb', robots: { index: false, follow: false } }
export default function ReviewLayout({ children }) { return children }
