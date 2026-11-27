import { expect, test } from '@playwright/test';

/** Osnovni sigurnosni headeri na javnim stranicama (Play/security hardening). */
test('javne stranice nose sigurnosne headere', async ({ request }) => {
  const response = await request.get('/privacy');

  expect(response.ok()).toBe(true);
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['x-frame-options']).toBe('DENY');
  expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(response.headers()['permissions-policy']).toContain('camera=()');
});
