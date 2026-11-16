import { expect, test } from '@playwright/test';

import { login } from './helpers';

/**
 * S11-8 — katalog artikala u podešavanjima: dodavanje, izmjena cijene, arhiviranje.
 * Provjerava web sekciju „Artikli“ (PATCH /items/:id nije u §6 — vidi PROGRESS, odluka 24).
 */
test.describe('Podešavanja → Artikli (S11-8)', () => {
  test('dodaje artikal, mijenja cijenu i arhivira ga', async ({ page }) => {
    await login(page);
    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: 'Artikli' })).toBeVisible();

    // Jedinstven naziv da test ne zavisi od demo seed-a i može se ponavljati.
    const itemName = `E2E artikal ${Date.now()}`;

    await page.locator('#item-new-name').fill(itemName);
    await page.locator('#item-new-unit').fill('kom');
    await page.locator('#item-new-price').fill('12,50');
    await page.locator('#item-new-tax').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Dodaj artikal' }).click();

    await expect(page.getByText('Artikal je dodan u katalog.')).toBeVisible();

    // Naziv je u <input value>, pa karticu tražimo preko polja, ne preko teksta.
    const card = page
      .locator('form')
      .filter({ has: page.locator(`input[name="name"][value="${itemName}"]`) });
    await expect(card).toBeVisible();

    // Izmjena cijene u mjestu (PATCH /items/:id).
    await card.getByLabel('Cijena (KM)').fill('20,00');
    await card.getByRole('button', { name: 'Sačuvaj' }).click();
    await expect(page.getByText('Artikal je sačuvan.')).toBeVisible();
    await expect(card.getByLabel('Cijena (KM)')).toHaveValue('20,00');

    // Arhiviranje — kartica nestaje iz kataloga (poruka je u kartici koja se uklanja,
    // pa se provjerava krajnje stanje liste).
    await card.getByRole('button', { name: 'Arhiviraj' }).click();
    await expect(card).toHaveCount(0);
  });
});
