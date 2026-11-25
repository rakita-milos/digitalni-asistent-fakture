# Lokalna integraciona provjera (bez cloud naloga)

Skripte provjeravaju tri integracije koje inače traže naloge/kredencijale: **R2 signed URL**
(T12-5), **SMS http adapter** (T12-6) i **web Sentry instrumentaciju** (T12-4). Ne zamjenjuju
provjeru sa stvarnim provajderima — dokazuju da aplikacija radi svoj dio posla (302 + potpis,
tačan payload, slanje eventa), a ne ponašanje provajdera (isporuka SMS-a, TTL na R2, alarmi).

## 1. Priprema

```bash
pnpm --filter api build
pnpm --filter web build
pnpm db:up            # Postgres + Redis
pnpm db:seed          # demo nalog i 50 faktura
```

## 2. Pokreni lokalne servere (3 terminala)

```bash
node tools/local-integration/fake-s3.mjs       # :9010
node tools/local-integration/fake-sms.mjs      # :9011
node tools/local-integration/fake-sentry.mjs   # :9012
```

## 3. Pokreni API sa test konfiguracijom

Windows PowerShell (bash ekvivalent je isti, samo `export`):

```powershell
$env:R2_ENDPOINT='http://127.0.0.1:9010'
$env:R2_ACCESS_KEY_ID='fake-access'
$env:R2_SECRET_ACCESS_KEY='fake-secret'
$env:R2_BUCKET='digitalni-asistent'
$env:SMS_PROVIDER='http'
$env:SMS_HTTP_URL='http://127.0.0.1:9011/send'
$env:SMS_HTTP_TOKEN='test-token'
$env:SMS_SENDER_ID='DA'
node apps/api/dist/main.js
```

## 4. Provjeri

Sve odjednom (podiže mini servere i API, pa ih gasi):

```bash
pnpm test:integrations
```

Ili pojedinačno (uz već pokrenut API i servere):

```bash
node tools/local-integration/verify-integrations.mjs   # R2 + SMS (15 provjera)
node tools/local-integration/verify-sentry.mjs         # Sentry envelope (4 provjere)
```

Isti runner koristi CI job **`integracije (R2 / SMS / Sentry)`** (`.github/workflows/ci.yml`).

Logovi za dokaz: `fake-s3.log`, `fake-sms.log`, `fake-sentry.log`, `fake-sentry-raw.log`
(u ovom folderu, nisu u gitu).

## 5. Backup upload (T12-8) — lokalna provjera

Isti fake S3 može primiti i `pg_dump` upload (bez Cloudflare naloga):

```powershell
$env:R2_ENDPOINT='http://127.0.0.1:9010'
$env:R2_FORCE_PATH_STYLE='true'
$env:R2_ACCOUNT_ID='test'
$env:R2_ACCESS_KEY_ID='fake-access'
$env:R2_SECRET_ACCESS_KEY='fake-secret'
$env:R2_BUCKET='da-backups'
node tools/backup/backup-db.mjs --docker=digitalni-postgres --user=digitalni --db=digitalni_asistent --out=.tools/backups --upload --json
```

Provjereno 25. 11.: dump **54,8 KB** uploadovan na `da-backups/backups/db/…`, `GET` vraća 200 iste
veličine. Ovo dokazuje da upload kod radi; stvarni R2 (SSE, lifecycle, TTL potpisa) čeka ključeve.

## Šta se ne može ovako provjeriti

- **R2 TTL** — istek potpisa provjerava samo Cloudflare R2 (local S3 ne validira potpis).
- **SMS isporuka i cijena** — stvarni provajder, sender ID i opt-out.
- **Sentry alarmi** — projekat, alert rules i e-mail/Slack notifikacije.
