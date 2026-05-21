/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@joola/types', '@joola/ui'],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
