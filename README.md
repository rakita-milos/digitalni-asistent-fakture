# Digitalni Asistent — Sprint 0 + 1 + 2

SaaS za fakturisanje i naplatu za mikro-poduzeća u Republici Srpskoj.
Jedini izvor istine za proizvod, model, API i pravila je
[`MASTER_PROMPT_IZgradnja_Aplikacije.md`](../MASTER_PROMPT_IZgradnja_Aplikacije.md) (izvan repoa).

Stanje: **Sprint 0** (kostur), **Sprint 1** (auth, firma, kupci, artikli) i **Sprint 2**
(faktura: obračun, draft, lista, detalj — API + M-11 kupci na mobilnom).

## Stack (fiksan, MASTER PROMPT §2)

| Sloj | Tehnologija | Verzija u repou |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | pnpm 10.34.9, turbo 2.x |
| Mobilna | React Native (bare, **ne** Expo) | 0.88.1 |
| Web | Next.js App Router + Tailwind 4 | 15.5.x, Tailwind 4.3 |
| API | NestJS + Swagger | 10.4.x |
| ORM / baza | Prisma 6 + PostgreSQL 16 | Prisma 6.19.x |
| Queue | Redis 7 (BullMQ dolazi u Sprintu 4) | redis:7-alpine |
| Jezik | TypeScript strict | 5.9.3 |
| Testovi | Vitest + Supertest (API/shared), Jest + RNTL-style renderer (mobile) | |

## Struktura

```
digitalni-asistent/
├─ apps/
│  ├─ api/                  # NestJS REST API + Prisma šema + Swagger
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma   # 15 tabela, 5 enuma, propisani indeksi (§5)
│  │  │  └─ migrations/     # init + auth + numeracija po tipu (3 migracije)
│  │  ├─ src/common/        # filter grešaka (§6), guardovi, Zod pipe
│  │  ├─ src/config/        # validacija env varijabli
│  │  ├─ src/modules/       # health, auth, company, customers, items, tax-rates, invoices
│  │  └─ test/              # e2e (Supertest + prava baza/Redis)
│  ├─ web/                  # Next.js App Router (W-01…W-08: Sprint 4+)
│  └─ mobile/               # React Native bare — M-01 prijava (Sprint 1)
├─ packages/
│  ├─ shared/               # tipovi, Zod šeme, konstante (§5/§7)
│  └─ config/               # tsconfig + ESLint (flat) + Prettier
├─ infra/docker-compose.yml # Postgres 16 + Redis 7
├─ .github/workflows/ci.yml # lint, typecheck, test, build, prisma migrate
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

- Šema: [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma) — **tačno 15 tabela** iz §5.
- ID je **UUID v7** (`@default(uuid(7))`), novac **BigInt u feningu**, datumi **timestamptz**.
- Kolone u bazi su `snake_case` (`@map`), TS sloj je `camelCase`.
- Inicijalna migracija je commitovana; u CI-ju se primjenjuje sa `prisma migrate deploy`.

## Pokretanje

```bash
pnpm dev                       # turbo: shared (watch) + api + web
pnpm --filter api dev          # samo API  -> http://localhost:3001 (Swagger: /docs)
pnpm --filter web dev          # samo web  -> http://localhost:3000
pnpm --filter @digitalni-asistent/mobile start     # Metro
pnpm --filter @digitalni-asistent/mobile android   # RN na emulator/uređaj
```

API rute su bez globalnog prefiksa (`/auth`, `/company`, `/customers`…) — tačno kako §6 definiše.

### Sprint 1 — implementirane rute

| Metod | Putanja | Auth | Napomena |
|---|---|---|---|
| POST | `/auth/register` | — | firma + vlasnik, vraća sesiju (access+refresh) |
| POST | `/auth/login` | — | email **ili** telefon + lozinka, 5/min |
| POST | `/auth/refresh` | refresh | rotacija + detekcija ponovne upotrebe (opoziv uređaja) |
| POST | `/auth/otp/request` | — | 6-cifreni kod, 3/5min; u dev-u se loguje (mock SMS) |
| POST | `/auth/otp/verify` | — | provjera koda, max 3 pokušaja |
| GET / PATCH | `/company` | JWT | PATCH samo `owner` |
| GET / POST | `/customers` | JWT | lista sa `?q`, pretraga po imenu/JIB/telefonu/emailu |
| GET / PATCH | `/customers/:id` | JWT | arhiviranje kroz `archivedAt` (§6 nema DELETE) |
| GET / POST | `/items` | JWT | katalog; POST dozvoljen `owner` i `worker` |
| GET / POST | `/tax-rates` | JWT | **POST nije u §6** — dodato u Sprintu 1 (setup korak „porezi“) |
| GET / POST | `/invoices` | JWT | lista sa filterima (`status`, `from`/`to`, `customerId`, `q`) i paginacijom; POST = DRAFT |
| GET / PATCH | `/invoices/:id` | JWT | detalj sa linijama; PATCH samo dok je `DRAFT` (409 inače) |
| GET | `/health` | — | infra ruta (Docker/CI) |

Sigurnost: argon2id hash lozinki, access 15 min / refresh 30 dana, refresh hash (SHA-256) u `devices`
(tabela nema novu kolonu? ima: `refresh_token_hash`, `refresh_expires_at`), rate limiting u Redis-u,
Zod validacija svakog ulaza, `company_id` scope na svakom upitu (IDOR zaštita).

### Mobilna aplikacija (Sprint 1–2)

- M-01 Prijava (`src/screens/LoginScreen.tsx`) — React Hook Form + Zod šema iz `shared`.
- M-11 Kupci (`src/screens/CustomersScreen.tsx`) — lista, pretraga (`?q`), osvježavanje pri fokusu;
  dodavanje kroz `CustomerFormScreen.tsx` (iste Zod šeme kao API).
- Navigacija: React Navigation 7 (native stack), `RootNavigator` bira ekran po auth stanju.
- Tokeni: Keychain/Keystore preko `react-native-keychain` (§10, **ne** AsyncStorage);
  token se postavlja u API klijent pri prijavi i pri restore-u.
- Stanje: Zustand 5 (`src/state/authStore.ts`), API klijent `src/api/client.ts`.
- Android emulator: API na `http://10.0.2.2:3001` (`src/config.ts`).

## Skripte

| Komanda | Šta radi |
|---|---|
| `pnpm lint` | ESLint (flat config) u svim paketima |
| `pnpm typecheck` | `tsc --noEmit` u svim paketima |
| `pnpm test` | Vitest (shared, api) + Jest (mobile) |
| `pnpm build` | shared → api → web (mobile Gradle build nije u CI-ju) |
| `pnpm format` / `format:check` | Prettier |
| `pnpm db:*` | Docker baza, migracije, Prisma Studio |

## Testovi

- `packages/shared` — 45 testova: Zod šeme auth/company/customer/item/taxRate/invoice, numeracija,
  JIB, telefon, UUID v7, enumi, error envelope.
- `apps/api` — 38 testova: e2e auth (register/login/refresh/OTP), firma (owner vs worker), kupci,
  IDOR izolacija, artikli, porezne stope, **fakture** (obračun, draft, filteri, detalj, DRAFT-only izmjena),
  unit testovi obračuna (§7.3: base/discount/net/tax/total, half-up) i filtera grešaka.
- `apps/mobile` — 11 testova: API klijent, kupci API, auth store.

E2E testovi koriste pravu bazu i Redis (CI ih diže kao service kontejnere) i `RATE_LIMIT_ENABLED=false`
da brojači ne bi uticali na tok testova.

Pokrivenost numeracije pri izdavanju, PDF-a i statusnih tranzicija dolazi u Sprintu 3 — §12.

## CI (`.github/workflows/ci.yml`)

GitHub Actions, Node 22, pnpm 10.34.9, **Postgres 16 + Redis 7** service:
`pnpm install --frozen-lockfile` → `prisma generate` → `prisma validate` → `prisma migrate deploy` →
`lint` → `typecheck` → `test` → `build` → `prisma migrate status`, plus `docker compose config`.

Android Gradle build **nije** u CI-ju (dogovoreno: lint/typecheck/test za mobile, build za web+api).

## Konvencije i odluke (Sprint 0–1)

1. **`TransactionType` (SALE/REFUND/VOID)** je u šemi, ali `invoices` **nema** kolonu `transaction_type`
   — uvodi se uz VOID/REFUND tok (Sprint 5). `invoices.type` ostaje `InvoiceType` (SALE/ADVANCE).
2. **`company_id`** postoji samo gdje ga §5 eksplicitno navodi. `invoice_lines`, `payments`, `reminders`,
   `fiscal_records`, `devices`, `sync_queue` ga nemaju — scope se dobija join-om do `invoices`/`users`.
3. `role`, `status`, `plan`, `op`, `kind`, `entity`, `platform` su `String` jer §5 ne definiše enum vrijednosti.
4. Nullable kolone su izvedene iz semantike (npr. `fiscal_pfr`, `sent_at`, `archived_at` su opcionalni).
5. `packages/shared` se gradi u **CommonJS** (`dist/`) da ga mogu trošiti i Nest (CJS) i Next i Metro.
6. Finansijske kolone su `BigInt` — u API odgovorima se konvertuju u `number` (iznosi su daleko ispod 2^53).
7. **Refresh tokeni** se čuvaju kao SHA-256 hash u `devices` (`refresh_token_hash`, `refresh_expires_at`) —
   per-device revokacija iz §10 bez nove tabele (dogovoreno na kickoff-u Sprinta 1).
8. **`POST /tax-rates`** je dodat uz §6 (samo GET): bez njega setup korak „porezi“ (M-02) nema kako da upiše stope.
9. **OTP** je za sada verifikacija telefona (`{ verified: true }`), ne prijava — namjena u §6 nije definisana.
   SMS ide kroz adapter; `SMS_PROVIDER=log` u razvoju.
10. **ESLint `consistent-type-imports` je isključen u API-ju** — Nest DI traži value importe zbog `emitDecoratorMetadata`.
11. **Numeracija (Sprint 2):** `unique(company_id, type, number)` + `companies.numbering_next_advance`;
    broj `{year}-{seq:4}` se dodjeljuje **pri izdavanju** (Sprint 3), a draft nosi privremeni `DRAFT-…` broj —
    tako nema rupa u zakonskoj numeraciji. `formatInvoiceNumber` je u `shared` i pokriven testovima.

## Otvorena pitanja (iz MASTER PROMPT-a, ne rješavati u kodu)

- **Numeracija:** odluka donesena (po tipu, broj pri izdavanju), ali **alokator** broja (transakcija + brojači)
  dolazi uz `POST /invoices/:id/issue` u Sprintu 3. Do tada su draftovi na `DRAFT-…`.
- **JIB checksum** — za sada se provjerava samo 13 cifara.
- **SMS provajder** i **brend** (ime/logo, `com.digitalniasistent` je privremeni applicationId).
- **ESIR model (G0)** — do odgovora operatera radi se mock adapter (Sprint 3).
- **OTP namjena:** §6 ne kaže da li je OTP za prijavu, verifikaciju telefona ili reset lozinke.
  Trenutno: verifikacija telefona; odluka potrebna prije SMS integracije.
- **Nema `POST /auth/logout`** u §6 — odjava je za sada brisanje lokalne sesije, a server je opoziva
  tek detekcijom ponovne upotrebe refresh tokena. Predlog: dodati logout u Sprint 2.
- **Nema `PATCH /items/:id`** u §6 — artikli se mogu samo dodavati; izmjena/arhiviranje nije moguće.
- **`users.role` / `users.status`** su `String`; potvrditi tačne vrijednosti (owner/worker/accountant/agency,
  active/…).
- **M-02 setup** „može se prekinuti i nastaviti“ — nema polja za čuvanje napretka; predlog: lokalno stanje
  do odluke.

## Troubleshooting

| Problem | Rješenje |
|---|---|
| `pnpm install` pada uz `ERR_PNPM_*` u vezi peer depova | `strict-peer-dependencies=false` je već u `.npmrc`; obriši `node_modules` i probaj ponovo |
| Metro ne vidi `@digitalni-asistent/shared` | provjeri `apps/mobile/metro.config.js` (`watchFolders`, `nodeModulesPaths`) i da je shared buildovan (`pnpm --filter @digitalni-asistent/shared build`) |
| Prisma ne vidi `DATABASE_URL` | `.env` mora biti u `apps/api/` (Prisma CLI ga čita iz tog foldera) |
| `docker compose up` iz korijena ne nađe fajl | koristi `pnpm db:up` ili `docker compose -f infra/docker-compose.yml up -d` |
| Port 5432 zauzet | promijeni `POSTGRES_PORT` u `.env` i `DATABASE_URL` |
