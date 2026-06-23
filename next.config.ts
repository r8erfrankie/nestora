import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
  // Production optimizations for Vercel / similar platforms.
  // Vercel automatically optimizes the build; no special output needed unless using Docker.
  // Ensure environment variables are set in the platform dashboard (not committed).
  // Dev uses --webpack in package.json script for stability; production build is standard.
};

export default nextConfig;
