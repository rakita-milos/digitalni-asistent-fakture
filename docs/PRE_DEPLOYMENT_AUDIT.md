# Audit po Pre-Deployment Checklist — Sprint 11 (S11-1) + osvježenje Sprint 12B

> Verzija **1.2** · **23. 11. 2026.** · Osnova: `Pre-Deployment_Checklist.docx` (**31 stavka**),
> `PROGRESS.md`, `PLAN_DALJEG_RADA_v3.md`. Pravilo: **bez dokaza nema čekiranja** —
> svaka stavka ima fajl/test/komandu ili je izričito označena kao blokirana spolja.
> Zavisnosti: rezultati `pnpm audit` i P2 plan su u [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md)
> (T13-5, 23. 11. 2026: produkcija **0 high/critical**, 8 nalaza).

## 0. Kako je rađeno

- Pregledan je kod, testovi i dokumentacija; pokrenute su sve lokalne provjere: `lint` 5/5,
  `typecheck` 5/5, `build` 3/3, **343 testa**, Playwright **e2e 12/12**, `pnpm audit`.
- U prvom prolazu (13. 11.) lokalni Docker nije bio dostupan; u ovom prolazu je bio, pa su
  baza/Redis, API i web podignuti lokalno i sve provjere su ponovljene uživo.
- Nalazi su podijeljeni na: ✅ dokazano, ⚠️ djelimično/blokirano spolja, ❌ rupa.

## 1. Rezime

| Status | Broj |
|---|---|
| ✅ dokazano | 24 |
| ⚠️ djelimično / čeka nalog ili okruženje | 7 |
| ❌ rupa u kodu | 0 |

**Novo u Sprintu 12B (23. 11.):**

1. **E7 (dio) — javne pravne stranice:** `/privacy` i `/terms` implementirane u webu
   (`apps/web/app/(legal)/`, tekst u `lib/legal.ts`), linkovi na prijavi, u aplikaciji i na
   mobilnom ekranu Nalog; 8 unit + 3 e2e testa. **Objava na domenu** i dalje čeka pravnika.
2. **Play AAB pipeline:** novi CI job `android-release` (`bundleRelease`, artifact
   `digitalni-asistent-aab`), verzija **1.0.0 (1)**; bez keystore-a potpisuje debug ključem.
3. **Smoke:** `tools/staging-smoke.mjs` (`pnpm smoke:staging`) — 8 provjera, lokalno 8/8 za 1,0 s.
4. **Play materijal:** 5 screenshotova + provjera `tools/check-play-assets.mjs` (`pnpm check:play`)
   u CI-ju; feature graphic pretvoren u 24-bit PNG.
5. **CI:** 5/5 zelen (verify, compose, android, integracije, e2e); Play provjera dodata u `verify`.

**Popravljeno u prvom prolazu (S11-1, 13. 11.):** B4 health readiness, B3 `x-request-id`,
A6 rate limit za izdavanje/slanje, E3 TTL cap 15 min, E6 offline retry, C2 EXPLAIN + indeks,
A6 unit testovi limitera, S11-7 `setup_completed`, release signing config + placeholder brend.

## 2. Checklist po sekcijama

### A. Sigurnost i pristup

| # | Stavka | Dokaz | Status |
|---|---|---|---|
| A1 | Autorizacija/IDOR: svaki endpoint provjerava `companyId`, ne samo prijavu | IDOR testovi: `test/invoices.e2e-spec.ts:287`, `test/sprint1.e2e-spec.ts:295`, `test/fiscal.e2e-spec.ts:219,263,329`, `test/invoice-send.e2e-spec.ts:245`, `test/sprint4.e2e-spec.ts:179`, `test/sprint5.e2e-spec.ts:225`, `test/sync.e2e-spec.ts:178`; servisi uvijek `findFirst({ where: { id, companyId } })` | ✅ |
| A2 | Reset lozinke: token 30 min, jednokratan, hashiran, novi zahtjev briše stari | `src/modules/auth/password-reset.service.ts:13-49` (SHA-256, Redis TTL, `GETDEL`), `test/auth-reset.e2e-spec.ts` (5 testova) | ✅ |
| A3 | Zod validacija svih ulaza + Prisma (bez sirovog SQL-a) | `src/common/pipes/zod-validation.pipe.ts`; svaka ruta ima Zod pipe; `$queryRaw` postoji samo u `health.controller.ts` (`SELECT 1`) — nema dinamičkog SQL-a | ✅ |
| A4 | XSS: izlaz escape-uje React/Next, bez `dangerouslySetInnerHTML` | `grep dangerouslySetInnerHTML apps/web` → 0 pogodaka; jedini HTML je statični šablon e-maila | ✅ |
| A5 | CORS: samo poznati origin-i, nikad `*` | `src/main.ts:17-25` — `env.CORS_ORIGIN.split(',')`, `origin: false` ako je prazno | ✅ |
| A6 | Rate limit: login 5/min, OTP 3/5min, registracija 3/h, izdavanje 30/min, SMS 10/min | `src/modules/auth/auth.controller.ts:55-111` (register 3/h, login 5/min, OTP 3/5min, reset); `src/modules/invoices/invoices.controller.ts` — **novo**: `invoice-issue` 30/min, `invoice-send` 10/min; `public-invoices.controller.ts:42` 30/min; **novo**: `rate-limit.guard.spec.ts` (6 testova: 429, fail-closed 503 u produkciji, fail-open u razvoju) | ✅ |
| A7 | Tajne samo u env, nikad u repou | `git ls-files` vraća samo `.env.example`, `apps/api/.env.example` i `debug.keystore` (standardni RN debug); `.env`, `.env.*`, `*.keystore` u `.gitignore` | ✅ |
| A8 | JWT: access 15 min, refresh 30 dana, rotacija, revokacija po uređaju | `src/config/env.ts:35-36` (15m/30d), `src/modules/auth/auth.service.ts:177-185,320,333,398` (hash refresh-a po uređaju, rotacija, revokacija na logout/reset), `test/auth-logout.e2e-spec.ts` | ✅ |

### B. Greške i pouzdanost

| # | Stavka | Dokaz | Status |
|---|---|---|---|
| B1 | Globalni error filter: `{code,message}`, bez stack trace i SQL detalja | `src/common/filters/all-exceptions.filter.ts:40-128`; `all-exceptions.filter.spec.ts`; 5xx vraća generičku poruku | ✅ |
| B2 | Korisničke poruke na bosanskom, tehnički detalji u logu | `DEFAULT_MESSAGES` u filteru; poruke u servisima; stack ide samo u `logger.error` + Sentry | ✅ |
| B3 | Korelacijski ID u svakom odgovoru i logu | **novo**: `src/common/middleware/request-id.middleware.ts` + `app.module.ts` (middleware na sve rute); filter koristi isti ID za log/Sentry; `request-id.middleware.spec.ts` (3 testa) | ✅ |
| B4 | `/health` provjerava bazu i Redis | **novo**: `src/modules/health/health.controller.ts` — `SELECT 1` + `PING`, 503 kada padne; `health.controller.spec.ts` (4 testa, uključujući retry za `ioredis` konekciju — S11-8), `test/health.e2e-spec.ts` provjerava `checks` | ✅ |

### C. Baza podataka

| # | Stavka | Dokaz | Status |
|---|---|---|---|
| C1 | Indeksi na toplim upitima | `prisma/schema.prisma`: `@@unique([companyId, type, number])` (258), `@@index([companyId, status])` (259), `@@index([companyId, dueDate])` (260), `@@index([customerId])` (261), `@@index([invoiceId])` na zavisnim tabelama | ✅ |
| C2 | EXPLAIN za listu faktura i aging — nema seq scan | **Izvršeno 2026-11-13** nad lokalnom Postgres 16: `pnpm --filter api db:explain` (40 firmi × 500 faktura). Prije indeksa: `Seq Scan on invoices` (20 ms) za listu i aging. Dodat indeks `invoices_company_id_created_at_idx` (migracija `20261113180000`); poslije: `Index Scan Backward` (0,07 ms), `Bitmap Index Scan` na `(company_id,status)` (0,7 ms), `Index Scan` na `(company_id,due_date)` (0,1 ms) — **0 Seq Scan**. Skripta pada sa exit 1 ako se seq scan vrati | ✅ |
| C3 | Migracije backward-compatible (expand/contract), testirane na kopiji | **7 migracija** (stanje 2026-11-13), sve aditivne: `ADD COLUMN ... DEFAULT` (`customers.reminder_opt_out`, `companies.setup_completed_at`) i novi indeksi (`invoices_company_id_created_at_idx`); `prisma validate` prolazi, `migrate deploy` primijenjen lokalno na Postgres 16; rollback procedura u `docs/STAGING_DEPLOY.md` | ✅ (kod) |
| C4 | Backup radi + **testiran restore** | Procedura: `docs/STAGING_DEPLOY.md` (dnevni dump u R2, restore drill sa SQL provjerama); stvarni restore čeka staging naloge | ⚠️ |

### D. Deploy i rollback

| # | Stavka | Dokaz | Status |
|---|---|---|---|
| D1 | Staging identičan produkciji | `docs/STAGING_DEPLOY.md` (arhitektura, env po servisu); staging još nije podignut | ⚠️ |
| D2 | Rollback plan (web instant, prethodni API, testiran flip) | `docs/STAGING_DEPLOY.md` — tabela rollback po komponenti | ✅ (dokument) |
| D3 | Feature flag za fiskalizaciju i SMS | `src/config/env.ts:66-68`; `invoices.service.ts` 503 kada je flag isključen; `test/fiscal.e2e-spec.ts`; web/mobilni prikazuju poruku | ✅ |
| D4 | Migracije prije aplikacije, uz backup | `docs/STAGING_DEPLOY.md` (redoslijed deploya) i `ci.yml` (`migrate deploy` prije testova) | ✅ |

### E. Specifično za proizvod

| # | Stavka | Dokaz | Status |
|---|---|---|---|
| E1 | Fiskalni zapisi nepromjenjivi: VOID/REFUND kao novi dokumenti, original ostaje | `invoices.service.ts` `cancel`/`refund`; `test/sprint5.e2e-spec.ts`; VOID/REFUND imaju svoj broj i kopiju stavki | ✅ |
| E2 | Audit log za izdavanje, poništenje i naplatu | `auditLog.create` u `invoices.service.ts:309,356,473,559,658`, `payments.service.ts:68`; provjere u `test/fiscal.e2e-spec.ts:121`, `test/invoice-send.e2e-spec.ts:146`, `test/account-gdpr.e2e-spec.ts:211` | ✅ |
| E3 | R2 signed URL TTL ≤ 15 min; PDF se ne servira javno | `storage/r2-storage.service.ts:68-78` (TTL iz config-a), `config/env.ts` — **novo**: max 900 s; `pdf-link.ts` (HMAC link ≤ 15 min); `r2-storage.service.spec.ts` | ✅ |
| E4 | SMS: opt-out poštovan, sender ID registrovan, šablon sadrži broj i iznos | Opt-out: migracija + `reminders.service.ts:77`, `reminder.worker.ts:89`, `test/reminders-optout.e2e-spec.ts` (3 testa); šablon: `reminder-template.ts`; **sender ID čeka provajdera** | ⚠️ |
| E5 | Idempotency-Key na POST (fakture, naplata) | `common/interceptors/idempotency.interceptor.ts`; `test/idempotency.e2e-spec.ts` | ✅ |
| E6 | Offline queue: max retry, backoff, alarm na 3 dana | Server: `worker/fiscal-alarm.ts` (3 dana, dnevni dedupe) + `fiscal-alarm.spec.ts`, retry backoff `fiscal-backoff.ts`. **Mobilni (novo)**: `sync/retry.ts` — backoff 1m/5m/15m/1h/6h, max 5 pokušaja, alarm poslije 3 dana; `syncEngine.ts` čuva `attempts`/`nextAttemptAt` u `sync_queue` (SQLite mini-migracija u `db/localDb.ts`), `InvoicesScreen` prikazuje upozorenje i dugme „Pokušaj ponovo“; `retry.test.ts` (9 testova) | ✅ |
| E7 | GDPR: izvoz i brisanje rade; politika privatnosti i ToS objavljeni | Kod: `account.service.ts`, `test/account-gdpr.e2e-spec.ts` (5 testova). **Novo (S12B):** javne stranice `/privacy` i `/terms` (`apps/web/app/(legal)/`, `lib/legal.ts`), linkovi na prijavi i u aplikaciji; `lib/legal.test.ts` (8) + `e2e/legal.spec.ts` (3). **Objava na domenu čeka pravnika** | ⚠️ |
| E8 | Play Data Safety form popunjen tačno | Odgovori pripremljeni: `docs/PLAY_RELEASE.md` §4; **forma se popunjava u Play Console** (nema naloga) | ⚠️ |

### F. Završna provjera

| # | Stavka | Dokaz | Status |
|---|---|---|---|
| F1 | Smoke test na produkciji | **Novo (S12B):** `tools/staging-smoke.mjs` (`pnpm smoke:staging`) — 8 provjera (health, prijava, kupci, fakture, detalj, PDF, draft, izdavanje + PFR), lokalno **8/8 za 1,0 s**; procedura u `docs/STAGING_DEPLOY.md` §8. Produkcija još ne postoji | ⚠️ |
| F2 | Monitoring i alarmi aktivni | `common/monitoring/monitoring.service.ts` (Sentry no-op bez DSN-a), 5xx hook u filteru, `FISCAL_ALARM` u workeru; **alarmi čekaju Sentry DSN** | ⚠️ |
| F3 | Podrška spremna: kontakt, FAQ, odgovor na „ne radi fiskalizacija“ | `docs/INCIDENT_RUNBOOK.md` (scenariji i komunikacija) + `docs/PILOT_KIT.md` (support kanal, onboarding) | ✅ (dokument) |

## 3. Nalazi i preporuke

1. **Sve lokalne provjere su izvršene 23. 11.:** `lint` 5/5, `typecheck` 5/5, `build` 3/3,
   **343 testa** (shared 51, api 168, web 25, mobile 99), Playwright **e2e 12/12** (14,6 s),
   smoke **8/8**, `pnpm audit --prod` 0 high/critical. CI je zelen **5/5**.
2. **Rate limiter** je pokriven unit testovima i e2e testom na stvarnom Redis-u; ostaje provjera
   na stagingu sa stvarnim IP-jevima i `RATE_LIMIT_ENABLED=true` (T13-5).
3. **SMS sender ID i provajder (E4)** — čim se izabere provajder, upisati sender ID i potvrditi
   da šablon prolazi pravila provajdera (T12-6).
4. **Offline retry (E6)** je zatvoren; ako pilot pokaže česte `FAILED` stavke, dodati lokalnu
   notifikaciju (native) umjesto samo in-app upozorenja.
5. **Play AAB (T13-2):** pipeline postoji (`android-release`), ali AAB za Play mora biti potpisan
   **release** ključem — do keystore-a job potpisuje debug ključem i služi samo kao dokaz pipeline-a.
6. **Pravne stranice (E7):** kod i testovi su gotovi; prije G13 treba popuniti `<...>` podatke firme,
   potvrditi tekst kod pravnika i objaviti na stabilnom domenu (isti URL ide u Play listing).

## 4. Kako ponoviti provjere (dokazi)

```bash
# bez baze
pnpm lint
pnpm typecheck
pnpm --filter api exec prisma validate
docker compose -f infra/docker-compose.yml config --quiet

# sa bazom i Redis-om (CI ili lokalni compose)
pnpm db:up
pnpm db:deploy
pnpm test
pnpm --filter web test:e2e

# smoke protiv staginga (ili lokalno: STAGING_API_URL=http://127.0.0.1:3001)
STAGING_API_URL=https://api-staging.<domen> SMOKE_EMAIL=… SMOKE_PASSWORD=… pnpm smoke:staging

# Play materijal (dimenzije, odnos, providnost) — isto što radi CI
pnpm check:play

# EXPLAIN provjera (pravi 40×500 dijagnostičkih faktura, čisti ih na kraju)
pnpm --filter api db:explain

# EXPLAIN (staging, kopija baze)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, number, status, total_fening, paid_fening, due_date
FROM invoices
WHERE company_id = '<company-uuid>'
ORDER BY created_at DESC
LIMIT 20;

EXPLAIN (ANALYZE, BUFFERS)
SELECT status, COUNT(*), SUM(total_fening - paid_fening)
FROM invoices
WHERE company_id = '<company-uuid>'
  AND status IN ('ISSUED','SENT','PARTIALLY_PAID','OVERDUE')
GROUP BY status;

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, due_date, total_fening - paid_fening
FROM invoices
WHERE company_id = '<company-uuid>'
  AND status IN ('ISSUED','SENT','PARTIALLY_PAID','OVERDUE')
  AND due_date < now()
ORDER BY due_date
LIMIT 20;
```

**Acceptance za C2:** nijedan plan nema `Seq Scan` na `invoices` za gornje upite; ako ima,
dodati indeks kroz novu migraciju.

## 5. Potpis

| Verzija | Datum | Ko je provjerio | Napomena |
|---|---|---|---|
| 1.1 | 2026-11-13 | agent (S11-1, drugi prolaz) | 21 ✅ / 10 ⚠️ / 0 ❌; 278 testova + e2e 8/8 + EXPLAIN izvršeni lokalno |
| 1.2 | 2026-11-23 | agent (Sprint 12B) | **24 ✅ / 7 ⚠️ / 0 ❌** (31 stavka); 343 testa, e2e 12/12, smoke 8/8, audit 0 high/critical; pravne stranice, AAB job, Play screenshotovi |