// IndexNow key (search engines check it to trust our "new page" announcements)
import { indexNowKey } from '@/lib/site/directory'
export const dynamic = 'force-dynamic'
export async function GET() { return new Response(indexNowKey(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }) }
