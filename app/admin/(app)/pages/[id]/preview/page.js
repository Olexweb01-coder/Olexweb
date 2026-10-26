// Full-size preview of a page as saved (draft or live), owner only. Sign-up is disabled here.
import { redirect, notFound } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { getPage } from '@/lib/site/pages'
import PageView from '@/components/PageView'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Preview', robots: { index: false } }
export default async function Page({ params }) {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  const p = await getPage(params.id).catch(() => null); if (!p) notFound()
  return (<div style={{ position: 'fixed', inset: 0, zIndex: 100, overflow: 'auto', background: '#f2efe9' }}>
    <div style={{ position: 'sticky', top: 0, zIndex: 5, padding: '8px 14px', background: '#0a0b0a', color: '#f2efe9', font: '700 13px var(--font-mona),system-ui', display: 'flex', justifyContent: 'space-between' }}>
      <span>Preview · {p.status === 'live' ? 'live at' : 'draft for'} olexweb.com/{p.slug}</span><a href={'/admin/pages/' + p.id} style={{ color: '#8fe36a' }}>Back to editing</a></div>
    <PageView page={JSON.parse(JSON.stringify({ id: p.id, type: p.type, goal: p.goal, stage: 'open', content: p.content }))} preview />
  </div>)
}
