import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Monorepo: trace izlaz iz korijena repoa, ne iz apps/web.
  outputFileTracingRoot: path.join(projectRoot, '../..'),
};

export default nextConfig;
