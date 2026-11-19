// Install 39: which sidebar page a link belongs to (shared by the server and the sidebar)
//   /admin/automation/facebook → facebook · /admin/automation(/plan, /library) → automation · /admin/youtube → youtube · /admin → overview
export function sectionOf(url) {
  const u = String(url || '').split('?')[0]
  if (/^\/admin\/automation\/facebook/.test(u)) return 'facebook'
  const m = /^\/admin\/([a-z0-9-]+)/.exec(u)
  return m ? m[1] : 'overview'
}
