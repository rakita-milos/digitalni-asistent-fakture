# Digitalni Asistent — Sprint 0–11 (u pripremi)

SaaS za fakturisanje i naplatu za mikro-poduzeća u Republici Srpskoj.
Jedini izvor istine za proizvod, model, API i pravila je
[`MASTER_PROMPT_IZgradnja_Aplikacije.md`](../MASTER_PROMPT_IZgradnja_Aplikacije.md) (izvan repoa).

**Stanje:** Sprint 0–9 završeni; **Sprint 10** (integracije) i **Sprint 11** (launch/pilot) su u pripremi —
kod za R2, Sentry, Playwright CI, opt-out, analitiku, audit i Play potpisivanje je spreman, a čekaju
kredencijale i odluke (GitHub, Sentry DSN, R2, SMS, staging, brend, JDK 17). Aplikacija ima mobilni
(`apps/mobile`), web (`apps/web`) i API (`apps/api`), mock fiskalizaciju do G0 i demo seed.
Preostalo prije produkcije: integracije sa kredencijalima, Play objava i prava ESIR fiskalizacija
poslije odgovora operatera — vidi [`PLAN_DALJEG_RADA.md`](../PLAN_DALJEG_RADA.md) i
[`PROGRESS.md`](../PROGRESS.md).

Operativni dokumenti: [`docs/STAGING_DEPLOY.md`](docs/STAGING_DEPLOY.md) (staging, deploy, rollback,
backup/restore), [`docs/INCIDENT_RUNBOOK.md`](docs/INCIDENT_RUNBOOK.md) (incidenti i podrška) i
[`docs/PRE_DEPLOYMENT_AUDIT.md`](docs/PRE_DEPLOYMENT_AUDIT.md) (audit checkliste sa dokazima).
Priprema objave i pilota: [`docs/PLAY_RELEASE.md`](docs/PLAY_RELEASE.md) (Play listing, Data Safety,
potpisivanje), [`docs/PILOT_KIT.md`](docs/PILOT_KIT.md) (onboarding, upitnik, metrike) i
[`docs/ANALYTICS.md`](docs/ANALYTICS.md) (minimalni događaji bez PII). Pravni drafti:
[`docs/LEGAL_DRAFT.md`](docs/LEGAL_DRAFT.md).

## Stack (fiksan, MASTER PROMPT §2)

| Sloj | Tehnologija | Verzija u repou |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | pnpm 10.34.9, turbo 2.x |
| Mobilna | React Native (bare, **ne** Expo) | 0.88.1 |
| Web | Next.js App Router + Tailwind 4 | 15.5.x, Tailwind 4.3 |
| API | NestJS + Swagger | 10.4.x |
| ORM / baza | Prisma 6 + PostgreSQL 16 | Prisma 6.19.x |
| Queue | Redis 7 + BullMQ | redis:7-alpine |
| PDF / QR | pdfkit + qrcode (DejaVu TTF) | 0.20.x / 1.5.x |
| Storage | Cloudflare R2 preko AWS S3 SDK (opciono; stream fallback) | AWS SDK 3.x |
| Fiskalizacija | ESIR adapter (mock do G0) | — |
| E2E | Playwright (web) | 1.65.x |
| Jezik | TypeScript strict | 5.9.3 |

## Struktura

```
digitalni-asistent/
├─ apps/
│  ├─ api/                  # NestJS REST API + Prisma šema + Swagger
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma   # 15 tabela, enumi, propisani indeksi (§5)
│  │  │  ├─ migrations/     # 5 migracija
│  │  │  └─ seed.js         # demo firma, 50 faktura (§12)
│  │  ├─ src/common/        # filter grešaka, guardovi (JWT/role/rate-limit), Zod pipe
│  │  ├─ src/config/        # validacija env varijabli + feature flagovi
│  │  ├─ src/modules/       # auth, account, company, customers, items, tax-rates,
│  │  │                     # invoices, payments, reminders, reports, sync, devices,
│  │  │                     # subscriptions, fiscal, worker, health
│  │  └─ test/              # e2e (Supertest + prava baza/Redis)
│  ├─ web/                  # Next.js App Router (W-01…W-08) + Playwright e2e
│  └─ mobile/               # React Native bare — M-01…M-12 + offline sync
├─ packages/
│  ├─ shared/               # tipovi, Zod šeme, konstante (§5/§7)
│  └─ config/               # tsconfig + ESLint (flat) + Prettier
├─ infra/docker-compose.yml # Postgres 16 + Redis 7
├─ .github/workflows/ci.yml # lint, typecheck, test, build, prisma migrate, android APK
└─ .env.example             # sve env varijable
```

## Preduslovi

- **Node.js ≥ 22.11** (React Native 0.88 zahtijeva)
- **pnpm 10.34.9** — preko Corepacka: `corepack enable` (repo ima `packageManager` polje)
- **Docker Desktop** (Postgres 16 + Redis 7)
- Za Android build: **JDK 17** + **Android SDK** (compileSdk 37, build-tools 37, NDK 27.1) — nije
  potrebno za `pnpm lint/typecheck/test`. pnpm je u `hoisted` režimu, pa `settings.gradle` RN šablona
  traži plugin u `apps/mobile/node_modules`; jednom napravi link:
  `mkdir -p apps/mobile/node_modules/@react-native && ln -s ../../../node_modules/@react-native/gradle-plugin apps/mobile/node_modules/@react-native/gradle-plugin`
  (na Windowsu: junction na istu putanju). CI `android` job to radi automatski.

## Instalacija

```bash
corepack enable
pnpm install
cp .env.example .env            # korijen (docker compose + dokumentacija)
cp .env.example apps/api/.env   # Prisma CLI čita .env iz apps/api
# za web: kreiraj apps/web/.env.local sa NEXT_PUBLIC_API_URL=http://localhost:3001
```

`pnpm install` zbog React Native-a koristi `node-linker=hoisted` (vidi `.npmrc`) — **ne** mijenjati.

## Baza podataka (Docker)

```bash
docker compose up -d          # iz korijena repoa (root compose.yaml uključuje infra/)
pnpm db:up      # = docker compose -f infra/docker-compose.yml up -d
pnpm db:logs
pnpm db:down
```

Postgres: `localhost:5432`, baza `digitalni_asistent`, korisnik `digitalni` / `digitalni`.

## Migracije (Prisma 6)

```bash
pnpm db:generate                                   # prisma generate
pnpm --filter api prisma migrate dev               # nova migracija + apply (dev)
pnpm --filter api prisma migrate dev --name ime    # imenovana migracija
pnpm db:deploy                                     # prisma migrate deploy (staging/prod/CI)
pnpm db:studio                                     # Prisma Studio
```

- Šema: [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma) — **15 tabela** iz §5.
- ID je **UUID v7** (`@default(uuid(7))`), novac **BigInt u feningu**, datumi **timestamptz**.
- Kolone u bazi su `snake_case` (`@map`), TS sloj je `camelCase`.

## Seed podaci (demo)

```bash
pnpm db:seed              # idempotentno: preskače ako demo firma već postoji
SEED_RESET=1 pnpm db:seed # briše i ponovo kreira demo firmu
```

Kreira demo firmu „Demo Firma d.o.o.“ (JIB `9999999999999`): 20 kupaca, 10 artikala,
3 porezne stope, 50 faktura (draft/izdate/plaćene/djelimično/dospjele), podešavanja podsjetnika,
trial pretplatu i mock fiskalne zapise.

- Prijava: **`demo@digitalni-asistent.ba`** / **`DemoLozinka123`**
- Lozinku mijenjaš sa `SEED_OWNER_PASSWORD` (env) prije pokretanja seed-a.
- Napomena: API e2e testovi rade `TRUNCATE` nad bazom — poslije `pnpm test` ponovo pokreni `pnpm db:seed`.

## Pokretanje

```bash
pnpm dev                       # turbo: shared (watch) + api + web
pnpm --filter api dev          # samo API  -> http://localhost:3001 (Swagger: /docs)
pnpm --filter api worker       # worker: podsjetnici + fiskalni retry (nakon `pnpm build`)
pnpm --filter web dev          # samo web  -> http://localhost:3000
pnpm --filter @digitalni-asistent/mobile start     # Metro
pnpm --filter @digitalni-asistent/mobile android   # RN na emulator/uređaj
```

API rute su bez globalnog prefiksa (`/auth`, `/company`, `/customers`…).

## API rute

Legenda: `*` = ruta nije u MASTER PROMPT §6 (svjesno dodata, upisano u odluke).

### Auth i nalog

| Metod | Putanja | Auth | Napomena |
|---|---|---|---|
| POST | `/auth/register` | — | firma + vlasnik, vraća sesiju |
| POST | `/auth/login` | — | email **ili** telefon + lozinka, 5/min |
| POST | `/auth/refresh` | refresh | rotacija + detekcija ponovne upotrebe |
| POST | `/auth/otp/request` | — | 6-cifreni kod; `log` SMS adapter u razvoju |
| POST | `/auth/otp/verify` | — | provjera koda (max 3 pokušaja) |
| POST | `/auth/forgot-password` * | — | link za reset (uvijek isti odgovor, 5/15 min) |
| POST | `/auth/reset-password` * | token | nova lozinka; opoziva sve sesije |
| POST | `/auth/logout` * | JWT | opoziv refresh tokena trenutnog uređaja |
| PATCH | `/auth/me` * | JWT | profil (telefon; e-mail uz trenutnu lozinku) — M-12 |
| POST | `/auth/change-password` * | JWT | promjena lozinke; ostale uređaje odjavljuje — M-12 |
| GET | `/account/export` * | owner | GDPR izvoz (JSON, bez hash-eva/tajni) |
| DELETE | `/account` * | owner | GDPR brisanje (anonimizacija; fiskalni podaci ostaju) |

### Firma, šifarnici, fakture

| Metod | Putanja | Auth | Napomena |
|---|---|---|---|
| GET / PATCH | `/company` | JWT | PATCH samo `owner` |
| POST | `/company/setup-complete` * | owner | server-side signal da je setup završen (S11-7, idempotentno) |
| GET / POST | `/customers` | JWT | lista sa `?q`, pretraga po imenu/JIB/telefonu/emailu |
| GET / PATCH | `/customers/:id` | JWT | arhiviranje kroz `archivedAt`; uključuje `reminderOptOut` (§7.9) |
| GET / POST / PATCH | `/items` | JWT | katalog; PATCH `/items/:id` mijenja ili arhivira (`archivedAt`) — nije u §6 |
| GET / POST | `/tax-rates` * | JWT | POST nije u §6 — potreban za setup „porezi“ |
| GET / POST | `/invoices` | JWT | filteri (`status`, `from`/`to`, `customerId`, `q`) + paginacija; POST = DRAFT |
| GET / PATCH | `/invoices/:id` | JWT | PATCH samo dok je `DRAFT` (409 inače) |
| POST | `/invoices/:id/issue` | JWT | fiskalizacija (mock) + dodjela broja; `ADVANCE` se ne fiskalizuje |
| POST | `/invoices/:id/convert` * | JWT | PRAČUN (DRAFT ADVANCE) → draft SALE (M-09) |
| POST | `/invoices/:id/cancel` | JWT | storno: novi VOID zapis, original `CANCELLED` |
| POST | `/invoices/:id/refund` | JWT | refundacija: novi REFUND zapis, iznos ≤ naplaćeno |
| POST | `/invoices/:id/payments` | JWT | naplata (puna/djelimična); preplata se odbija |
| POST | `/invoices/:id/send` * | JWT | e-mail (PDF prilog) ili SMS (kratkotrajni link) |
| GET | `/invoices/:id/pdf` | JWT | PDF (A4, PFR + QR) — R2 signed URL ako je konfigurisan, inače stream |
| GET | `/invoices/:id/qr` | JWT | QR kao PNG (mobilni prikaz) |
| GET | `/public/invoices/:id/pdf` * | token | javni PDF preko HMAC tokena (15 min) iz poruke |
| GET / PUT | `/reminder-settings` | owner | plan (max 4) i šablon podsjetnika |
| POST | `/invoices/:id/remind` | JWT | ručni SMS podsjetnik |
| GET | `/reminders` | JWT | lista podsjetnika firme |

### Izvještaji, sync, uređaji, pretplata

| Metod | Putanja | Auth | Napomena |
|---|---|---|---|
| GET | `/reports/receivables` | JWT | aging: current, 1-30, 31-60, 61-90, 90+ |
| GET | `/reports/monthly` | JWT | izdato / naplaćeno po mjesecu |
| POST | `/sync/push` | JWT | batch offline operacija (idempotentno po `entityId`) |
| GET | `/sync/pull` | JWT | delta kupaca i faktura |
| POST | `/devices/register` * | JWT | push token trenutnog uređaja (§6 ga navodi u tabeli) |
| GET / POST | `/subscriptions` * | owner | evidencija pretplate (bez naplate) |
| GET | `/health` | — | infra ruta (Docker/CI) |

Sigurnost: argon2id hash lozinki, access 15 min / refresh 30 dana, refresh hash (SHA-256) u `devices`,
rotacija + revokacija po uređaju, rate limiting u Redis-u, Zod validacija svakog ulaza,
`company_id` scope na svakom upitu (IDOR zaštita), audit log za izdavanje/naplatu/poništenje/slanje.

## Sprint 9 — zatvaranje MVP rupa (12. 11. 2026)

- **S9-1 Reset lozinke** — `POST /auth/forgot-password` + `/auth/reset-password`; token 30 min,
  SHA-256 hash u Redis-u, jednokratan, novi zahtjev invalidira stari; reset opoziva sve sesije;
  web `/forgot-password` i `/reset-password`; `EmailService` (`MAIL_PROVIDER=log` u razvoju).
- **S9-2 Slanje fakture** — `POST /invoices/:id/send` (e-mail sa PDF prilogom ili SMS sa kratkotrajnim
  javnim linkom; HMAC token 15 min; audit `invoice.send`); web dugme „Pošalji“.
- **S9-3 GDPR** — `GET /account/export` i `DELETE /account` (owner + potvrda `OBRISI`): anonimizacija
  naloga i kontakt podataka kupaca, brisanje uređaja/tokena; fakture i fiskalni zapisi ostaju.
- **S9-4 Playwright e2e** — 8 scenarija (auth/reset/odjava, faktura do PDF-a, masovne akcije).
- **S9-5 Masovne akcije (W-03)** — selekcija na listi faktura, „Izdaj izabrane“ i „Pošalji podsjetnik“,
  limit 50, rezultat po fakturi.
- **S9-6 Flagovi i alarm** — `FEATURE_FISCAL_ENABLED`, `FEATURE_SMS_ENABLED`,
  `FEATURE_ACCOUNT_DELETION`; alarm za `PENDING_FISCAL` > 3 dana (Redis dedupe 1× dnevno).
- **S9-7 Dokumentacija** — README i PROGRESS ažurirani.
- **S9-8 Logout** — `POST /auth/logout` (opoziv refresh tokena uređaja) u web i mobilnoj aplikaciji.

## Feature flagovi i e-mail/SMS adapteri

| Varijabla | Default | Efekat |
|---|---|---|
| `FEATURE_FISCAL_ENABLED` | `true` | `false` → izdavanje/retry vraća 503, worker preskače scan |
| `FEATURE_SMS_ENABLED` | `true` | `false` → SMS adapter vraća 503 (OTP/podsjetnici) |
| `FEATURE_ACCOUNT_DELETION` | `true` | `false` → brisanje naloga vraća 503 |
| `MAIL_PROVIDER` | `log` | `log` ispisuje e-mail u log (dev/test); pravi provajder u Sprintu 10 |
| `SMS_PROVIDER` | `log` | isto za SMS; u produkciji `log` baca grešku |

## R2 (čuvanje PDF-a, opciono)

Kada su postavljeni `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` i `R2_ENDPOINT` (ili `R2_ACCOUNT_ID`),
PDF se uploaduje u bucket pod content-addressed ključem (`pdf/invoices/{firma}/{faktura}-{hash}.pdf`)
i ruta `/invoices/:id/pdf` vraća **302 na signed URL** (TTL `R2_SIGNED_URL_TTL_SECONDS`, max 900 s).
Bez kredencijala ista ruta **streamuje** PDF — ponašanje i ugovor rute se ne mijenjaju.

| Varijabla | Default | Napomena |
|---|---|---|
| `R2_ACCOUNT_ID` | — | alternativa eksplicitnom endpointu |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | — | bez oba nema R2 režima |
| `R2_BUCKET` | `digitalni-asistent` | bucket u Cloudflare R2 |
| `R2_ENDPOINT` | — | npr. `https://<account>.r2.cloudflarestorage.com` |
| `R2_SIGNED_URL_TTL_SECONDS` | `900` | ≤ 15 min (Pre-Deployment Checklist) |

## Sprint 10 — priprema (12. 11. 2026)

- **R2 signed URL** — `R2StorageService` (S3 SDK, content-addressed ključevi, `ensureObject` + presign),
  PDF ruta vraća 302 na signed URL kada su ključevi prisutni, inače stream; 3 unit testa.
- **CI Playwright job** — `.github/workflows/ci.yml` dobija `e2e` job (Postgres/Redis, build,
  `playwright install --with-deps chromium`, `pnpm --filter web test:e2e`, izvještaj kao artifact).
- **Monitoring (Sentry, API/worker)** — `MonitoringService` sa `@sentry/node`: bez `SENTRY_DSN` je no-op
  (greške ostaju u logu); sa DSN-om šalje 5xx iz globalnog filtera (tagovi: request-id, ruta, status)
  i `FISCAL_ALARM`/worker padove. Web instrumentacija dolazi uz DSN.
- **Operativni runbook** — `docs/STAGING_DEPLOY.md` (prvi deploy, rutina release-a, rollback,
  backup + test restore) i `docs/INCIDENT_RUNBOOK.md` (S1/S2 scenariji, komunikacija, post-mortem).
- **Čeka tvoje akcije:** GitHub remote (da CI uopšte krene), Sentry DSN, R2 ključevi, SMS provajder,
  staging nalozi, JDK 17 za lokalni APK.

## Monitoring (Sentry)

| Varijabla | Default | Napomena |
|---|---|---|
| `SENTRY_DSN` | — | bez DSN-a monitoring je no-op |
| `SENTRY_ENVIRONMENT` | `NODE_ENV` | npr. `staging`, `production` |
| `SENTRY_TRACES_SAMPLE_RATE` | `0` | performance tracing isključen |
| `APP_RELEASE` | — | release tag (npr. commit SHA) |

Alarmi koje treba podesiti u Sentry-ju: 5xx stopa, `FISCAL_ALARM` (PENDING_FISCAL > 3 dana),
worker padovi, queue backlog (Sprint 10, kad DSN bude postavljen).

## Sprint 11 — priprema (13. 11. 2026)

- **S11-2a Opt-out podsjetnika** — novo polje `customers.reminder_opt_out` (migracija
  `20261113104648_customer_reminder_opt_out`): automatski podsjetnici se ne zakazuju, worker otkazuje
  već zakazane, ručni podsjetnik vraća 409; web forma kupca ima checkbox, detalj prikazuje oznaku.
  3 API e2e testa.
- **S11-2b Kredit kupca** — čeka odluku vlasnika/računovođe (preplata se za sada odbija).
- **S11-3 (dio) Pravni drafti** — `docs/LEGAL_DRAFT.md`: inventar podataka, skeleton politike privatnosti
  i uslova, mapiranje GDPR prava na funkcije (izvoz/brisanje/opt-out), otvorena pitanja za pravnika.
- **S11-4 (dio) Play objava** — `docs/PLAY_RELEASE.md`: odluke (package/brend/keystore), AAB i potpisivanje,
  store listing tekst, Data Safety odgovori, content rating i checklist prije recenzije.
- **S11-6 Support/incident runbook** — `docs/INCIDENT_RUNBOOK.md` (severiteti, scenariji za
  fiskalizaciju/SMS/bazu/Redis/R2, komunikacija, post-mortem, kontakti).
- **S11-1 Audit po Pre-Deployment Checklist** — `docs/PRE_DEPLOYMENT_AUDIT.md` (svaka stavka sa
  dokazom; 21 ✅ / 10 ⚠️ / 0 ❌). Usput popravljeno: `/health` provjerava bazu i Redis,
  `x-request-id` na svakom odgovoru, rate limit za izdavanje (30/min) i slanje (10/min),
  TTL cap 15 min u env validaciji.
- **S11-4 (dio) Play potpisivanje i brend materijal** — release `signingConfigs` čita
  `android/keystore.properties` ili `DA_*` env varijable; `keystore.properties` u `.gitignore`;
  placeholder ikona 512×512, feature graphic 1024×500 i launcher ikone svih gustina generisane
  skriptom `apps/mobile/scripts/generate-play-assets.mjs` (finalni brend od dizajnera).
- **S11-5 Pilot kit** — `docs/PILOT_KIT.md`: demo nalog, onboarding 5 koraka, scenario prvog dana,
  feedback upitnik (NPS), metrike uspjeha, support kanal i tabela za praćenje.
- **S11-7 Analitika** — odluka: bez PostHog-a za MVP; `AnalyticsService` emituje
  `ANALYTICS` log redove (`registration`, `invoice_issued`, `payment_recorded`, `reminder_sent`,
  bez PII), `pnpm --filter api metrics:platform` daje brojeve iz baze.
- **S11-1/S11-7 dorada** — offline retry u mobilnom (backoff 1m/5m/15m/1h/6h, max 5 pokušaja,
  `FAILED` + alarm 3 dana + ručni retry), 6 unit testova za rate limiter,
  `POST /company/setup-complete` (owner, idempotentno) + `companies.setup_completed_at`,
  `pnpm --filter api db:explain` — EXPLAIN je pokazao seq scan za listu faktura, dodat indeks
  `invoices_company_id_created_at_idx` (migracija `20261113180000`); sada 0 seq scan.

## S11-8 — dopuna M-01/M-12, katalog artikala i rate limiter e2e (15. 11. 2026)

- **M-01 biometrijska prijava** — `apps/mobile/src/storage/biometricSession.ts` (Keychain zapis vezan za
  `ACCESS_CONTROL.BIOMETRY_ANY`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`): opcija „Zapamti prijavu biometrijom“
  na prijavi, dugme „Prijavi se biometrijom“, **zaključan ekran pri pokretanju** (`LockScreen`, status
  `locked`) kada je prijava upamćena; isključivanje u podešavanjima, brisanje pri odjavi i pri promjeni
  lozinke; `USE_BIOMETRIC` u AndroidManifest-u (odluka 25 u `PROGRESS.md`). 21 novi Jest test
  (`biometricSession` 9, auth store 10, slanje fakture 2).
- **Slanje fakture iz mobilne aplikacije** — `sendInvoice()` u `api/invoices.ts` i modal na M-08
  (kanal e-mail/SMS + opcioni primalac); poruka prikazuje stvarnog primaoca iz API odgovora.
- **M-12 nalog i lozinka** — nove rute `PATCH /auth/me` (telefon; e-mail uz trenutnu lozinku, 409 za
  duplikat u firmi, audit `user.profile_update`) i `POST /auth/change-password` (trenutna + nova lozinka,
  opoziv ostalih uređaja, audit `user.password_change`, rate limit 5/15 min); mobilni ekran `Account`
  (profil + lozinka) dostupan iz podešavanja.
- **`PATCH /items/:id`** — djelimična izmjena i arhiviranje artikla (`archivedAt`, isti obrazac kao
  kupci), IDOR 404; web sekcija „Artikli“ u podešavanjima (izmjena u mjestu, arhiviranje, novi artikal).
- **Rate limiter e2e na stvarnom Redis-u** — `test/rate-limit.e2e-spec.ts`: 5 prijava/min pa 429
  (i sa ispravnom lozinkom), limit je po ruti (`forgot-password` i `/health` rade dalje); brojači se
  čiste iz Redis-a prije svakog testa.
- **Health readiness stabilizovan** — `GET /health` je vraćao 503 na prvom zahtjevu poslije starta jer
  `ioredis` još nije bio povezan (`enableOfflineQueue=false`); `checkRedis` sada radi jedan kratki retry
  (250 ms), a pravi pad Redis-a i dalje vraća 503 (+1 unit test).
- **Dokumentacija** — poččišćeni zaostali fragmenti u `README` (offline retry) i
  `docs/PRE_DEPLOYMENT_AUDIT.md`.
- **Verifikovano lokalno (16. 11. 2026):** lint 5/5, typecheck 5/5, `pnpm build` **3/3** (Next
  kompajliran), **316 testova** (shared 51, api 159, web 13, mobile 93) i **Playwright e2e 9/9**
  (31,8 s) — sve zeleno; `prisma migrate deploy` na Postgres 16 + Redis 7.
- **Android build (S11-8h)** — `settings.gradle` sada sam nađe RN Gradle plugin i poziva
  `@react-native-community/cli config` kroz `node` (pnpm `hoisted` nema `.bin` u `apps/mobile`);
  CI `android` job dodaje linkove za `react-native` i `@react-native` prije `gradlew`.
  Lokalni APK build je prošao compile/codegen/NDK korake, ali pao na `op-sqlite` native buildu zbog
  Windows `MAX_OBJECT_PATH` (putanja repoa > 250 znakova) — APK ide kroz CI ili iz kraće putanje
  (npr. `C:\da`).

## Testovi

```bash
pnpm test                                  # unit + API e2e (shared, api, web, mobile)
pnpm --filter web test:e2e                 # Playwright e2e (web)
```

- `packages/shared` — **51** testova: Zod šeme, numeracija, JIB, telefon, UUID v7, enumi, error envelope.
- `apps/api` — **159** testova (31 fajl): e2e auth/firma/kupci/artikli/porezi, fakture (obračun,
  draft, filteri, DRAFT-only, IDOR), fiskalizacija (mock, numeracija bez rupa, PRAČUN 409, PDF, ESIR pad),
  naplata, podsjetnici (uključujući opt-out), izvještaji, storno/refundacija, worker (retry + alarm),
  sync, idempotencija, reset lozinke, slanje fakture, GDPR, logout, setup-complete, **PATCH /items/:id**,
  **profil i promjena lozinke (M-12)** i **rate limiter na stvarnom Redis-u**; unit obračun/PDF
  token/alarm/R2/monitoring, health readiness (uključujući retry), request-id middleware i analitika.
- `apps/web` — **13** testova (Vitest): format, obračun pregleda, parsiranje forme, pravila masovnih akcija.
- `apps/mobile` — **93** testa (Jest): API klijenti (uključujući slanje fakture), auth store
  (biometrijsko otključavanje, odjava offline), sync engine + retry/backoff, offline draft/detalj,
  setup helperi, obračun, biometrijska prijava.
- **Ukupno 316 unit/API testova + 9 Playwright e2e** — svi izvršeni lokalno 16. 11. 2026. i zeleni.

API e2e koristi pravu bazu i Redis; testovi `TRUNCATE`-uju bazu, pa poslije njih pokreni `pnpm db:seed`.

### Playwright e2e (web)

Preduslovi: Docker (Postgres + Redis), `pnpm build` (Next `start` servira build) i instaliran browser:

```bash
pnpm --filter web exec playwright install chromium
pnpm --filter web test:e2e
```

- `apps/web/playwright.config.ts` podiže API (`/health`) i web (`next start`) i koristi demo nalog.
- `e2e/global-setup.ts` radi `prisma migrate deploy` + **svježi demo seed** (`SEED_RESET=1`);
  preskoči sa `E2E_SKIP_DB_SETUP=1` ako je baza već pripremljena.
- Scenariji: prijava, pogrešna lozinka, zaboravljena lozinka, nevažeći reset token, odjava,
  kreiranje drafta → izdavanje → PDF, lista faktura, masovno izdavanje, **artikli u podešavanjima
  (dodavanje → izmjena cijene → arhiviranje)**.
- Artefakti (`test-results/`, `playwright-report/`) su u `.gitignore`.

## Skripte

| Komanda | Šta radi |
|---|---|
| `pnpm lint` | ESLint (flat config) u svim paketima |
| `pnpm typecheck` | `tsc --noEmit` u svim paketima |
| `pnpm test` | Vitest (shared, api, web) + Jest (mobile) — sekvencijalno po paketima |
| `pnpm --filter web test:e2e` | Playwright e2e (web) |
| `pnpm build` | shared → api → web (mobile Gradle build nije u CI-ju) |
| `pnpm format` / `format:check` | Prettier |
| `pnpm db:*` | Docker baza, migracije, seed, Prisma Studio |
| `pnpm --filter api metrics:platform` | JSON platform-metrike za pilot (bez PII) |
| `pnpm --filter api db:explain` | EXPLAIN provjera lista faktura/aging (pravi i čisti 40×500 dijagnostičkih faktura) |

## CI (`.github/workflows/ci.yml`)

GitHub Actions, Node 22, pnpm 10.34.9, **Postgres 16 + Redis 7** service:
`pnpm install --frozen-lockfile` → `prisma generate` → `prisma validate` → `prisma migrate deploy` →
`lint` → `typecheck` → `test` → `build` → `prisma migrate status`, plus `docker compose config`.

Android debug build je u CI-ju (`android` job: JDK 17 + Android SDK, `assembleDebug`, APK kao artifact).
Web e2e je u CI-ju (`e2e` job: build + Chromium + `pnpm --filter web test:e2e`, izvještaj kao artifact).
**Napomena:** repo još nije povezan na GitHub, pa CI jobovi nisu pokrenuti — vidi Sprint 10 u planu.

## Konvencije i odluke

1. **`TransactionType` (SALE/REFUND/VOID)** je kolona `invoices.transaction_type` (Sprint 5);
   `invoices.type` ostaje `InvoiceType` (SALE/ADVANCE).
2. **`company_id`** postoji samo gdje ga §5 navodi; scope za `invoice_lines`, `payments`, `reminders`,
   `fiscal_records`, `devices`, `sync_queue` dobija se join-om do `invoices`/`users`.
3. `role`, `status`, `plan`, `op`, `kind`, `entity`, `platform` su `String` jer §5 ne definiše enum vrijednosti.
4. `packages/shared` se gradi u **CommonJS** (`dist/`) da ga troše Nest (CJS), Next i Metro.
5. Finansijske kolone su `BigInt`; u API odgovorima se konvertuju u `number`.
6. **Refresh tokeni** se čuvaju kao SHA-256 hash u `devices`; revokacija po uređaju (§10).
7. **`POST /tax-rates`** je dodat uz §6 (setup korak „porezi“).
8. **Numeracija:** `unique(company_id, type, number)`; broj `{year}-{seq:4}` se dodjeljuje **pri izdavanju**,
   draft nosi `DRAFT-…` — nema rupa u zakonskoj numeraciji.
9. **Fiskalizacija:** adapter pattern; `ESIR_MODE=mock` do G0; `ISSUED` samo poslije ESIR odgovora,
   pad → `PENDING_FISCAL` + retry sa backoff-om 1m/5m/15m/1h/6h i alarmom > 3 dana.
10. **PRAČUN se ne fiskalizuje**; konverzija PRAČUN → račun je `POST /invoices/:id/convert` (van §6).
11. **PDF:** za sada stream preko API-ja; R2 signed URL dolazi u Sprintu 10 (kredencijali).
12. **Preplata se odbija** (400) dok se ne doda kredit kupca (§7.8) — odluka za Sprint 11.
13. **VOID/REFUND** su nova dokumenta sa svojim brojem; ne fiskalizuju se do G0 (storno model).
14. **Web sesija:** tokeni u httpOnly cookie-ju; silent refresh u `middleware.ts` (Sprint 8);
    logout opoziva refresh token na API-ju.
15. **Idempotency-Key** na `POST /invoices` i `POST /invoices/:id/payments` (Redis `SET NX`, 24 h).
16. **GDPR brisanje:** anonimizacija umjesto fizičkog brisanja; fakture/fiskalni/audit ostaju
    (zakonska obaveza čuvanja). Pravnik potvrđuje tok prije produkcije.
17. **Javni PDF link:** HMAC token vezan za fakturu, TTL 15 min; zamjenjuje se R2 signed URL-om.
18. **Radnici/računovođe:** MVP je samo vlasnik (multi-user poslije MVP-a, §20).
19. **Analitika (S11-7):** za MVP nema PostHog-a — događaji su `ANALYTICS` log redovi bez PII
    preko `AnalyticsService`, a brojevi se rade iz baze (`metrics:platform`); imena događaja
    ostaju ista ako se kasnije doda PostHog.
20. **Health/request-id (S11-1):** `GET /health` je readiness (baza + Redis, 503 kada padnu),
    a `x-request-id` ide na svaki odgovor preko middleware-a (filter ga koristi za log/Sentry).
21. **Offline retry (S11-1/E6):** `sync_queue` dobija `attempts`/`nextAttemptAt`; backoff
    1m/5m/15m/1h/6h, max 5 pokušaja → `FAILED`, alarm u UI poslije 3 dana i ručni retry.
22. **Setup signal (S11-7):** `POST /company/setup-complete` je owner-only i idempotentan;
    `setup_completed` se emituje samo prvi put; mobilni ga zove best-effort pri završetku.
23. **Artikli (S11-8):** `PATCH /items/:id` (nije u §6) mijenja naziv/jedinicu/cijenu/stopu i arhivira
    kroz `archivedAt` (null = vraćanje); tuđi artikal vraća 404, ne 403.
24. **Nalog (S11-8):** `PATCH /auth/me` i `POST /auth/change-password` (nisu u §6) — profil i lozinka
    bez odlaska na web. Promjena e-maila traži trenutnu lozinku (e-mail je identitet za prijavu/reset);
    promjena lozinke opoziva ostale uređaje, a uređaj sa kojeg je izvršena ostaje prijavljen.
25. **Biometrija (S11-8):** upamćena prijava je Keychain zapis sa `ACCESS_CONTROL.BIOMETRY_ANY` i
    `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; aplikacija se pri pokretanju zaključava (`locked`) dok se ne
    otključa biometrijom ili prijavom lozinkom; odjava i promjena lozinke brišu upamćenu prijavu;
    uređaj bez biometrije radi kao ranije (bez zaključavanja).

## Poznata ograničenja (prije produkcije)

- **G0 operater ESIR** — fiskalizacija je mock; PFR/QR placeholder; storno fiskalizacija i PDV tretman
  refundacije čekaju odgovor operatera/računovođu.
- **GitHub/CI** — remote nije povezan, pa CI i Android APK job nisu pokrenuti.
- **Sentry/monitoring** — kod je spreman (`MonitoringService`, @sentry/node, no-op bez DSN-a);
  čeka se DSN i instrumentacija web aplikacije (`@sentry/nextjs`).
- **R2** — kod za upload i signed URL je spreman (`R2StorageService`, 302 na signed URL kad su ključevi
  postavljeni); bez kredencijala PDF se streamuje. Čekaju se R2 ključevi.
- **SMS provajder** — `log` adapter; bez provajdera nema stvarnih podsjetnika/OTP-a.
- **Kredit kupca pri preplati** — nema polja u §5; preplata se odbija dok vlasnik/računovođa ne odluče
  o modelu kredita (S11-2b). Opt-out podsjetnika je urađen (S11-2a).
- **Mobilni offline** je implementiran i typecheck-ovan, ali nije verifikovan na fizičkom uređaju
  (u ovom okruženju nema JDK 17; APK ide kroz CI). Offline queue ima retry/backoff
  (`sync/retry.ts`, `attempts`/`nextAttemptAt`), `FAILED` stavke i alarm poslije 3 dana
  (vidi `docs/PRE_DEPLOYMENT_AUDIT.md`, E6); test na uređaju ostaje za S10-2.
- **Biometrija (M-01)** — kod i testovi postoje, ali prompt nije verifikovan na fizičkom uređaju
  (nema APK-a); potvrditi na 3 uređaja u S10-2 (otključavanje, otkazivanje, uređaj bez biometrije).
- **JIB checksum**, **role/status vrijednosti**, **numeracija format** — potvrditi sa računovođom.
- **Play/brend** — package name `com.digitalniasistent` je privremen.

## Troubleshooting

| Problem | Rješenje |
|---|---|
| `pnpm install` pada uz `ERR_PNPM_*` u vezi peer depova | `strict-peer-dependencies=false` je već u `.npmrc`; obriši `node_modules` i probaj ponovo |
| Metro ne vidi `@digitalni-asistent/shared` | provjeri `apps/mobile/metro.config.js` (`watchFolders`, `nodeModulesPaths`) i da je shared buildovan (`pnpm --filter @digitalni-asistent/shared build`) |
| Prisma ne vidi `DATABASE_URL` | `.env` mora biti u `apps/api/` (Prisma CLI ga čita iz tog foldera) |
| `docker compose up` iz korijena ne nađe fajl | koristi `pnpm db:up` ili `docker compose -f infra/docker-compose.yml up -d` |
| Port 5432 zauzet | promijeni `POSTGRES_PORT` u `.env` i `DATABASE_URL` |
| Playwright: „Executable doesn't exist“ | `pnpm --filter web exec playwright install chromium` |
| Playwright: port 3000/3001 zauzet | zaustavi dev servere ili pusti Playwright da ih podigne (config ih sam startuje) |
| API test worker padne (`ERR_IPC_CHANNEL_CLOSED`, „Channel closed") | pun set (19 e2e fajlova) traži više heap-a: `$env:NODE_OPTIONS='--max-old-space-size=6144'` prije `pnpm test` |
| Android build padne na `ninja: manifest 'build.ninja' still dirty` / `MAX_OBJECT_PATH` | putanja repoa je preduga za Windows (CMake limit 250); build iz kraće putanje (`C:\da`) ili kroz CI |
| e2e pao poslije `SEED_RESET` | testovi mijenjaju demo bazu; ponovi `pnpm db:seed` prije ručnog pregleda |