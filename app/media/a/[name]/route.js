// Audio uploaded in Pages & links, streamed from the private bucket with byte ranges (seek, pause, resume on phones).
import { fileResponse } from '@/lib/site/pagefiles'
export const dynamic = 'force-dynamic'
export async function GET(request, { params }) { return fileResponse(params.name, request.headers.get('range')) }
