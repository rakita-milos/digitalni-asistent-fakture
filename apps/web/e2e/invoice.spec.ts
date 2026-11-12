import { expect, test } from '@playwright/test';

import { login } from './helpers';

test.describe('W-04/W-05 faktura: draft → izdavanje → PDF', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('kreira draft, izdaje (mock) i preuzima PDF', async ({ page }) => {
    await page.goto('/invoices/new');

    await page.getByTestId('invoice-customer').selectOption({ index: 1 });
    await page.getByTestId('line-0-item').selectOption({ index: 1 });
    await page.getByTestId('line-0-qty').fill('2');
    await page.getByTestId('save-draft').click();

    await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId('issue-invoice')).toBeVisible();

    await page.getByTestId('issue-invoice').click();
    await expect(page.getByRole('heading', { name: 'Fiskalizacija' })).toBeVisible();
    await expect(page.getByText('PFR', { exact: true })).toBeVisible();

    const pdfLink = page.getByTestId('pdf-link');
    const href = await pdfLink.getAttribute('href');
    expect(href).toBeTruthy();

    const response = await page.request.get(href as string);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/pdf');

    const body = await response.body();
    expect(body.subarray(0, 4).toString()).toBe('%PDF');
  });

  test('lista faktura prikazuje kreirane fakture', async ({ page }) => {
    await page.goto('/invoices');

    await expect(page.getByRole('heading', { name: 'Fakture' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nova faktura' })).toBeVisible();

    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);
  });
});
