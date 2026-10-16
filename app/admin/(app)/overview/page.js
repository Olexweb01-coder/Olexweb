import { requireUser } from '@/lib/admin/auth'
import Overview from '@/components/admin/Overview'
export const metadata = { title: 'Overview' }
export default async function OverviewPage() { return <Overview u={await requireUser()} /> }
