/** @type {import('next').NextConfig} */
// Meet app address rules (see redirects and rewrites below). A meeting code: letters only, no i, l or o.
const MEET_HOST = { type: 'host', value: 'meet\\..+' }
const MAIN_ORIGIN = (process.env.MAIN_ORIGIN || 'https://olexweb.com').replace(/\/$/, '')
const CODE = '[a-hj-km-np-z]{3}-[a-hj-km-np-z]{4}-[a-hj-km-np-z]{3}'
const MEET_KEEP = ['meet(?:/|$)', 'api/', '_next/', 'sw\\.js$', 'manifest\\.webmanifest$', 'favicon\\.ico$', 'robots\\.txt$', 'sitemap\\.xml$', 'apple-touch-icon\\.png$', CODE + '$'].join('|')
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  // native (compiled) packages are loaded on the server as they are, not bundled
  experimental: { serverComponentsExternalPackages: ['@node-rs/argon2', 'pg', 'sharp'] },
  // pdf.js (reading PDFs in the admin) mentions a Node-only package it never uses in the browser
  webpack: (config) => { config.resolve.alias = { ...(config.resolve.alias || {}), canvas: false }; return config },
  // the old About address keeps working and passes its search ranking to /about
  // meet.olexweb.com (the Meet app): only Meet's pages live there; anything else goes to the main site
  async redirects() { return [{ source: '/olaitan', destination: '/about', permanent: true },
    { source: `/:path((?!${MEET_KEEP}).+)`, has: [MEET_HOST], destination: `${MAIN_ORIGIN}/:path`, permanent: false }]; },
  // on meet.olexweb.com: / is Meet's home, /abc-defg-hij is a meeting, and the app's own manifest, worker and icons
  async rewrites() { return { beforeFiles: [
    { source: '/', has: [MEET_HOST], destination: '/meet' },
    { source: `/:code(${CODE})`, has: [MEET_HOST], destination: '/meet/:code' },
    { source: '/manifest.webmanifest', has: [MEET_HOST], destination: '/meet/app.webmanifest' },
    { source: '/sw.js', has: [MEET_HOST], destination: '/meet/sw.js' },
    { source: '/favicon.ico', has: [MEET_HOST], destination: '/meet/favicon-32.png' },
    { source: '/apple-touch-icon.png', has: [MEET_HOST], destination: '/meet/apple-touch-icon.png' },
    { source: '/robots.txt', has: [MEET_HOST], destination: '/api/meet/seo/robots' },   // the Meet address's own search instructions
    { source: '/sitemap.xml', has: [MEET_HOST], destination: '/api/meet/seo/sitemap' },
  ] }; },
};
module.exports = nextConfig;
