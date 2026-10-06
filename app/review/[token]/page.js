import { linkIsActive, formStamp } from '@/lib/admin/reviews'
import ReviewForm from '@/components/admin/ReviewForm'
export const dynamic = 'force-dynamic'
export default async function ReviewPage({ params }) {
  if (!(await linkIsActive(params.token))) return (
    <main className="auth"><div className="auth-box"><div className="auth-mark"><img src="/studio/mark.png" alt="" width="26" height="30" />Olexweb</div>
      <h1 className="d">This review link has ended.</h1><p className="lead">Ask Olaitan for a new link. Thank you for wanting to share your experience.</p>
      <p><a className="btn btn-line" href="/">Visit olexweb.com</a></p></div></main>)
  return <ReviewForm token={params.token} stamp={formStamp()} />
}
