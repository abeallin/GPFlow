const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  env: { NEXT_PUBLIC_APP_VERSION: require('./package.json').version },
  images: { unoptimized: true },
  trailingSlash: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
};
module.exports = nextConfig;
