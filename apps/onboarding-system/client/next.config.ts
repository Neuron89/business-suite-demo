import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@onb/shared'],
  devIndicators: false,
};

export default nextConfig;
