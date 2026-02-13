import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@mindscape/shared'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    } else {
      config.externals = [...(config.externals || []), 'canvas'];
    }
    return config;
  },
};

export default nextConfig;
