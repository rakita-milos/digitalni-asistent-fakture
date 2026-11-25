# Play Store listing — English (optional, second language)

> Verzija 1.0 · 25. 11. 2026. · Prati: `PLAY_RELEASE.md` §3–§5. Default listing language is
> Bosnian; this file is the English variant (useful for wider region and for reviewers).
> Before publishing: replace `<...>` and confirm every claim is true for the current build
> (mock fiscalization, PRAČUN, no card payments).

## App name (≤ 30)

Digitalni Asistent

## Short description (≤ 80)

Invoices, quotes and payments for craftsmen and micro-businesses — fast, offline-friendly.

## Full description (≤ 4000)

> Digitalni Asistent is an invoicing and receivables app built for craftsmen and small
> businesses in Bosnia and Herzegovina.
>
> **Issue an invoice in under 30 seconds.** Pick a customer, add line items, quantity, price,
> VAT and discount — totals are calculated automatically.
>
> **Quote (PRAČUN) and invoice.** Create a quote and convert it to an invoice with one tap.
>
> **Payments and receivables.** Record full or partial payments and see who owes you and how
> much, with an aging overview.
>
> **Reminders.** Send SMS reminders for due invoices; customers can opt out at any time.
>
> **Reports.** Receivables by due date and a monthly report for your records.
>
> **Works offline.** Create an invoice without a connection; drafts sync when you are back online.
>
> **Your data.** Export and account deletion are available in the app and on the web; fiscal
> documents are retained as required by law.
>
> **Important:** during the pilot, fiscalization runs in **test (mock) mode** — documents are
> issued as **PRAČUN / quote** and are **not fiscal invoices**. Real fiscalization (ESIR) is
> enabled after operator certification.
>
> The app is intended for business users (18+).

## Category and contact

- **Category:** Business
- **Contact email:** `<support@domain>`
- **Website:** `<https://domain>`
- **Privacy policy:** `<https://domain>/privacy`
- **Terms:** `<https://domain>/terms`

## Graphics checklist

| Asset | Requirement | Status |
|---|---|---|
| App icon | 512×512, 32-bit PNG | placeholder in `apps/mobile/assets/branding/` |
| Feature graphic | 1024×500, 24-bit PNG/JPEG | placeholder |
| Phone screenshots | 4–8, 320–3840 px, ≤ 2:1 | 5 in `apps/mobile/assets/screenshots/` |
| Tablet screenshots | optional | — |

Run `pnpm check:play` before upload; it fails on wrong dimensions, ratio > 2:1 or alpha in
screenshots/feature graphic.

## Data Safety (English summary)

| Category | Collected | Shared | Purpose |
|---|---|---|---|
| Personal info — name, email, phone, address | yes | no | account, invoices, communication |
| Financial info — invoices, payments | yes | no | app functionality; retained by law |
| Device info — push token, model/version | yes | no | notifications, diagnostics |
| Diagnostics — crash logs | yes (Sentry, when enabled) | no | stability; no PII in tags |
| Location | no | — | — |
| Contacts | no | — | phone numbers typed manually |
| Photos/camera | no | — | — |

- Data encrypted in transit: **yes** (TLS).
- Data deletion: available in app/web; personal data is anonymized, fiscal documents are
  retained as required by law.
- No ads, no tracking.

## Content rating answers (English)

- Business app; no user-generated public content; no gambling, alcohol, violence or sexual content.
- Target audience: 18+ (business users).
- Required links: privacy policy and terms must be live before review.

## What's new (first release)

> First pilot release: invoices and quotes, VAT calculation, PDF with QR, payments, reminders,
> reports, offline drafts, biometric unlock (device-dependent), account settings.

## Pre-upload checklist (English listing)

- [ ] Replace `<support@domain>`, `<https://domain>` and privacy/terms URLs with live values
- [ ] Confirm icon/feature graphic are final (not placeholders)
- [ ] Confirm screenshots show the current build and no real customer data
- [ ] Keep the mock-fiscalization statement — it is a legal/trust requirement, not marketing
- [ ] Re-run `pnpm check:play`
