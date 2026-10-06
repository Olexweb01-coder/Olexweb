// The admin app: its own styles, never indexed, installable on phones.
import './admin.css'
export const metadata = {
  title: { default: 'Olexweb Admin', template: '%s | Olexweb Admin' },
  robots: { index: false, follow: false, nocache: true },
  manifest: '/admin/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Olexweb', statusBarStyle: 'black-translucent' },
}
export default function AdminLayout({ children }) { return children }
