# Security audit — zavisnosti (T13-5)

> Datum: 21. 11. 2026. · Alat: `pnpm audit` (pnpm 10.34.9) · Scope: sve workspace pakete
> (`shared`, `config`, `api`, `web`, `mobile`) + root.
> Ovaj dokument je dokaz za T13-5 („0 P1, P2 planiran“); nije zamjena za pentest.

## 1. Rezultat

| Skup | Prije | Poslije (override-i) |
|---|---|---|
| **Produkcija** (`--prod`) | 34 (16 high, 14 moderate, 4 low) | **6 (0 high, 0 critical, 4 moderate, 2 low)** |
| **Sve** (uključujući dev) | 46 (2 critical, 19 high, 20 moderate, 5 low) | **13 (2 critical, 0 high, 9 moderate, 2 low)** |

**P1 (kritično/visoko u produkciji): 0.** Preostala 2 critical su isključivo dev (`vitest>tinypool`).

## 2. Override-i (root `package.json` → `pnpm.overrides`)

Ciljano samo ranjivi rasponi, bez major skokova gdje nije bilo sigurno:

| Paket | Prije | Sada | Zašto |
|---|---|---|---|
| `multer` | 2.0.2 | **2.5.0** | 4× DoS (multipart) — runtime kroz `@nestjs/platform-express` |
| `body-parser` | 1.20.4 | **1.20.9** | DoS trailing bytes |
| `qs` | 6.14.x | **6.17.1** | 4× DoS u query parsiranju (Express) |
| `lodash` | 4.17.21 | **4.18.1** | code injection kroz `_.template` (Swagger UI) |
| `js-yaml` | 4.1.0 | **4.3.2** | 3× ReDoS (Swagger) |
| `postcss` | 8.4.31 | **8.5.33** | path traversal / file read (Next build) |
| `picomatch` | 4.0.1 | **4.0.7** | ReDoS |
| `glob` | 10.4.5 | **10.5.0** | CLI command injection (Nest CLI, dev) |
| `tmp` | 0.0.33 | **0.2.7** | path traversal (dev alati) |
| `deepmerge-ts` | 7.1.5 | **8.0.2** | stack exhaustion (Prisma CLI config) |
| `effect` | 3.21.0 | **3.22.5** | ReDoS (Prisma CLI config) |

Poslije override-a provjereno: `prisma validate` ✅, `prisma migrate status` ✅ (7 migracija, up to date).

## 3. Verifikacija poslije override-a (21. 11. 2026)

- `pnpm lint` 5/5, `pnpm typecheck` 5/5, `pnpm build` 3/3
- Testovi: **333** — api **168/168**, web **17/17**, shared 51, mobile **97/97**
- Playwright e2e **9/9** (49,4 s)
- `pnpm audit --prod` → 0 high/critical

## 4. Prihvaćeni rizici (P2, planirano)

| Nalaz | Severity | Zašto ostaje | Plan |
|---|---|---|---|
| `tinypool` (vitest) | critical (dev) | vitest 3 zahtijeva `tinypool@^1`; patch je u 2.x (major). Rizik samo ako neko kontroliše worker opcije u testovima — CI pokreće naš kod | upgrade vitest na 5.x u Sprintu 13/14 (zaseban PR, provjeriti `maxForks`/config) |
| `@nestjs/core` | moderate | patch je u Nest **11.1.18+**, mi smo na 10.4.22; major upgrade | Nest 11 upgrade poslije pilota (zajedno sa `@nestjs/swagger`) |
| `file-type` ×2 | moderate | `@nestjs/common` 10 koristi 20.x; patch je 21.3.2 (major). Aplikacija **nema upload ruta** (nijedan `FileInterceptor`) | nestaje sa Nest 11 |
| `vitest`/`@vitest/mocker` | moderate (dev) | path traversal/code injection kroz mock — dev alat | uz vitest 5 |
| `ajv`, `glob`, `minimatch` | moderate (dev) | Nest CLI / typescript-eslint | uz CLI/tooling upgrade |
| `webpack` ×2 | low | `@sentry/node` bundler plugin, build-time | prati Sentry SDK |

Napomena: `file-type` i `@nestjs/core` su jedina dva produkciona moderate nalaza; oba se zatvaraju
Nest 11 upgrade-om i nemaju poznat put napada u našem API-ju (nema upload-a, nema dinamičkog
`@nestjs/core` izvršavanja).

## 5. Provjere tajni i konfiguracije

- Skeniranje repoa (`AKIA…`, `ghp_…`, `sk_live_…`, `xox…`, `-----BEGIN … PRIVATE KEY-----`):
  **1 pogodak** — `AKIAIOSFODNN7EXAMPLE` u `r2-storage.service.spec.ts`, AWS dokumentacijski primjer
  (nije tajna).
- U gitu su samo `.env.example` fajlovi; `.env` je u `.gitignore` i nije commitovan.
- CORS: `origin: false` kad je prazno, inače lista iz `CORS_ORIGIN` (nikad `*`).
- Rate limit: uključen (`RATE_LIMIT_ENABLED=true`), Redis brojači; e2e test na stvarnom Redis-u.
- `x-request-id` na svakom odgovoru; Sentry tagovi bez PII.

## 6. Kako ponoviti

```bash
pnpm audit --prod            # P1/P2 pregled za produkciju
pnpm audit                   # uključuje dev alate
pnpm lint && pnpm typecheck && pnpm build && pnpm test
```

Prije svakog release-a: ponoviti audit, upisati rezultat ovdje (datum + brojevi), i ne dizati
override-e bez provjere `prisma validate` + testova.
