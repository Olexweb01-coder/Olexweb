import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/admin/auth'
import SignIn from '@/components/admin/SignIn'
export const metadata = { title: 'Sign in' }
export const dynamic = 'force-dynamic'
export default async function Login() {
  if (await currentUser()) redirect('/admin')
  return <SignIn />
}
