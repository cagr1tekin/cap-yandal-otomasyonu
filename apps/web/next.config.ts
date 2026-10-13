import type { NextConfig } from 'next';

const dev = process.env.NODE_ENV !== 'production';

/**
 * İçerik güvenlik politikası (docs/GUVENLIK.md). Next.js kendi satır içi betiklerini kullandığı için
 * script-src 'unsafe-inline' gerekir; başka kökenden betik, nesne ve çerçeve yüklenmez.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

const config: NextConfig = {
  transpilePackages: ['@cap/contracts', '@cap/rules'],
  poweredByHeader: false,
  // Belge yükleme sunucu eylemiyle yapılır; API'nin sabit üst sınırı 20 MB.
  experimental: { serverActions: { bodySizeLimit: '21mb' } },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default config;
