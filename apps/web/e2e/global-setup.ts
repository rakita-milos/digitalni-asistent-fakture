import { execSync } from 'node:child_process';
import path from 'node:path';

/**
 * Priprema baze za e2e: migracije + svježi demo seed.
 * Preskoči sa E2E_SKIP_DB_SETUP=1 kada je baza već pripremljena.
 */
export default function globalSetup(): void {
  if (process.env.E2E_SKIP_DB_SETUP === '1') {
    return;
  }

  const repoRoot = path.resolve(process.cwd(), '../..');

  console.log('E2E: prisma migrate deploy…');
  execSync('pnpm --filter api exec prisma migrate deploy', {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });

  console.log('E2E: demo seed (SEED_RESET=1)…');
  execSync('pnpm db:seed', {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, SEED_RESET: '1' },
  });
}
