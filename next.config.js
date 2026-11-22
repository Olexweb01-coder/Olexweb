/** @type {import('next').NextConfig} */
// Meet app address rules (see redirects and rewrites below). A meeting code: letters only, no i, l or o.
const MEET_HOST = { type: 'host', value: 'meet\\..+' }
const MAIN_ORIGIN = (process.env.MAIN_ORIGIN || 'https://olexweb.com').replace(/\/$/, '')
const CODE = '[a-hj-km-np-z]{3}-[a-hj-km-np-z]{4}-[a-hj-km-np-z]{3}'
// Install D: personal rooms (meet.olexweb.com/<profile name>), never the main site's own top-level pages
const ROOM = '(?!(?:about|aoc|cookies|doc|guides|insights|me|media|olex-ai|olex-runner|portfolio|preview|privacy|review|services|start|stories|terms|tools|updates|ventures|work-with-me|alerts|studio|blog|admin|api|meet|book|mentors|feed\\.xml|robots\\.txt|sitemap\\.xml)$)[a-z0-9][a-z0-9-]{1,28}[a-z0-9]'
const MEET_KEEP = ['meet(?:/|$)', 'api/', '_next/', 'sw\\.js$', 'manifest\\.webmanifest$', 'favicon\\.ico$', 'robots\\.txt$', 'sitemap\\.xml$', 'apple-touch-icon\\.png$', 'book$', 'mentors$', 'v/', 'l/', CODE + '$', ROOM + '$'].join('|')
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  // native (compiled) packages are loaded on the server as they are, not bundled
  serverExternalPackages: ['@node-rs/argon2', 'pg', 'sharp'],   // Next 15: moved out of experimental
  outputFileTracingIncludes: { '/api/li-card/[id]': ['./lib/fonts/**'], '/api/meet/flyer/[code]': ['./lib/fonts/**'], '/api/meet/cert': ['./lib/fonts/**'], '/api/meet/card': ['./lib/fonts/**', './public/meet/logo-96.png'] },   // Install 44: the LinkedIn pictures' font
  // pdf.js (reading PDFs in the admin) mentions a Node-only package it never uses in the browser
  webpack: (config) => { config.resolve.alias = { ...(config.resolve.alias || {}), canvas: false }; return config },
  // Meet's protection: no other site can frame it (stops click-tricks), browsers don't guess file types, always HTTPS,
  // and camera, microphone and screen sharing only for Meet itself
  async headers() {
    const SAFE = [{ key: 'X-Frame-Options', value: 'DENY' }, { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }, { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), display-capture=(self), geolocation=()' }]
    return [{ source: '/:path*', has: [MEET_HOST], headers: SAFE }, { source: '/meet', headers: SAFE }, { source: '/meet/:path*', headers: SAFE }, { source: '/api/meet/:path*', headers: SAFE }]
  },
  // the old About address keeps working and passes its search ranking to /about
  // meet.olexweb.com (the Meet app): only Meet's pages live there; anything else goes to the main site
  async redirects() { return [{ source: '/olaitan', destination: '/about', permanent: true },
    { source: `/:path((?!${MEET_KEEP}).+)`, has: [MEET_HOST], destination: `${MAIN_ORIGIN}/:path`, permanent: false }]; },
  // on meet.olexweb.com: / is Meet's home, /abc-defg-hij is a meeting, and the app's own manifest, worker and icons
  async rewrites() { return { beforeFiles: [
    { source: '/', has: [MEET_HOST], destination: '/meet' },
    { source: `/:code(${CODE})`, has: [MEET_HOST], destination: '/meet/:code' },
    { source: '/book', has: [MEET_HOST], destination: '/meet/book' },
    { source: '/mentors', has: [MEET_HOST], destination: '/meet/mentors' },           // Install 58: Find a mentor
    { source: '/v/:serial', has: [MEET_HOST], destination: '/meet/v/:serial' },       // Install 58: certificate check
    { source: '/l/:slug', has: [MEET_HOST], destination: '/meet/l/:slug' },           // Install 58: tracked links
    { source: `/:handle(${ROOM})`, has: [MEET_HOST], destination: '/meet/r/:handle' },   // Install D: personal rooms          // "Book a call with Olaitan" (Olex Sales)
    { source: '/manifest.webmanifest', has: [MEET_HOST], destination: '/meet/app.webmanifest' },
    { source: '/sw.js', has: [MEET_HOST], destination: '/meet/sw.js' },
    { source: '/favicon.ico', has: [MEET_HOST], destination: '/meet/favicon-32.png' },
    { source: '/apple-touch-icon.png', has: [MEET_HOST], destination: '/meet/apple-touch-icon.png' },
    { source: '/robots.txt', has: [MEET_HOST], destination: '/api/meet/seo/robots' },   // the Meet address's own search instructions
    { source: '/sitemap.xml', has: [MEET_HOST], destination: '/api/meet/seo/sitemap' },
  ], afterFiles: [
    // Install 30: optional PostHog analytics go through the site itself (components/site/Analytics.jsx)
    { source: '/ingest/:path*', destination: `${(process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/$/, '')}/:path*` },
  ] }; },
};
module.exports = nextConfig;
