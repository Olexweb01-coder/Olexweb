import Nav from './Nav'
import Footer from './Footer'
export default function Page({ children, wide }) {
  return (<div className="page"><Nav /><main className={'wrap' + (wide ? ' wide' : '')}>{children}</main><Footer /></div>)
}
