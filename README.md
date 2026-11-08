# Digitalni Asistent — Sprint 0 (kostur monorepo-a)

SaaS za fakturisanje i naplatu za mikro-poduzeća u Republici Srpskoj.
Jedini izvor istine za proizvod, model, API i pravila je
[`MASTER_PROMPT_IZgradnja_Aplikacije.md`](../MASTER_PROMPT_IZgradnja_Aplikacije.md) (izvan repoa);
ovaj repo sadrži samo **Sprint 0** — tehnički kostur, bez poslovnih funkcija.

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
│  │  │  └─ migrations/     # inicijalna migracija
│  │  ├─ src/common/        # globalni filter grešaka (§6 format)
│  │  ├─ src/modules/       # health (infra); auth/companies/... dolaze u Sprintu 1
│  │  └─ test/              # e2e (Supertest)
│  ├─ web/                  # Next.js App Router (W-01…W-08: Sprint 1–6)
│  └─ mobile/               # React Native bare (M-01…M-12: Sprint 1–6)
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

API rute su bez globalnog prefiksa (`/health`, kasnije `/auth`, `/invoices`…) — tačno kako §6 definiše.
`GET /health` je jedina ruta u Sprintu 0 i to je **infra** ruta (dogovoreno na kickoff-u).

## Skripte

| Komanda | Šta radi |
|---|---|
| `pnpm lint` | ESLint (flat config) u svim paketima |
| `pnpm typecheck` | `tsc --noEmit` u svim paketima |
| `pnpm test` | Vitest (shared, api) + Jest (mobile) |
| `pnpm build` | shared → api → web (mobile se ne gradi u Sprint 0 CI-ju) |
| `pnpm format` / `format:check` | Prettier |
| `pnpm db:*` | Docker baza, migracije, Prisma Studio |

## Testovi

- `packages/shared` — Zod šeme: JIB (13 cifara), telefon `+387`, e-mail, UUID v7, enum vrijednosti, format greške.
- `apps/api` — e2e `GET /health` (Supertest) + unit test filtera grešaka (mapiranje statusa → `code`, bez stack trace-a).
- `apps/mobile` — render smoke test (`App` prikazuje ime iz `@digitalni-asistent/shared`).

Pokrivenost poslovne logike (obračun, numeracija, tranzicije) dolazi u Sprintu 2/3 — §12.

## CI (`.github/workflows/ci.yml`)

GitHub Actions, Node 22, pnpm 10.34.9, Postgres 16 service:
`pnpm install --frozen-lockfile` → `lint` → `typecheck` → `test` → `build` →
`prisma validate` → `prisma migrate deploy` → `prisma migrate status`, plus `docker compose config`.

Android Gradle build **nije** u Sprint 0 CI-ju (dogovoreno: lint/typecheck/test za mobile, build za web+api).

## Konvencije i odluke (Sprint 0)

1. **`TransactionType` (SALE/REFUND/VOID)** je u šemi, ali `invoices` **nema** kolonu `transaction_type`
   — uvodi se uz VOID/REFUND tok (Sprint 5). `invoices.type` ostaje `InvoiceType` (SALE/ADVANCE).
2. **`company_id`** postoji samo gdje ga §5 eksplicitno navodi. `invoice_lines`, `payments`, `reminders`,
   `fiscal_records`, `devices`, `sync_queue` ga nemaju — scope se dobija join-om do `invoices`/`users`.
3. `role`, `status`, `plan`, `op`, `kind`, `entity`, `platform` su `String` jer §5 ne definiše enum vrijednosti.
4. Nullable kolone su izvedene iz semantike (npr. `fiscal_pfr`, `sent_at`, `archived_at` su opcionalni).
5. `packages/shared` se gradi u **CommonJS** (`dist/`) da ga mogu trošiti i Nest (CJS) i Next i Metro.
6. Finansijske kolone su `BigInt` — JSON serijalizacija BigInt-a je tema Sprinta 1/2 (API sloj).

## Otvorena pitanja (iz MASTER PROMPT-a, ne rješavati u kodu)

- **Numeracija:** §7.1 traži odvojene brojače po tipu (SALE/ADVANCE), a `companies` ima jedan
  `numbering_next`, uz `unique(company_id, number)` — to je u konfliktu. Predlog za Sprint 2:
  `unique(company_id, type, number)` ili prefiks tipa u broju.
- **JIB checksum** — za sada se provjerava samo 13 cifara.
- **SMS provajder** i **brend** (ime/logo, `com.digitalniasistent` je privremeni applicationId).
- **ESIR model (G0)** — do odgovora operatera radi se mock adapter (Sprint 3).

## Troubleshooting

| Problem | Rješenje |
|---|---|
| `pnpm install` pada uz `ERR_PNPM_*` u vezi peer depova | `strict-peer-dependencies=false` je već u `.npmrc`; obriši `node_modules` i probaj ponovo |
| Metro ne vidi `@digitalni-asistent/shared` | provjeri `apps/mobile/metro.config.js` (`watchFolders`, `nodeModulesPaths`) i da je shared buildovan (`pnpm --filter @digitalni-asistent/shared build`) |
| Prisma ne vidi `DATABASE_URL` | `.env` mora biti u `apps/api/` (Prisma CLI ga čita iz tog foldera) |
| `docker compose up` iz korijena ne nađe fajl | koristi `pnpm db:up` ili `docker compose -f infra/docker-compose.yml up -d` |
| Port 5432 zauzet | promijeni `POSTGRES_PORT` u `.env` i `DATABASE_URL` |
