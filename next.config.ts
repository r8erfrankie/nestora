import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Production optimizations for Vercel / similar platforms.
  // Vercel automatically optimizes the build; no special output needed unless using Docker.
  // Ensure environment variables are set in the platform dashboard (not committed).
  // Dev uses --webpack in package.json script for stability; production build is standard.
};

export default nextConfig;
