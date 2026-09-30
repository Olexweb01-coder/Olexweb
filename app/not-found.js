import Page from '@/components/Page'
import Link from 'next/link'
export default function NotFound() { return (<Page><h1>That room doesn't exist.</h1><p><Link className="btn" href="/">Back to the studio</Link></p></Page>) }
