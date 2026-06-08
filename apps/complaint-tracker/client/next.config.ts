import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@complaint/shared'],
  devIndicators: false,
};

export default nextConfig;
