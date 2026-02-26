/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Mode standalone pour Docker
  output: 'standalone',

  // Modules natifs à exclure du bundling
  serverExternalPackages: ['better-sqlite3'],

  // Headers CORS pour le réseau local
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },
};

export default nextConfig;
