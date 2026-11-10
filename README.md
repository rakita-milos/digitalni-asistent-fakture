# Digitalni Asistent — Sprint 0–5

SaaS za fakturisanje i naplatu za mikro-poduzeća u Republici Srpskoj.
Jedini izvor istine za proizvod, model, API i pravila je
[`MASTER_PROMPT_IZgradnja_Aplikacije.md`](../MASTER_PROMPT_IZgradnja_Aplikacije.md) (izvan repoa).

Stanje: **Sprint 0** (kostur), **Sprint 1** (auth, firma, kupci, artikli), **Sprint 2**
(faktura: obračun, draft, lista, detalj) i **Sprint 3** (fiskalizacija mock, numeracija pri izdavanju, PDF/QR).

## Stack (fiksan, MASTER PROMPT §2)

| Sloj | Tehnologija | Verzija u repou |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | pnpm 10.34.9, turbo 2.x |
| Mobilna | React Native (bare, **ne** Expo) | 0.88.1 |
| Web | Next.js App Router + Tailwind 4 | 15.5.x, Tailwind 4.3 |
| API | NestJS + Swagger | 10.4.x |
| ORM / baza | Prisma 6 + PostgreSQL 16 | Prisma 6.19.x |
| Queue | Redis 7 (BullMQ dolazi u Sprintu 4/5) | redis:7-alpine |
| PDF / QR | pdfkit + qrcode (DejaVu TTF) | 0.20.x / 1.5.x |
| Fiskalizacija | ESIR adapter (mock do G0) | — |
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
│  │  ├─ src/modules/       # health, auth, company, customers, items, tax-rates, invoices, fiscal
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
- Napomena: e2e testovi rade `TRUNCATE` nad bazom — poslije `pnpm test` ponovo pokreni `pnpm db:seed`.

## Pokretanje

```bash
pnpm dev                       # turbo: shared (watch) + api + web
pnpm --filter api dev          # samo API  -> http://localhost:3001 (Swagger: /docs)
pnpm --filter api worker       # worker: podsjetnici + fiskalni retry (nakon `pnpm build`)
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
| POST | `/invoices/:id/issue` | JWT | fiskalizacija preko ESIR adaptera + dodjela broja; `ADVANCE` (PRAČUN) se ne fiskalizuje |
| GET | `/invoices/:id/pdf` | JWT | PDF (A4, PFR + QR 45 mm) — stream ili signed URL (vidi odluke) |
| POST | `/invoices/:id/cancel` | JWT | storno: novi VOID zapis sa brojem, original prelazi u `CANCELLED` |
| POST | `/invoices/:id/refund` | JWT | refundacija: novi REFUND zapis, iznos ≤ naplaćeno |
| POST | `/invoices/:id/payments` | JWT | naplata (puna/djelimična); preplata se odbija |
| GET / PUT | `/reminder-settings` | owner | plan (max 4) i šablon podsjetnika |
| POST | `/invoices/:id/remind` | JWT | ručni SMS podsjetnik |
| GET | `/reminders` | JWT | lista podsjetnika firme |
| GET | `/reports/receivables` | JWT | aging: current, 1-30, 31-60, 61-90, 90+ |
| GET | `/reports/monthly` | JWT | izdato / naplaćeno po mjesecu |
| POST | `/sync/push` | JWT | batch offline operacija (customer/invoice, idempotentno po `entityId`) |
| GET | `/sync/pull` | JWT | delta kupaca i faktura (fakture od `since`) |
| GET | `/health` | — | infra ruta (Docker/CI) |

Sigurnost: argon2id hash lozinki, access 15 min / refresh 30 dana, refresh hash (SHA-256) u `devices`
(tabela nema novu kolonu? ima: `refresh_token_hash`, `refresh_expires_at`), rate limiting u Redis-u,
Zod validacija svakog ulaza, `company_id` scope na svakom upitu (IDOR zaštita).

### Sprint 3 — fiskalizacija i PDF

- **Fiskalni adapter** (`src/modules/fiscal`): interfejs `FiscalAdapter` + `MockFiscalAdapter`.
  `ESIR_MODE=mock` (default) vraća placeholder PFR (`MOCK-{JIB}-{hex}`) i QR payload;
  stvarni format zavisi od Pravilnika i odgovora operatera (G0). `ESIR_MODE=esir` namjerno pada pri startu
  dok integracija ne postoji — bolje ne izdati račun nego izdati nefiskalni.
- **Izdavanje** (`POST /invoices/:id/issue`): ESIR → pa tek onda `ISSUED`; ako ESIR padne, faktura ide u
  `PENDING_FISCAL`, upisuje se `fiscal_records` sa statusom `FAILED` i vraća se 502 (`BAD_GATEWAY`).
  Uspjeh upisuje `fiscal_records` + `audit_log` (`invoice.issue`) i dodjeljuje broj u istoj transakciji.
- **Numeracija pri izdavanju:** `SELECT ... FOR UPDATE` na redu firme, brojači po tipu, reset na 1 za novu godinu,
  `{year}-{seq:4}` (opciono `numbering_prefix`). Bez rupa — draftovi nikad ne troše broj.
- **PDF** (`pdfkit` + `qrcode` + DejaVu TTF za č/ć/š/ž/đ): zaglavlje firme, kupac, tabela stavki,
  osnovica/PDV/ukupno, PFR i QR 45 mm; `PRAČUN` oznaka za `ADVANCE`.

### Sprint 4 — naplata, podsjetnici, izvještaji

- **Naplata** (`POST /invoices/:id/payments`): puna ili djelimična; `paid_fening` se uvećava, status prelazi u
  `PARTIALLY_PAID`/`PAID`. Iznos iznad ostatka duga se **odbija** (400) — `paid_fening ≤ total_fening` (§7.8);
  preplata/kredit kupca nije modelovan u §5, pa se ne izmišlja. Audit log `payment.create`.
- **Podsjetnici**: `GET/PUT /reminder-settings` (owner) — šablon mora sadržavati `{broj}` i `{iznos}`,
  plan do **4** automatska podsjetnika. Pri izdavanju se kreiraju `SCHEDULED` redovi (worker ih šalje u Sprintu 5);
  `POST /invoices/:id/remind` šalje odmah preko SMS adaptera i upisuje `SENT`/`FAILED`.
- **Izvještaji**: `GET /reports/receivables` (aging po dospijeću, umanjeno za naplaćeno) i
  `GET /reports/monthly` (izdato/naplaćeno po mjesecu).
- **Mobilna**: M-03 Početna (KPI + aging) i M-04 Fakture (lista sa statusima).

### Web MVP (Sprint 6 — u toku)

- **W-01 Prijava** (`app/login`): server action poziva `POST /auth/login`, tokeni idu u **httpOnly cookie**
  (`da_access` 15 min, `da_refresh` 30 dana); `secure` u produkciji.
- **Zaštita ruta** (`app/(app)/layout.tsx`): bez cookie-ja → redirect na `/login` (provjereno: 307).
- **W-02 Dashboard** (`app/(app)/page.tsx`): firma + ukupno nenaplaćeno + aging buckets iz `/reports/receivables`.
- **W-03 Fakture** (`app/(app)/invoices/page.tsx`): tabela (broj, kupac, rok, iznos, status) + PDF link.
- **W-05 Štampa/PDF**: proxy ruta `app/api/invoices/[id]/pdf` — browser ima cookie, API traži Bearer.
- Server-side API klijent (`lib/api.ts`) čita token iz cookie-ja; `lib/format.ts` za fening/datum/status.

### Sprint 5 — poništenje i refundacija

- **Šema:** `invoices.transaction_type` (`SALE`/`VOID`/`REFUND`) — kolona je dodata u Sprintu 5
  (odluka iz kickoff-a), migracija `20261109120000_invoice_transaction_type`.
- **Poništenje** (`POST /invoices/:id/cancel`): kreira **novi VOID zapis** sa sopstvenim brojem i kopijom
  stavki/totala, vezan preko `original_invoice_id`; original ostaje u bazi, status → `CANCELLED`.
  Dozvoljeno samo za izdatu fakturu bez naplate (plaćena → 409 „koristite refundaciju“).
- **Refundacija** (`POST /invoices/:id/refund`): novi **REFUND zapis** (status `ISSUED`) sa jednom stavkom
  „Refundacija po računu X“; iznos ≤ naplaćeno i kumulativno ograničen na naplaćeno; original ostaje `PAID`.
- **Napomena:** VOID/REFUND zapisi se za sada **ne fiskalizuju** (storno fiskalizacija zavisi od modela operatera, G0);
  PDV tretman refundacije je pojednostavljen (jedna stavka, stopa 0) — potvrditi sa računovođom.
- **Worker (BullMQ)** — odvojen proces (`pnpm --filter api worker` nakon `pnpm build`):
  - `reminders`: svakih 60 s šalje `SCHEDULED` podsjetnike kojima je vrijeme došlo; preskače plaćene/poništene
    i kupce bez telefona (`CANCELLED`/`FAILED`);
  - `fiscal-retry`: svakih 5 min ponavlja fiskalizaciju `PENDING_FISCAL` sa backoff-om **1m/5m/15m/1h/6h**
    (§7.5), max 5 pokušaja, alarm u logu ako čeka > 3 dana.
- **Offline sync (API)** — `POST /sync/push` prima batch `{ entity, op, entityId, payload }` (max 100):
  `entityId` je klijentski UUID v7 i **idempotency ključ**; svaka operacija dobija `sync_queue` zapis
  (`DONE`/`FAILED`). Podržano: `customer` create/update i `invoice` create (DRAFT, sa klijentskim ID-jem).
  `GET /sync/pull?since=` vraća kupce (sve aktivne — model nema `updatedAt`) i fakture promijenjene poslije `since`.

### Mobilna aplikacija (Sprint 1–5)

- M-01 Prijava (`src/screens/LoginScreen.tsx`) — React Hook Form + Zod šema iz `shared`.
- M-03 Početna (`src/screens/HomeScreen.tsx`) — ukupno potraživanje + aging buckets iz `/reports/receivables`.
- M-04 Fakture (`src/screens/InvoicesScreen.tsx`) — lista sa brojem, kupcem, rokom, iznosom i statusom.
- M-11 Kupci (`src/screens/CustomersScreen.tsx`) — **offline-first**: lista iz lokalne SQLite baze, pretraga lokalno,
  pull/flush u pozadini; dodavanje radi bez mreže (lokalni upis + queue).
- **Offline sloj** (`src/db`, `src/sync`): op-sqlite (`customers`, `invoices`, `sync_queue`, `meta`),
  `pullAndMerge` (delta po `lastSyncAt`), `flushQueue` (push PENDING operacija, brisanje applied/duplicate,
  označavanje failed). Faktura ekran je za sada online-only.
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
| `pnpm test` | Vitest (shared, api) + Jest (mobile) — sekvencijalno po paketima |
| `pnpm build` | shared → api → web (mobile Gradle build nije u CI-ju) |
| `pnpm format` / `format:check` | Prettier |
| `pnpm db:*` | Docker baza, migracije, Prisma Studio |

## Testovi

- `packages/shared` — 45 testova: Zod šeme auth/company/customer/item/taxRate/invoice, numeracija,
  JIB, telefon, UUID v7, enumi, error envelope.
- `apps/api` — 73 testa: e2e auth, firma, kupci, IDOR, artikli, porezi, fakture (obračun, draft, filteri,
  DRAFT-only izmjena), fiskalizacija (izdavanje + numeracija bez rupa, PRAČUN 409, PDF, ESIR pad),
  naplata (djelimična/puna, preplata 400, DRAFT 409, IDOR), podsjetnici (default podešavanja, šablon,
  plan pri izdavanju, ručni SMS, plaćena faktura 409), izvještaji (aging, mjesečni),
  storno/refundacija (VOID zapis + broj, refund ≤ naplaćeno, kumulativno ograničenje, IDOR),
  worker (slanje podsjetnika, otkazivanje za plaćenu fakturu, fiskalni retry + backoff),
  **sync** (batch, idempotencija, failed bez rušenja batch-a, tuđi kupac, pull + `since`),
  unit testovi obračuna.
- `apps/mobile` — 18 testova: API klijent, kupci API, fakture API, auth store, sync engine (uuid v7, mapiranje rezultata).

E2E testovi koriste pravu bazu i Redis (CI ih diže kao service kontejnere) i `RATE_LIMIT_ENABLED=false`
da brojači ne bi uticali na tok testova.

Pokrivenost numeracije pri izdavanju, PDF-a i statusnih tranzicija dolazi u Sprintu 3 — §12.

## CI (`.github/workflows/ci.yml`)

GitHub Actions, Node 22, pnpm 10.34.9, **Postgres 16 + Redis 7** service:
`pnpm install --frozen-lockfile` → `prisma generate` → `prisma validate` → `prisma migrate deploy` →
`lint` → `typecheck` → `test` → `build` → `prisma migrate status`, plus `docker compose config`.

Android debug build je u CI-ju (`android` job: JDK 17 + Android SDK, `assembleDebug`, APK kao artifact).

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
12. **Fiskalizacija (Sprint 3):** adapter pattern; `ESIR_MODE=mock` do G0. Faktura je `ISSUED` samo poslije
    uspješnog ESIR odgovora; pad → `PENDING_FISCAL` + `fiscal_records(FAILED)` + 502. Retry radi worker
    (Sprint 5) sa backoff-om iz §7.5.
13. **PRAČUN se ne fiskalizuje** — `POST /invoices/:id/issue` vraća 409 za `ADVANCE`; konverzija PRAČUN → faktura
    je poseban tok (nema rute u §6).
14. **PDF:** `GET /invoices/:id/pdf` za sada **streamuje** PDF (`application/pdf`). §6 traži signed URL preko R2;
    to se uključuje kad budu R2 kredencijali (bez njih se ne može testirati).
15. **Preplata se odbija** (400): §7.8 traži `paid_fening ≤ total_fening`, a kredit kupca nema polje u §5.
16. **Šablon podsjetnika** koristi `{broj}`, `{iznos}`, `{rok}`, `{firma}`; `{broj}` i `{iznos}` su obavezni (§7.9).
17. **Automatski podsjetnici** se planiraju (`SCHEDULED`) pri izdavanju; slanje radi worker u Sprintu 5.
    Opt-out kupca nema polje u §5, pa se za sada ne može poštovati.
18. **VOID/REFUND su nova dokumenta** sa sopstvenim brojem i referencom; original se ne briše (§7.6–7.7).
19. **VOID/REFUND se ne fiskalizuju** dok operater ne definiše storno model (G0); refundacija ima jednu stavku
    sa stopom 0 (PDV tretman potvrditi sa računovođom).
20. **Worker** je odvojen proces (BullMQ 6, `upsertJobScheduler`): podsjetnici 60 s, fiskalni retry 5 min
    uz backoff iz §7.5; worker se ne pokreće u testovima (testira se direktno `scan()`).
21. **Sync:** `entityId` (UUID v7) je idempotency ključ; faktura se kroz sync samo **kreira** (DRAFT),
    izmjena ide kroz postojeće rute. Kupci se vraćaju svi (model nema `updatedAt`), fakture delta po `updatedAt`.
22. **Mobilni offline (Sprint 5):** kupci su lokal-first (op-sqlite + `sync_queue`), fakture i dalje online;
    `pullAndMerge` koristi `serverTime` kao sljedeći `since`, a neuspjeli push ostavlja red u queue-u.
23. **Web sesija (Sprint 6):** tokeni u httpOnly cookie-ju (ne localStorage); stranice su server komponente,
    PDF ide kroz proxy rutu jer API traži Bearer. Refresh rotacija na webu nije implementirana — istekao
    access token vodi na ponovnu prijavu (refresh cookie se čuva za kasnije).

## Otvorena pitanja (iz MASTER PROMPT-a, ne rješavati u kodu)

- **Numeracija:** odluka donesena i alokator implementiran pri izdavanju; ostaje da se potvrdi format
  sa računovođom/operaterom (prefix, dužina).
- **PFR/QR format** — mock je placeholder; pravi sadržaj zavisi od Pravilnika (95/25) i ESIR odgovora (G0).
- **R2 signed URL** — PDF se za sada streamuje; R2 upload dolazi uz kredencijale.
- **Retry queue** — worker postoji, ali `PENDING_FISCAL` stariji od 5 dana ostaje bez automatskog retryja
  (max 5 pokušaja) — potreban ručni ishod/alarm u Sentry (Sprint 6).
- **Opt-out podsjetnika** — nema polja na kupcu (§7.9 traži da se poštuje).
- **Kredit kupca pri preplati** — nema polja/tabele u §5; preplata se odbija.
- **Mobilni offline još nije verifikovan na uređaju** — op-sqlite i offline tok su implementirani i typecheck-ovani,
  ali nisu pokrenuti na Android emulatoru (nema JDK/SDK u ovom okruženju).
- **Faktura ekran je online-only** — offline kreiranje faktura (M-05) dolazi uz sync proširenje.
- **Web MVP nije kompletan** — W-01, W-02, W-03 i PDF (W-05) rade; W-04 editor, W-06 kupci, W-07 izvještaji
  i W-08 podešavanja tek slijede. Web nema automatizovane testove (Playwright dolazi uz W-04 tok).
- **`Idempotency-Key`** (§21) — nije implementiran za POST fakture/naplate.
- **Storno fiskalizacija** — VOID/REFUND zapisi nemaju PFR; zavisi od modela operatera (G0).
- **PDV tretman refundacije** — pojednostavljena jedna stavka sa stopom 0; potvrditi sa računovođom.
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
