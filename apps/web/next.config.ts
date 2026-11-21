import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Sentry je Node-only paket (koristi node:https); ne bundle-uj ga u server build.
  serverExternalPackages: ['@sentry/node'],
  // Monorepo: trace izlaz iz korijena repoa, ne iz apps/web.
  outputFileTracingRoot: path.join(projectRoot, '../..'),
};

export default nextConfig;
