// Renders a block of the new site's server HTML (generated from the tested templates in v2/).
// display: contents keeps the wrapper out of the layout.
export default function V2Html({ html }) {
  return <div className="v2" style={{ display: 'contents' }} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />
}
