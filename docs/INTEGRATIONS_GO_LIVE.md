# Go-live integracija — copy-paste runbook (T12-4/5/6/7/8)

> Za sve što traži nalog: **Sentry DSN**, **R2**, **SMS provajder**, **staging**, **restore**.
> Redoslijed je zavisnosni: Sentry/R2 su 30 min, SMS zavisi od ugovora, staging od naloga.
> Poslije svake stavke upiši dokaz u tabelu na kraju i u `PROGRESS.md`.

## 0. Zajedničko

- Env za lokalno: `apps/api/.env` (API/worker) i `apps/web/.env.local` (web). Za staging: env panel
  platforme (Railway/Fly/Vercel) — **nikad** u repo.
- Poslije promjene env-a restartuj API i worker; provjeri `curl -s localhost:3001/health | jq`.
- Tajne rotiraj tako što prvo dodaš novu, provjeriš, pa ukloniš staru (nema downtime-a).
- `APP_RELEASE` uvijek = commit SHA (`git rev-parse --short HEAD`).

## 1. Sentry (T12-4) — ~20 min

1. Kreiraj projekat **Node.js** (API + worker) i po želji drugi **Next.js** (web); ili jedan projekat
   sa `SENTRY_ENVIRONMENT` tagom.
2. Kopiraj DSN (`https://<key>@<org>.ingest.sentry.io/<project>`).
3. Postavi env (API, worker, web):

```dotenv
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
SENTRY_ENVIRONMENT=staging
SENTRY_TRACES_SAMPLE_RATE=0.05
APP_RELEASE=<commit-sha>
```

4. Provjeri API slanje (jednokratna komanda u `apps/api`):

```bash
node -e "const S=require('@sentry/node');S.init({dsn:process.env.SENTRY_DSN,environment:process.env.SENTRY_ENVIRONMENT,release:process.env.APP_RELEASE});S.captureException(new Error('SENTRY_TEST_API'));S.flush(3000).then(()=>console.log('poslano'))"
```

5. Provjeri web: podigni `pnpm --filter web start` sa DSN-om i izazovi serversku grešku (npr. privremeno
   baci `throw new Error('SENTRY_TEST_WEB')` u server action); u Sentry-ju event mora imati tag
   `request_id`.
6. Alarmi (Sentry → Alerts): 5xx stopa > 1 % (5 min), p95 > 2 s, `FISCAL_ALARM` (PENDING_FISCAL > 3 dana),
   worker bez heartbeat-a, queue backlog > 100, SMS greške.
7. Dokaz: link na event + screenshot alarma.

**Rollback:** obriši `SENTRY_DSN` i restart — sve je no-op (isti kod).

## 2. R2 (T12-5) — ~30 min

1. Cloudflare → R2 → **Create bucket** `digitalni-asistent` (region automatic).
2. **Manage R2 API Tokens** → Object Read & Write, scope na bucket; zapamti `Access Key ID` i
   `Secret Access Key` + `Account ID` (ili endpoint `https://<account>.r2.cloudflarestorage.com`).
3. Lifecycle rule: prefix `pdf/`, brisanje poslije 90 dana (PDF je content-addressed, regeneriše se).
4. Env (API/worker):

```dotenv
R2_ACCOUNT_ID=<account-id>
R2_ACCESS_KEY_ID=<key>
R2_SECRET_ACCESS_KEY=<secret>
R2_BUCKET=digitalni-asistent
R2_SIGNED_URL_TTL_SECONDS=900
```

5. Provjeri:

```bash
TOKEN=$(curl -s -X POST localhost:3001/auth/login -H 'content-type: application/json' \
  -d '{"identifier":"demo@digitalni-asistent.ba","password":"DemoLozinka123"}' | jq -r .accessToken)
ID=$(curl -s localhost:3001/invoices?limit=1 -H "authorization: Bearer $TOKEN" | jq -r '.items[0].id')
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "localhost:3001/invoices/$ID/pdf" -H "authorization: Bearer $TOKEN"
# očekivano: 302 https://<account>.r2.cloudflarestorage.com/...?X-Amz-Signature=...&X-Amz-Expires=900
curl -s -o /tmp/f.pdf -w '%{http_code}\n' "<location-iz-prethodnog-koraka>"; head -c4 /tmp/f.pdf   # 200 %PDF
```

6. Istek: privremeno `R2_SIGNED_URL_TTL_SECONDS=60`, otvori link poslije 2 min → R2 vraća 403.
7. Fallback: ukloni `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`, restart → PDF se streamuje (200, bez
   `Location`).
8. Dokaz: 302 + `X-Amz-Expires`, uspješan download, 403 poslije TTL-a.

**Rollback:** ukloni R2 env i restart — streaming režim.

## 3. SMS provajder (T12-6) — ~1 h (bez ugovora)

1. Izaberi provajdera (2–3 ponude): cijena po poruci, **sender ID** (alpha ili numerički), API tip
   (JSON POST), podrška za dostavu/status, opt-out.
2. Dobij: endpoint, token/API key, sender ID. Ako API nije `{to,message,sender}` + Bearer, potreban je
   mali adapter (novi `SMS_PROVIDER`, ~30 linija) — javi format pa se dodaje.
3. Env:

```dotenv
SMS_PROVIDER=http
SMS_HTTP_URL=https://api.provajder.ba/v1/sms
SMS_HTTP_TOKEN=<token>
SMS_SENDER_ID=<sender-id>
SMS_HTTP_TIMEOUT_MS=5000
```

4. Provjeri na 2 broja: OTP (`POST /auth/otp/request`) i ručni podsjetnik (`POST /invoices/:id/remind`);
   potvrdi da poruka stigne, da je sender ID ispravan i da opt-out kupac dobija 409.
5. Trošak: pogledaj panel provajdera poslije 2–3 poruke; upiši cijenu po poruci u `PROGRESS.md`.
6. Dokaz: screenshot telefona (2 broja) + panel potrošnje.

**Rollback:** `SMS_PROVIDER=log` (staging) ili `FEATURE_SMS_ENABLED=false` (rute vraćaju 503 sa porukom).

## 4. Staging (T12-7) — ~2 h

1. **Neon** (Postgres): projekat `digitalni-asistent-staging`, kopiraj pooled `DATABASE_URL`
   (`?sslmode=require`).
2. **Upstash** (Redis): baza `staging`, TLS URL `rediss://…`.
3. **API + worker** (Railway/Fly): isti repo, dva servisa — `pnpm --filter api start` i
   `pnpm --filter api worker`; env iz `docs/STAGING_DEPLOY.md` (JWT, CORS, R2, Sentry, SMS, `APP_RELEASE`).
4. **Migracije**: u CI job-u prije deploy-a `pnpm --filter api exec prisma migrate deploy`; ili ručno
   jednom, pa provjeri `prisma migrate status`.
5. **Web** (Vercel): root `apps/web`, env `NEXT_PUBLIC_API_URL`, `PUBLIC_API_URL`, `SENTRY_DSN`,
   cookie domeni.
6. **Seed**: `pnpm --filter api db:seed` na staging bazi (demo firma, 50 faktura) — samo staging.
7. Smoke: prijava demo nalogom → lista faktura → izdavanje → PDF (302) → naplata → podsjetnik (SMS) →
   `/health` 200 → `prisma migrate status` up to date.
8. Dokaz: staging URL + smoke tabela.

**Rollback:** redeploy prethodne verzije (Railway/Fly/Vercel „Rollback“); baza ostaje (migracije su aditivne).

## 5. Backup i restore drill (T12-8) — ~30 min

1. Neon: uključi **PITR** (7 dana) + dnevni `pg_dump -Fc` u R2 (`backups/<datum>.dump`), cron na
   platformi ili GitHub Actions scheduled job.
2. Drill (staging): napravi Neon branch iz PITR tačke, vrati dump, provjeri brojeve:

```bash
pg_restore --clean --if-exists -d "$RESTORE_URL" backup.dump
psql "$RESTORE_URL" -c "select (select count(*) from invoices) invoices, (select count(*) from customers) customers, (select count(*) from items) items;"
```

3. Acceptance: restore **< 30 min**, brojevi identični (50 faktura / 20 kupaca / 10 artikala),
   aplikacija radi na restore bazi.
4. Dokaz: vrijeme restore-a + brojevi u `PROGRESS.md`.

## 6. Evidencija (upisati u PROGRESS.md i `docs/G12_EVIDENCE_PACK.md`)

| Stavka | Provajder/nalog | Datum | Dokaz | Status |
|---|---|---|---|---|
| Sentry DSN + alarmi | | | event link | |
| R2 bucket + TTL | | | 302/403 | |
| SMS sender + 2 broja | | | screenshot | |
| Staging smoke | | | URL | |
| Restore drill | | | < 30 min | |
