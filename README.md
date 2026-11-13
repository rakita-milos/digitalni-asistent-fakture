# Digitalni Asistent — Sprint 0–9

SaaS za fakturisanje i naplatu za mikro-poduzeća u Republici Srpskoj.
Jedini izvor istine za proizvod, model, API i pravila je
[`MASTER_PROMPT_IZgradnja_Aplikacije.md`](../MASTER_PROMPT_IZgradnja_Aplikacije.md) (izvan repoa).

**Stanje:** Sprint 0–9 završeni; **Sprint 10** (integracije) u pripremi — R2 signed URL, Playwright CI
job i monitoring (Sentry) kod su spremni, a čekaju kredencijale (GitHub, Sentry DSN, R2, SMS, staging).
Aplikacija ima mobilni (`apps/mobile`), web (`apps/web`) i API (`apps/api`), mock fiskalizaciju do G0
i demo seed. Preostalo prije produkcije: integracije sa kredencijalima i prava ESIR fiskalizacija
poslije odgovora operatera — vidi [`PLAN_DALJEG_RADA.md`](../PLAN_DALJEG_RADA.md) i
[`PROGRESS.md`](../PROGRESS.md).

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
- Za Android build: **JDK 17** + **Android Studio / SDK 36** (nije potrebno za `pnpm lint/typecheck/test`)

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
| GET | `/account/export` * | owner | GDPR izvoz (JSON, bez hash-eva/tajni) |
| DELETE | `/account` * | owner | GDPR brisanje (anonimizacija; fiskalni podaci ostaju) |

### Firma, šifarnici, fakture

| Metod | Putanja | Auth | Napomena |
|---|---|---|---|
| GET / PATCH | `/company` | JWT | PATCH samo `owner` |
| GET / POST | `/customers` | JWT | lista sa `?q`, pretraga po imenu/JIB/telefonu/emailu |
| GET / PATCH | `/customers/:id` | JWT | arhiviranje kroz `archivedAt`; uključuje `reminderOptOut` (§7.9) |
| GET / POST | `/items` | JWT | katalog; POST dozvoljen `owner` i `worker` |
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

## Testovi

```bash
pnpm test                                  # unit + API e2e (shared, api, web, mobile)
pnpm --filter web test:e2e                 # Playwright e2e (web)
```

- `packages/shared` — **47** testova: Zod šeme, numeracija, JIB, telefon, UUID v7, enumi, error envelope.
- `apps/api` — **127** testova (23 fajla): e2e auth/firma/kupci/artikli/porezi, fakture (obračun,
  draft, filteri, DRAFT-only, IDOR), fiskalizacija (mock, numeracija bez rupa, PRAČUN 409, PDF, ESIR pad),
  naplata, podsjetnici (uključujući opt-out), izvještaji, storno/refundacija, worker (retry + alarm),
  sync, idempotencija, reset lozinke, slanje fakture, GDPR, logout; unit obračun/PDF token/alarm/R2/monitoring.
- `apps/web` — **13** testova (Vitest): format, obračun pregleda, parsiranje forme, pravila masovnih akcija.
- `apps/mobile` — **63** testa (Jest): API klijenti, auth store (uključujući logout offline),
  sync engine, offline draft/detalj, setup helperi, obračun.
- **Ukupno 250 unit/API testova + 8 Playwright e2e.**

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
  kreiranje drafta → izdavanje → PDF, lista faktura, masovno izdavanje.
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
  (u ovom okruženju nema JDK 17; APK ide kroz CI).
- **`PATCH /items/:id`** nije u §6 — artikli se mogu dodavati, ali ne mijenjati/arhivirati.
- **M-12 profil/lozinka** — osnovne sekcije rade; promjena lozinke ide kroz web reset tok.
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
| e2e pao poslije `SEED_RESET` | testovi mijenjaju demo bazu; ponovi `pnpm db:seed` prije ručnog pregleda |
