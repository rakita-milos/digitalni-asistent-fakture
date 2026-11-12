import { defineConfig, devices } from '@playwright/test';

/**
 * Web e2e (§12): tok izdavanja/štampe i auth tok.
 * Zahtijeva Postgres + Redis (docker compose) i build (`pnpm build`).
 * Pokretanje: pnpm --filter web test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter api start',
      url: 'http://127.0.0.1:3001/health',
      cwd: '../..',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        RATE_LIMIT_ENABLED: 'false',
        MAIL_PROVIDER: 'log',
        SMS_PROVIDER: 'log',
      },
    },
    {
      command: 'pnpm --filter web start',
      url: 'http://127.0.0.1:3000/login',
      cwd: '../..',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
