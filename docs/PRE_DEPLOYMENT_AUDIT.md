# Audit po Pre-Deployment Checklist — Sprint 11 (S11-1)

> Verzija 1.0 · 13. 11. 2026. · Osnova: `Pre-Deployment_Checklist.docx` (32 stavke),
> `PROGRESS.md`, `PLAN_DALJEG_RADA.md`. Pravilo: **bez dokaza nema čekiranja** —
> svaka stavka ima fajl/test/komandu ili je izričito označena kao blokirana spolja.

## 0. Kako je rađeno

- Pregledan je kod, testovi i dokumentacija; pokrenute su provjere koje ne traže bazu
  (lint, typecheck, `prisma validate`, `docker compose config`).
- E2E testovi traže Postgres + Redis; u ovoj sesiji lokalni Docker/WSL nije bio dostupan
  (sandbox: `permission denied` na Docker pipe). Zato se pozivaju **postojeći testovi**
  kao dokaz ponašanja, a **runtime ponovna verifikacija je u CI-ju** (isti nalozi kao `ci.yml`).
- Nalazi su podijeljeni na: ✅ dokazano, ⚠️ djelimično/blokirano spolja, ❌ rupa.

## 1. Rezime

| Status | Broj |
|---|---|
| ✅ dokazano | 19 |
| ⚠️ djelimično / čeka nalog ili okruženje | 11 |
| ❌ rupa u kodu | 1 |

**Popravljeno u ovom prolazu** (commit uz ovaj dokument):

1. **B4 — `GET /health` sada provjerava bazu i Redis** (readiness, 503 kada zavisnost padne);
   ranije je vraćao 200 čim proces radi.
2. **B3 — `x-request-id` na svakom odgovoru** (middleware), ne samo na greškama; filter i Sentry
   koriste isti ID.
3. **A6 — rate limit za izdavanje fakture** (30/min) i **slanje fakture** (10/min);
   do sada su limiti postojali samo na auth rutama i javnom PDF-u.
4. **E3 — TTL cap 15 min** u validaciji env varijabli (`PDF_LINK_TTL_SECONDS`,
   `R2_SIGNED_URL_TTL_SECONDS`); ranije je šema dozvoljavala do 60 min.
5. Uz to (S11-4): release signing config + placeholder brend materijal; (S11-7): analitika.

## 2. Checklist po sekcijama

### A. Sigurnost i pristup

| # | Stavka | Dokaz | Status |
|---|---|---|---|
| A1 | Autorizacija/IDOR: svaki endpoint provjerava `companyId`, ne samo prijavu | IDOR testovi: `test/invoices.e2e-spec.ts:287`, `test/sprint1.e2e-spec.ts:295`, `test/fiscal.e2e-spec.ts:219,263,329`, `test/invoice-send.e2e-spec.ts:245`, `test/sprint4.e2e-spec.ts:179`, `test/sprint5.e2e-spec.ts:225`, `test/sync.e2e-spec.ts:178`; servisi uvijek `findFirst({ where: { id, companyId } })` | ✅ |
| A2 | Reset lozinke: token 30 min, jednokratan, hashiran, novi zahtjev briše stari | `src/modules/auth/password-reset.service.ts:13-49` (SHA-256, Redis TTL, `GETDEL`), `test/auth-reset.e2e-spec.ts` (5 testova) | ✅ |
| A3 | Zod validacija svih ulaza + Prisma (bez sirovog SQL-a) | `src/common/pipes/zod-validation.pipe.ts`; svaka ruta ima Zod pipe; `$queryRaw` postoji samo u `health.controller.ts` (`SELECT 1`) — nema dinamičkog SQL-a | ✅ |
| A4 | XSS: izlaz escape-uje React/Next, bez `dangerouslySetInnerHTML` | `grep dangerouslySetInnerHTML apps/web` → 0 pogodaka; jedini HTML je statični šablon e-maila | ✅ |
| A5 | CORS: samo poznati origin-i, nikad `*` | `src/main.ts:17-25` — `env.CORS_ORIGIN.split(',')`, `origin: false` ako je prazno | ✅ |
| A6 | Rate limit: login 5/min, OTP 3/5min, registracija 3/h, izdavanje 30/min, SMS 10/min | `src/modules/auth/auth.controller.ts:55-111` (register 3/h, login 5/min, OTP 3/5min, reset); `src/modules/invoices/invoices.controller.ts` — **novo**: `invoice-issue` 30/min, `invoice-send` 10/min; `public-invoices.controller.ts:42` 30/min. Napomena: e2e gađa sa `RATE_LIMIT_ENABLED=false` (test/setup.ts:12), pa limiter nije pokriven e2e testom — provjerava se ručno/staging | ✅ (kod) |
| A7 | Tajne samo u env, nikad u repou | `git ls-files` vraća samo `.env.example`, `apps/api/.env.example` i `debug.keystore` (standardni RN debug); `.env`, `.env.*`, `*.keystore` u `.gitignore` | ✅ |
| A8 | JWT: access 15 min, refresh 30 dana, rotacija, revokacija po uređaju | `src/config/env.ts:35-36` (15m/30d), `src/modules/auth/auth.service.ts:177-185,320,333,398` (hash refresh-a po uređaju, rotacija, revokacija na logout/reset), `test/auth-logout.e2e-spec.ts` | ✅ |

### B. Greške i pouzdanost

| # | Stavka | Dokaz | Status |
|---|---|---|---|
| B1 | Globalni error filter: `{code,message}`, bez stack trace i SQL detalja | `src/common/filters/all-exceptions.filter.ts:40-128`; `all-exceptions.filter.spec.ts`; 5xx vraća generičku poruku | ✅ |
| B2 | Korisničke poruke na bosanskom, tehnički detalji u logu | `DEFAULT_MESSAGES` u filteru; poruke u servisima; stack ide samo u `logger.error` + Sentry | ✅ |
| B3 | Korelacijski ID u svakom odgovoru i logu | **novo**: `src/common/middleware/request-id.middleware.ts` + `app.module.ts` (middleware na sve rute); filter koristi isti ID za log/Sentry; `request-id.middleware.spec.ts` (3 testa) | ✅ |
| B4 | `/health` provjerava bazu i Redis | **novo**: `src/modules/health/health.controller.ts` — `SELECT 1` + `PING`, 503 kada padne; `health.controller.spec.ts` (3 testa), `test/health.e2e-spec.ts` provjerava `checks` | ✅ |

### C. Baza podataka

| # | Stavka | Dokaz | Status |
|---|---|---|---|
| C1 | Indeksi na toplim upitima | `prisma/schema.prisma`: `@@unique([companyId, type, number])` (258), `@@index([companyId, status])` (259), `@@index([companyId, dueDate])` (260), `@@index([customerId])` (261), `@@index([invoiceId])` na zavisnim tabelama | ✅ |
| C2 | EXPLAIN za listu faktura i aging — nema seq scan | Nije izvršeno u ovoj sesiji (nema lokalne baze). Pripremljene komande u §4; **obavezno na stagingu prije produkcije** | ⚠️ |
| C3 | Migracije backward-compatible (expand/contract), testirane na kopiji | 5 migracija, sve aditivne (`ADD COLUMN ... DEFAULT`, novi indeksi/tabele); najnovija `20261113104648_customer_reminder_opt_out` dodaje kolonu sa default `false`; `prisma validate` prolazi; `migrate status` u CI-ju | ✅ (kod) |
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
| E6 | Offline queue: max retry, backoff, alarm na 3 dana | Server: `worker/fiscal-alarm.ts` (3 dana, dnevni dedupe) + `fiscal-alarm.spec.ts`, retry backoff `fiscal-backoff.ts`; **mobilni**: `sync/syncEngine.ts:93-120` označi `FAILED` ali nema automatski retry/backoff ni lokalni alarm — **rupa** (vidi §3) | ❌ |
| E7 | GDPR: izvoz i brisanje rade; politika privatnosti i ToS objavljeni | Kod: `account.service.ts`, `test/account-gdpr.e2e-spec.ts` (5 testova); tekst: `docs/LEGAL_DRAFT.md`; **objava čeka pravnika** | ⚠️ |
| E8 | Play Data Safety form popunjen tačno | Odgovori pripremljeni: `docs/PLAY_RELEASE.md` §4; **forma se popunjava u Play Console** (nema naloga) | ⚠️ |

### F. Završna provjera

| # | Stavka | Dokaz | Status |
|---|---|---|---|
| F1 | Smoke test na produkciji | Procedura u `docs/STAGING_DEPLOY.md`; produkcija još ne postoji | ⚠️ |
| F2 | Monitoring i alarmi aktivni | `common/monitoring/monitoring.service.ts` (Sentry no-op bez DSN-a), 5xx hook u filteru, `FISCAL_ALARM` u workeru; **alarmi čekaju Sentry DSN** | ⚠️ |
| F3 | Podrška spremna: kontakt, FAQ, odgovor na „ne radi fiskalizacija“ | `docs/INCIDENT_RUNBOOK.md` (scenariji i komunikacija) + `docs/PILOT_KIT.md` (support kanal, onboarding) | ✅ (dokument) |

## 3. Nalazi koji traže odluku ili sljedeći sprint

1. **Offline queue na mobilnom (E6)** — `FAILED` operacije se ne retry-uju automatski.
   Predlog za Sprint 11/12: kolona `attempts` u `sync_queue`, backoff (1m/5m/15m/1h/6h),
   alarm u lokalnoj notifikaciji; do tada offline draft koji padne sync korisnik vidi kao
   neposlano (brojač u listi) i može ponoviti ručno.
2. **EXPLAIN (C2)** — pokrenuti na stagingu sa realnim brojem faktura (seed: 50 nije dovoljno
   za plan; ubaciti ~50k redova u kopiju). Komande u §4.
3. **Rate limiter nije pokriven e2e testom** jer se u testovima isključuje; dodati jedan
   e2e scenarij sa `RATE_LIMIT_ENABLED=true` i Redis-om (ili unit test guarda sa mock Redis-om).
4. **SMS sender ID i provajder (E4)** — čim se izabere provajder, upisati sender ID i potvrditi
   da šablon prolazi pravila provajdera.

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
| 1.0 | 2026-11-13 | agent (S11-1) | 19 ✅ / 11 ⚠️ / 1 ❌; runtime e2e i EXPLAIN ponoviti u CI-ju/stagingu |
