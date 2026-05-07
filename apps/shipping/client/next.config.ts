import type { NextConfig } from 'next';

const API_TARGET = process.env.API_PROXY_TARGET || 'http://localhost:4030';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@shipping/shared'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_TARGET}/api/:path*` }];
  },
};

export default config;
