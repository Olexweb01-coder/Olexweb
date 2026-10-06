import V2Shell from '@/components/V2Shell'
export const metadata = { title: 'Page not found | Olexweb', robots: { index: false, follow: true } }
export default function NotFound() {
  return (<V2Shell kind="legal"><div className="legal"><h1>That page doesn't exist.</h1>
    <p>It may have moved, or the link may be mistyped.</p>
    <p className="legal-back"><a href="/">Go to the homepage</a> &nbsp;·&nbsp; <a href="/studio">Enter the 3D studio</a></p></div></V2Shell>)
}
