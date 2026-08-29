import type {NextConfig} from 'next';

const rawBasePath = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || '/max';
const basePath = rawBasePath && rawBasePath !== '/' ? (rawBasePath.startsWith('/') ? rawBasePath.replace(/\/$/, '') : `/${rawBasePath.replace(/\/$/, '')}`) : undefined;

const nextConfig: NextConfig = {
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  logging: {
    incomingRequests: false,
    fetches: {
      fullUrl: false,
    },
  },
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  output: 'standalone',
  serverExternalPackages: ['openai'],
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
