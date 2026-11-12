import type { Page } from '@playwright/test';

/** Demo nalog iz `prisma/seed.js` (§12). */
export const DEMO_EMAIL = 'demo@digitalni-asistent.ba';
export const DEMO_PASSWORD = 'DemoLozinka123';

export async function login(
  page: Page,
  options: { email?: string; password?: string } = {},
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email ili telefon').fill(options.email ?? DEMO_EMAIL);
  await page.getByLabel('Lozinka', { exact: true }).fill(options.password ?? DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Prijavi se' }).click();
  await page.waitForURL((url) => url.pathname === '/');
}
