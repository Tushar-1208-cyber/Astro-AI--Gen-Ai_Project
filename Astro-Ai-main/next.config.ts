import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['chromadb', 'genkitx-chromadb'],
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
