import { expect, test } from '@playwright/test';

import { DEMO_EMAIL, login } from './helpers';

test.describe('W-01 prijava i reset lozinke', () => {
  test('prijava demo korisnikom prikazuje početnu', async ({ page }) => {
    await login(page);

    await expect(page.getByRole('heading', { name: 'Demo Firma d.o.o.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Fakture' })).toBeVisible();
  });

  test('pogrešna lozinka prikazuje jasnu poruku', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email ili telefon').fill(DEMO_EMAIL);
    await page.getByLabel('Lozinka', { exact: true }).fill('pogresnaLozinka123');
    await page.getByRole('button', { name: 'Prijavi se' }).click();

    await expect(page.getByText('Neispravan email/telefon ili lozinka')).toBeVisible();
  });

  test('zaboravljena lozinka šalje generičku potvrdu', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByLabel('E-mail adresa naloga').fill(DEMO_EMAIL);
    await page.getByRole('button', { name: 'Pošalji link za reset' }).click();

    await expect(page.getByText(/poslali smo link za reset lozinke/i)).toBeVisible();
  });

  test('reset stranica odbija neispravan token', async ({ page }) => {
    await page.goto(`/reset-password?token=${'a'.repeat(43)}`);
    await page.getByLabel('Nova lozinka').fill('novaLozinka123');
    await page.getByLabel('Ponovite novu lozinku').fill('novaLozinka123');
    await page.getByRole('button', { name: 'Postavi novu lozinku' }).click();

    await expect(
      page.getByText(/Link za reset lozinke je istekao ili je već iskorišten/),
    ).toBeVisible();
  });
});
