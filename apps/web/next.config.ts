import type { NextConfig } from 'next';
const config: NextConfig = {
  reactStrictMode: true,
  cacheComponents: false,
  poweredByHeader: false,
  experimental: { cpus: 2 },
};
export default config;
