/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['echarts', 'lucide-react'],
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  // Increase body size limit for large HAR file uploads (500MB)
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/middlewareClientMaxBodySize
  middlewareClientMaxBodySize: '500mb',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
};

export default nextConfig;
