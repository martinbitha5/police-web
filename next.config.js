/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
  async headers() {
    return [
      {
        // Pages/HTML & données RSC : jamais mises en cache par le CDN, afin
        // qu'elles référencent toujours les chunks JS du build en cours
        // (sinon le CDN sert un vieux HTML → chunks 404 → exception client).
        // Les assets statiques (/_next/static, immuables) restent exclus.
        source: '/:path((?!_next/static|_next/image|favicon\\.ico).*)',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
    ];
  },
};

module.exports = nextConfig;
