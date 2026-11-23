import { expect, test } from '@playwright/test';

/**
 * Javne pravne stranice (T13-4): moraju raditi bez prijave jer ih Play listing i korisnici
 * otvaraju direktno. Provjerava i link sa prijave.
 */
test.describe('Pravne stranice', () => {
  test('politika privatnosti je javna i ima verziju', async ({ page }) => {
    const response = await page.goto('/privacy');

    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'Politika privatnosti' })).toBeVisible();
    await expect(page.getByText('Verzija 1.0 · 23.11.2026.')).toBeVisible();
    await expect(page.getByTestId('legal-disclaimer')).toContainText('Radna verzija');
    await expect(page.getByRole('heading', { name: '4. Dijeljenje i podprocesori' })).toBeVisible();
  });

  test('uslovi korištenja su javni i navode PRAČUN', async ({ page }) => {
    const response = await page.goto('/terms');

    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'Uslovi korištenja' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '6. Fiskalizacija' })).toBeVisible();
    await expect(page.getByText(/PRAČUN/)).toBeVisible();
  });

  test('link sa prijave vodi na politiku privatnosti', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Politika privatnosti' }).click();

    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Politika privatnosti' })).toBeVisible();
  });
});
