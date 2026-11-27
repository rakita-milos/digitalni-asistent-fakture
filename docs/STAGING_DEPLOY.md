# Staging, deploy i backup — operativni runbook

> Verzija 1.1 · 23. 11. 2026. · Prati: `PLAN_DALJEG_RADA_v3.md` (T12-7/T12-8), `MASTER_PROMPT` §13/§21,
> `Pre-Deployment_Checklist`. Cilj: ponovljiv deploy bez improvizacije i dokaziv rollback.

## 1. Principi

- **Migracije su expand/contract** — nikad ne briši kolonu u istom release-u u kojem je prestaješ koristiti.
- **Backup prije svake migracije** — bez backup-a nema migracije na produkciji.
- **Deploy je redoslijed:** baza → API → worker → web. Nikad obrnuto.
- **Rollback aplikacije je uvijek moguć** (prethodna verzija); rollback baze nije — zato expand/contract.
- **Feature flagovi** (`FEATURE_FISCAL_ENABLED`, `FEATURE_SMS_ENABLED`, `FEATURE_ACCOUNT_DELETION`)
  služe da se rizična funkcija isključi bez deploya.
- Tajne samo u environment varijablama/secret manageru; nikad u repou.

## 2. Preporučena staging arhitektura

| Dio | Preporuka | Alternativa |
|---|---|---|
| Web (Next.js) | Vercel (instant rollback) | Docker na VPS |
| API + worker | Railway / Fly.io (dva procesa) | Docker na VPS (`docker compose`) |
| PostgreSQL | Neon (branch za staging + PITR) | Upravljani Postgres |
| Redis | Upstash (ili Redis Cloud) | Docker Redis sa AOF |
| PDF | Cloudflare R2 (`R2_*` env) | bez R2 → stream fallback |
| Monitoring | Sentry (`SENTRY_DSN`) | log-only (no-op) |

**Staging mora koristiti iste verzije** Node 22, pnpm 10.34.9 i iste env varijable kao produkcija
(osim tajni, domena i baze). Demo seed na stagingu je dozvoljen; na produkciji **ne**.

## 3. Env varijable po servisu

| Varijabla | API | Worker | Web | Napomena |
|---|---|---|---|---|
| `DATABASE_URL` | ✓ | ✓ | — | Neon staging branch |
| `REDIS_URL` | ✓ | ✓ | — | Upstash (TLS URL) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ✓ | ✓ | — | ≥ 32 nasumična bajta; rotirati po potrebi |
| `CORS_ORIGIN` | ✓ | — | — | tačan web domen, nikad `*` |
| `WEB_APP_URL` | ✓ | — | — | linkovi u e-mailovima |
| `PUBLIC_API_URL` | ✓ | — | — | linkovi u SMS/PDF porukama |
| `MAIL_PROVIDER` / `MAIL_FROM` | ✓ | — | — | `log` samo u dev/test |
| `SMS_PROVIDER=http` + `SMS_HTTP_URL` / `SMS_HTTP_TOKEN` / `SMS_SENDER_ID` | ✓ | ✓ | — | pravi provajder za staging; `log` u produkciji namjerno pada |
| `ESIR_MODE=mock` | ✓ | ✓ | — | do G0; `esir` namjerno pada |
| `FEATURE_*` | ✓ | ✓ | — | po potrebi isključiti rizično |
| `R2_*` | ✓ | — | — | opciono; bez njih stream fallback |
| `SENTRY_DSN` / `SENTRY_ENVIRONMENT` / `APP_RELEASE` | ✓ | ✓ | — | `APP_RELEASE` = commit SHA |
| `TRUST_PROXY` | ✓ | ✓ | — | `1` iza Railway/Fly proxy-ja; bez toga je rate limit globalan |
| `API_URL` / `NEXT_PUBLIC_API_URL` | — | — | ✓ | web → API |
| `NODE_ENV=production` | ✓ | ✓ | ✓ | obavezno na stagingu/produkciji |

Tajne u GitHub Secrets (ili provider secret store): `DATABASE_URL`, `REDIS_URL`, JWT tajne, SMS/R2/Sentry ključevi.

**Mobilni build:** `DA_API_URL` (repository variable) ide u `apps/mobile/src/app-config.json` kroz
`scripts/set-api-url.mjs`; za release mora biti `https://`. Vidi `docs/G12_EVIDENCE_PACK.md` §3.6.

## 4. Prvi deploy (redoslijed)

0. **Env provjera:** `pnpm staging:check --file .env.staging` — hvata localhost URL-ove, kratke JWT
   tajne, `CORS=*`, nedostajuće R2/SMS/Sentry i pogrešan `NODE_ENV` prije deploya. `--strict` pada
   i na upozorenjima.
1. **Baza:** kreiraj Neon branch `staging`; uzmi connection string (pooled za API, direct za migracije).
2. **Migracije:** `pnpm db:deploy` (iz CI-ja ili lokalno sa staging `DATABASE_URL`).
   Provjeri: `pnpm --filter api exec prisma migrate status`.
3. **API:** deploy sa env varijablama; health `curl -fsS https://api-staging.<domen>/health`.
4. **Worker:** isti image, komanda `node dist/worker.js`; provjeri log „Worker pokrenut“.
5. **Web:** deploy sa `API_URL` na staging API; prijava demo nalogom.
6. **Smoke:** sekcija 8.
7. **Sentry:** pošalji testnu grešku (npr. privremeno pokvaren endpoint) i provjeri da stiže sa request-id.
8. **Backup:** uključi Neon PITR + dnevni dump (sekcija 6); uradi **probni restore**.

### 4.1 Docker deploy (self-hosted ili lokalna proba)

Za VPS/self-hosted, ili da se sve provjeri prije nego se potroše cloud nalozi:

```bash
cp infra/.env.production.example .env          # popuni JWT_* i lozinke
docker compose -f infra/docker-compose.prod.yml build
docker compose -f infra/docker-compose.prod.yml up -d
docker compose -f infra/docker-compose.prod.yml logs -f migrate api worker
```

- Image: `apps/api/Dockerfile` (API + worker; migracije idu kroz `migrate` servis).
- Compose podiže Postgres/Redis za self-hosted; za Neon/Upstash obriši ta dva servisa i postavi
  `DATABASE_URL`/`REDIS_URL`.
- Redoslijed je ugrađen: `postgres` healthy → `migrate` uspješno završi → `api`/`worker`.
- Health: `docker compose ps` (api „healthy“) i `curl -fsS http://localhost:3001/health`.
- Seed (samo staging/proba): `docker compose exec -T -e SEED_RESET=1 api pnpm --filter api exec prisma db seed`.

**Nađeno u probi 23. 11.:** worker je padao na `R2StorageService` jer `WorkerModule` nije importovao
`StorageModule` (globalni modul mora biti importovan u korijenu procesa). Popravljeno; log sada pokazuje
„Worker pokrenut: podsjetnici (60 s) + fiskalni retry (5 min)“.

## 5. Rutina za svaki release

1. CI zelen na `main` (**5/5**: verify, compose, android, integracije, e2e).
2. **Backup** baze prije migracija (§6.1).
3. `pnpm db:deploy` — migracije **prije** aplikacije.
4. Deploy API → worker → web (isti commit; `APP_RELEASE` = SHA).
5. Smoke (§8) + 30 min praćenja: 5xx, p95, queue backlog, fiscal fail, SMS fail.
6. Ako nešto pukne: rollback aplikacije na prethodni deployment, isključi feature flag, tek onda analiza.

## 6. Backup i restore

### 6.1 Dnevni backup

- Neon PITR: uključen retention (npr. 7 dana) — primarni mehanizam.
- Logički dump → R2 (dnevno, cron/CI) — skripta radi dump, provjeru i upload:

```bash
# na staging/produkciji (pg_dump na hostu)
pnpm backup:db -- --url="$DATABASE_URL" --out=/var/backups/da --upload --keep=30

# lokalno (PostgreSQL u Dockeru)
pnpm backup:db -- --docker=digitalni-postgres --user=digitalni --db=digitalni_asistent
```

Skripta: `pg_dump -Fc` → provjera `pg_restore -l` (mora imati objekte) → opcioni R2 upload
(`backups/db/backup-<timestamp>.dump`, SSE AES256) → lokalna retencija. Nikad ne ispisuje URL ni lozinke.

**Provjereno 25. 11.:** upload grana protiv lokalnog S3 servera (`R2_ENDPOINT=http://127.0.0.1:9010`,
`R2_FORCE_PATH_STYLE=true`): dump **54,8 KB** uploadovan, `GET` vraća **200** iste veličine.
Za MinIO/lokalni S3 koristi `R2_ENDPOINT` + `R2_FORCE_PATH_STYLE=true`; pravi Cloudflare R2 ostaje
za G12 (kredencijali).

Ručni fallback ako skripta nije dostupna:

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --file="backup-$(date +%F).dump"
aws s3 cp "backup-$(date +%F).dump" \
  "s3://$R2_BUCKET/backups/db/backup-$(date +%F).dump" \
  --endpoint-url "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"
```

- Retencija: 30 dnevnih + 12 mjesečnih; dumpovi šifrovani (R2 SSE) i bez javnog pristupa.
- **Automatizacija:** `.github/workflows/backup.yml` — svaki dan u 02:00 UTC (i ručno) radi
  `pg_dump` → R2 + artifact `db-backup` (14 dana). Traži secrets `BACKUP_DATABASE_URL` (direktna,
  ne-pooled veza), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`;
  bez njih job preskoči uz upozorenje.
- **Backup koji nije testiran nije backup** — restore drill obavezan prije pilota i poslije svake promjene šeme.

### 6.2 Restore drill (u staging)

**Automatski (preporučeno):**

```bash
# lokalno protiv Docker Postgresa — pravi privremenu bazu, restore, poredi brojeve, briše bazu
pnpm backup:restore-drill -- --dump=.tools/backups/backup-....dump \
  --docker=digitalni-postgres --user=digitalni --db=digitalni_asistent

# staging: prazna baza (npr. Neon branch); ime baze mora sadržavati restore/drill/staging
RESTORE_DATABASE_URL=postgresql://... \
pnpm backup:restore-drill -- --dump=backup.dump \
  --restore-url="$RESTORE_DATABASE_URL" --source-url="$STAGING_DATABASE_URL" --yes
```

Skripta poredi 11 tabela (`companies`, `users`, `customers`, `items`, `tax_rates`, `invoices`,
`invoice_lines`, `payments`, `reminders`, `fiscal_records`, `audit_log`), mjeri trajanje i pada
ako se brojevi ne poklapaju ili trajanje pređe `--max-seconds` (default 1800 s).

**Ručno (ako skripta nije dostupna):**

1. Uzmi zadnji dump (ili Neon restore u novi branch).
2. Restore u **praznu** staging bazu:

```bash
pg_restore --clean --if-exists --no-owner -d "$STAGING_DATABASE_URL" backup-YYYY-MM-DD.dump
```

3. Provjeri integritet:

```sql
SELECT
  (SELECT count(*) FROM companies) AS companies,
  (SELECT count(*) FROM invoices) AS invoices,
  (SELECT count(*) FROM fiscal_records) AS fiscal,
  (SELECT count(*) FROM audit_log) AS audit;
```

4. Uporedi sa produkcijom (red veličine) i pokreni smoke (§8) na stagingu.
5. Zabilježi trajanje restore-a (RTO) i eventualne greške u PROGRESS.

**Ciljevi:** RPO ≤ 24 h (PITR bolje), RTO ≤ 30 min (G12), najviše 60 min. Restore se **nikad** ne radi
direktno na produkciju bez odobrenja i prethodnog backup-a.

### 6.3 Rollback

| Scenario | Postupak |
|---|---|
| Web regresija | Vercel „Instant Rollback“ na prethodni deployment |
| API/worker regresija | redeploy prethodnog image-a/commit-a (ista env) |
| Migracija pukla | zaustavi deploy, `prisma migrate resolve` za neuspjelu migraciju, restore iz backup-a ako je šema oštećena |
| Fiskalizacija/SMS problem | isključi `FEATURE_FISCAL_ENABLED`/`FEATURE_SMS_ENABLED` (503 + jasna poruka) |
| Baza nedostupna | Neon failover/restore; API vraća 5xx — uključi status stranicu |

**Lokalna vježba mehanizma (25. 11. 2026.):** na compose stacku (`TAG=drill-good`, port 3101)
simuliran je loš deploy (API sa pogrešnim `DATABASE_URL` na istom portu):
detekcija nezdravog stanja **1,3 s** (connection refused), rollback na prethodni image
(`docker compose up -d api`) **7,0 s** do `200 /health`, poslije toga smoke **8/8 (615 ms)**.
Ovim je dokazan mehanizam zamjene image-a; **prava vježba na stagingu** (uz pravi prethodni
release i praćenje 5xx/p95) ostaje za T13-6.

## 7. Bezbjednost deploya

- `NODE_ENV=production`; cookie `secure`; CORS samo tačan domen.
- Rate limiting uključen (`RATE_LIMIT_ENABLED=true`) — Redis mora biti dostupan (fail-closed).
- Bez `.env` u repou; tajne rotirati nakon curenja i po osobi koja ode.
- Migracije i seed: seed **samo** na stagingu; produkcija kreće prazna + setup wizard.
- Sentry: provjeri da nema PII u tagovima (šalju se request-id/ruta/status).

## 8. Smoke checklist (5 min, staging i produkcija)

### 8.1 Automatski smoke (obavezno poslije svakog deploya)

```bash
STAGING_API_URL=https://api-staging.<domen> \
SMOKE_EMAIL=smoke@<domen> \
SMOKE_PASSWORD='<lozinka>' \
pnpm smoke:staging          # ili: node tools/staging-smoke.mjs --json
```

Workflow [`.github/workflows/staging-smoke.yml`](../.github/workflows/staging-smoke.yml) pokreće isti
tok svakog ponedjeljka (06:00 UTC) i ručno; traži secrets `STAGING_API_URL`, `SMOKE_EMAIL`,
`SMOKE_PASSWORD`, a bez njih preskoči uz upozorenje. Rezultat se čuva kao artifact `staging-smoke`.

Skripta provjerava **8 stvari**: `/health` (baza + Redis), prijava, kupci, lista faktura, detalj,
PDF (302 na R2 signed URL sa `X-Amz-Expires ≤ 900`, ili stream `%PDF`), kreiranje drafta i izdavanje
(mock) sa PFR-om. Exit kod je 1 na prvi pad, `--json` daje mašinski čitljiv izlaz za CI.

Napomena: skripta kreira jednu DRAFT→ISSUED fakturu sa napomenom „SMOKE TEST“ na demo firmi —
to je namjerno i vidljivo u staging podacima. `--no-create` preskače kreiranje (samo čitanje + PDF).
Ne ispisuje e-mail, lozinku ni tokene.

### 8.2 Ručna checklista

- [ ] `GET /health` → `{ status: "ok" }`
- [ ] Prijava demo/vlasnik nalogom; cookie postavljen
- [ ] Kreiranje kupca i fakture; izdavanje (mock) → PFR/QR
- [ ] PDF 200 (`%PDF`) preko web proxy rute
- [ ] Naplata (puna/djelimična) i status fakture
- [ ] Ručni podsjetnik (SMS log/provajder) i lista podsjetnika
- [ ] Izvještaji (aging, mjesečni)
- [ ] GDPR izvoz (JSON) radi
- [ ] Sentry testna greška stiže sa request-id
- [ ] Worker log: podsjetnici + fiskalni retry rade

## 9. Šta treba prije prvog staging deploya

- [x] GitHub repo + CI zelen (**5/5**, run 44959718369; Sprint 12B dodao provjeru Play materijala)
- [ ] Neon/Upstash/Vercel (ili VPS) nalozi i pristupi
- [ ] Domen/subdomeni: `app-staging.<domen>`, `api-staging.<domen>`
- [ ] Sentry projekat + DSN (API i web)
- [ ] R2 bucket + ključevi (opciono; bez njih stream)
- [ ] SMS provajder testni kredencijali
- [ ] Odluka o backup retenciji i vlasniku restore drill-a
