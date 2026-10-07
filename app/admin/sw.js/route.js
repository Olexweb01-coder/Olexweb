// The admin's notification helper (service worker). It only shows notifications and opens the admin when one is
// tapped. It never stores pages, so Refresh and "new version" keep working exactly as before.
const SW = `
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {} } catch { d = { body: e.data ? e.data.text() : '' } }
  const url = typeof d.url === 'string' && /^\\/admin(\\/|$|\\?)/.test(d.url) ? d.url : '/admin'
  e.waitUntil(self.registration.showNotification(d.title || 'Olex AI', { body: String(d.body || '').slice(0, 180), icon: '/icon.png', badge: '/icon.png', tag: d.tag || 'olex', renotify: true, data: { url } }))
})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const target = new URL((e.notification.data && e.notification.data.url) || '/admin', self.location.origin).href
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.startsWith(self.location.origin + '/admin') && 'focus' in c) { if ('navigate' in c) c.navigate(target).catch(() => {}); return c.focus() }
    return self.clients.openWindow(target)
  }))
})
`
export const dynamic = 'force-static'
export function GET() {
  return new Response(SW, { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Service-Worker-Allowed': '/admin/', 'Cache-Control': 'no-cache' } })
}
