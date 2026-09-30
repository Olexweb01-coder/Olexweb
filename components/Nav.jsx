import Link from 'next/link'
export default function Nav() {
  return (
    <header className="nav">
      <Link href="/" className="brand"><img src="/studio/mark.png" alt="" width="26" height="30" />Olexweb</Link>
      <nav aria-label="Site">
        <Link href="/">Studio</Link>
        <Link href="/olexweb">Olexweb</Link>
        <Link href="/work">Work</Link>
        <Link href="/events">Events</Link>
        <Link href="/teaching">Teaching</Link>
        <Link href="/vision">Vision</Link>
        <Link href="/insights">Insights</Link>
        <Link href="/olaitan" className="who">Olaitan</Link>
        <Link href="/ventures">Ventures</Link>
        <Link href="/lab">Lab</Link>
        <Link href="/thinking">Thinking</Link>
        <Link href="/contact">Contact</Link>
      </nav>
    </header>
  )
}
