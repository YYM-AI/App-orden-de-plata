import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const buildCommit =
  process.env.CLYMO_BUILD_COMMIT?.trim() ||
  execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const buildDirty = execFileSync('git', ['status', '--porcelain', '--', '.'], {
  encoding: 'utf8',
}).trim()
  ? 'yes'
  : 'no';
const config: NextConfig = {
  env: { CLYMO_BUILD_COMMIT: buildCommit, CLYMO_BUILD_DIRTY: buildDirty },
  reactStrictMode: true,
  devIndicators: false,
  turbopack: { root: fileURLToPath(new URL('.', import.meta.url)) },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          ...(process.env.APP_ORIGIN?.startsWith('https://')
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
            : []),
        ],
      },
    ];
  },
};
export default config;
