// Lets the admin install as its own app (Android: Install app; iPhone: Add to Home Screen).
export const dynamic = 'force-static'
export function GET() {
  return Response.json({
    name: 'Olexweb Admin', short_name: 'Olexweb', start_url: '/admin', scope: '/admin', display: 'standalone',
    background_color: '#0a0b0a', theme_color: '#0a0b0a',
    icons: [{ src: '/v2/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/v2/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }],
  }, { headers: { 'Content-Type': 'application/manifest+json' } })
}
