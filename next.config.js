/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  // the old About address keeps working and passes its search ranking to /about
  async redirects() { return [{ source: '/olaitan', destination: '/about', permanent: true }]; },
};
module.exports = nextConfig;
