/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  // native (compiled) packages are loaded on the server as they are, not bundled
  experimental: { serverComponentsExternalPackages: ['@node-rs/argon2', 'pg', 'sharp'] },
  // the old About address keeps working and passes its search ranking to /about
  async redirects() { return [{ source: '/olaitan', destination: '/about', permanent: true }]; },
};
module.exports = nextConfig;
