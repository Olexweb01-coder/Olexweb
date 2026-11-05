// meet.olexweb.com/book: "Book a call with Olaitan" (Olex Sales). Not for search engines.
import BookCall from '@/components/meet/BookCall'
export const metadata = { title: 'Book a call with Olaitan | Olexweb', description: 'Pick a time for a 30-minute call with Olaitan Adebayo of Olexweb.', robots: { index: false, follow: false } }
export default function Page({ searchParams }) { return <BookCall token={String((searchParams && searchParams.t) || '').slice(0, 80)} /> }
