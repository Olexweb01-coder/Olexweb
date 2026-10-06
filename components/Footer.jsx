import Link from 'next/link'
import { site } from '@/content/site'
export default function Footer() {
  return (
    <footer className="footer">
      <span>© {new Date().getFullYear()} Olexweb. Built by <Link href="/about">Olaitan Adebayo</Link>.</span>
      <span><a href={'mailto:' + site.email}>{site.email}</a> · <a href={'tel:' + site.phone}>{site.phoneDisplay}</a> · <a href={site.whatsapp} target="_blank" rel="noopener">WhatsApp</a> · <a href="https://contra.com/olexweb01" target="_blank" rel="noopener">Hire on Contra</a></span>
    </footer>
  )
}
