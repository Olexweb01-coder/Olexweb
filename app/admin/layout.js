// The admin app: its own styles, never indexed, installable on phones.
import './admin.css'
import './olex.css'
export const metadata = {
  title: { default: 'Olex AI', template: '%s | Olex AI' },
  robots: { index: false, follow: false, nocache: true },
  manifest: '/admin/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Olex AI', statusBarStyle: 'black-translucent' },
}
export default function AdminLayout({ children }) { return children }
