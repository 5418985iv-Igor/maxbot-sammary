import type {NextConfig} from 'next';

function getBasePath(): string | undefined {
  const raw = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || '/max';
  const cleaned = raw.replace(/^["']+|["']+$/g, '').trim();
  if (!cleaned || cleaned === '/') {
    // If empty quotes were passed, keep existing required default '/max'
    return '/max';
  }
  return cleaned.startsWith('/') ? cleaned.replace(/\/+$/, '') : `/${cleaned.replace(/\/+$/, '')}`;
}

const basePath = getBasePath();

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
  async redirects() {
    if (basePath && basePath !== '/') {
      return [
        {
          source: '/',
          destination: basePath,
          basePath: false,
          permanent: false,
        },
        {
          source: '/api/:path*',
          destination: `${basePath}/api/:path*`,
          basePath: false,
          permanent: false,
        },
        {
          source: '/webhook/:path*',
          destination: `${basePath}/webhook/:path*`,
          basePath: false,
          permanent: false,
        },
      ];
    }
    return [];
  },
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
