import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const baseConfig: NextConfig = {
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    config.resolve.fallback = { ...config.resolve.fallback, canvas: false };
    return config;
  },
};

const nextConfig =
  process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'
    ? withSentryConfig(baseConfig, {
        org: 'kortix-ai',
        project: 'suna-nextjs',
        silent: !process.env.CI,
        widenClientFileUpload: true,
        tunnelRoute: '/monitoring',
        disableLogger: true,
        automaticVercelMonitors: true,
      })
    : baseConfig;

export default nextConfig;
