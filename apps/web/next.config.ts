import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@cap/contracts', '@cap/rules'],
  poweredByHeader: false,
  // Belge yükleme sunucu eylemiyle yapılır; API sınırı 5 MB.
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default config;
