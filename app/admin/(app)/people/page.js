import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { q } from '@/lib/admin/db'
import PeopleBoard from '@/components/admin/People'
export const metadata = { title: 'People' }
export default async function People() {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  const people = (await q("select id, name, email, role, perms from admin_users where role in ('owner', 'editor') and disabled_at is null order by role desc, created_at")).rows
  const invites = (await q('select email, expires_at from invites where used_at is null and expires_at > now() order by created_at desc')).rows
  return <PeopleBoard people={people} invites={invites.map((i) => ({ ...i, expires_at: i.expires_at.toISOString() }))} />
}
