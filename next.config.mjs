import path from 'path';
import pkg from './package.json' with { type: 'json' };

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.STATIC_EXPORT === 'true' ? { output: 'export' } : {}),
  serverExternalPackages: ['better-sqlite3', 'playwright-core'],
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version },
  images: { unoptimized: true },
  trailingSlash: true,
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};
export default nextConfig;
