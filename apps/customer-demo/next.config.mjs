/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'joola.com' },
      { protocol: 'https', hostname: '**.joola.com' },
    ],
  },
  experimental: {
    // Vapi Web SDK is browser-only; this keeps RSC from accidentally bundling it server-side.
    serverComponentsExternalPackages: ['@vapi-ai/web'],
  },
};

export default nextConfig;

