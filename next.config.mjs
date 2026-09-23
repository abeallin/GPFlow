import path from 'path';
import pkg from './package.json' with { type: 'json' };

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version },
  images: { unoptimized: true },
  trailingSlash: true,
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};
export default nextConfig;
