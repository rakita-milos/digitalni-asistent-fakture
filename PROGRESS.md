# PROGRESS — Digitalni Asistent

> Ovaj fajl je „memorija“ projekta između chatova. Ažurira se na kraju svake sesije.
> Na početku svakog novog chata se prilaže uz MASTER PROMPT.
> Repo: `digitalni-asistent/` (u ovom folderu) · GitHub: <https://github.com/rakita-milos/digitalni-asistent-fakture> (grana `main`).

## Trenutni sprint

**Sprint 12 — release engineering** (od 2026-11-16, u toku). CI je zelen **5/5** i APK artifact
postoji; web Sentry instrumentacija (T12-4) i generički SMS HTTP adapter (T12-6) su urađeni.
**Sprint 12B (23. 11.) je završen:** javne pravne stranice, CI job za AAB, staging smoke skripta,
Play screenshotovi i osvježen audit. **G14 priprema je završena 23. 11.** (alati za status i sedmični
izvještaj, onboarding/NPS/trijaža/exit dokumenti; popravljena `metrics:platform` skripta), ali
**pilot nije počeo** — čeka G12/G13. Sledeće: **G12** — Sentry DSN, R2, SMS, staging, restore i
matrica na 3 uređaja; dokazni paket: `docs/G12_EVIDENCE_PACK.md`. Plan: `PLAN_DALJEG_RADA_v3.md`.

### Sprint 12 — release engineering (2026-11-16, u toku)

- [x] **T12-1a GitHub repo + push** — `rakita-milos/digitalni-asistent-fakture` (public), grana `main`,
      57 commita; `origin` postavljen; CI workflow se pokreće na push.
- [x] **T12-1b Priprema CI** — Gradle i Playwright cache, android timeout 60 min, `NODE_OPTIONS=4096`,
      linkovi `react-native`/`@react-native` za pnpm hoisted (commit `70748fb`).
- [x] **T12-1c Prvi CI run** — [run 43959555434](https://github.com/rakita-milos/digitalni-asistent-fakture/actions/runs/43959555434):
      `verify` ✅, `compose` ✅, `e2e` ✅, `android` ❌ na `android-actions/setup-android@v3` (prije
      projekta) → zamijenjen preinstaliranim SDK-om sa runnera (`a936d75`).
- [x] **T12-1d Drugi CI run — sve zeleno** —
      [run 43966968476](https://github.com/rakita-milos/digitalni-asistent-fakture/actions/runs/43966968476)
      (8 min 43 s): `verify` ✅ 2:29, `e2e` ✅ 1:26 (9/9), `compose` ✅ 0:06, `android` ✅ 8:38.
- [x] **T12-1e Treći run (docs) + branch protection** — [run 43971628594](https://github.com/rakita-milos/digitalni-asistent-fakture/actions/runs/43971628594)
      ✅; `main` zaštićen: obavezni status checkovi (`verify`, `e2e`, `android`, `compose`), strict up-to-date,
      force-push i brisanje zabranjeni.
- [x] **T12-1f Run poslije refresh fixa — sve zeleno** —
      [run 43985242472](https://github.com/rakita-milos/digitalni-asistent-fakture/actions/runs/43985242472):
      `verify` ✅ (**320 testova**), `e2e` ✅ 9/9, `android` ✅ (novi APK), `compose` ✅.
- [x] **T12-1g Run poslije T12-4/T12-6 — sve zeleno** —
      [run 44935671851](https://github.com/rakita-milos/digitalni-asistent-fakture/actions/runs/44935671851)
      (~7 min, push `f11ace4`): `verify` ✅ (lint/typecheck/**332 testa**/build), `e2e` ✅, `android` ✅
      (APK **51.466.880 B**), `compose` ✅. Isti dan i [run 44937857283](https://github.com/rakita-milos/digitalni-asistent-fakture/actions/runs/44937857283)
      (docs, `df1c7e9`) ✅ 4/4 i [run 44948453986](https://github.com/rakita-milos/digitalni-asistent-fakture/actions/runs/44948453986)
      (`318db87`: SMS fix + integracione skripte) ✅ 4/4 i
      [run 44957355719](https://github.com/rakita-milos/digitalni-asistent-fakture/actions/runs/44957355719)
      (`80f1bcb`: novi **`integracije`** job) ✅ **5/5** — provjere R2/SMS/Sentry sada idu na svaki push
      (job ~2 min, ukupno ~10 min); i [run 44958363463](https://github.com/rakita-milos/digitalni-asistent-fakture/actions/runs/44958363463)
      (docs, `e1cb70b`) ✅ 5/5.
- [x] **T12-2 APK artifact** — `digitalni-asistent-debug-apk`, **51.466.876 B (~49 MB)**; preuzet lokalno
      i instaliran na emulator (vidi T12-3).
- [x] **T12-3 (dio) Test na Android emulatoru (Android 17 / API 37)** — APK instaliran i pokrenut:
      prijava demo nalogom ✅, početna sa aging-om (3247,41 KM / 35 faktura) ✅, lista faktura (50) ✅,
      detalj fakture sa **PFR + QR kodom** ✅, **slanje fakture e-mailom** (log adapter) ✅,
      ekran **Nalog** (profil + promjena lozinke) ✅; na uređaju bez biometrije dugme za biometriju se
      ne prikazuje (očekivano, odluka 25). **Nađen P1 bug:** access token (15 min) nije imao refresh u
      mobilnom klijentu — poslije 15 min svaki zahtjev pada sa „Neispravan ili istekao access token“.
      **Popravljeno:** `apiRequest` na 401 radi single-flight `/auth/refresh`, upiše novu sesiju u Keychain
      i ponovi zahtjev; 4 nova testa (mobile **97/97**). Fizička 3 uređaja još nisu testirana.
- [x] **T12-8 (dio) Backup/restore drill lokalno** — `pg_dump -Fc` (48,9 KB) → `pg_restore` u `da_restore`
      za **3,7 s**; brojevi identični (50 faktura, 20 kupaca, 10 artikala, 2 firme); restore baza obrisana.
      Staging restore (Neon/PITR) čeka nalog.
- [x] **T12-4 (dio) Web Sentry instrumentacija** — `apps/web/instrumentation.ts` (`register` i
      `onRequestError`, samo Node runtime) + 4 Vitest testa; `@sentry/node` u `serverExternalPackages`;
      serverske greške nose `request_id`/`http_path`/`route` tagove; bez DSN-a no-op. Commit `f11ace4`.
      **Provjereno lokalno (21. 11.):** kompajlirana Next instrumentacija šalje envelope na lokalni
      kolektor sa tagovima i release-om (`tools/local-integration/verify-sentry.mjs`, 4/4).
      DSN, alarmi i provjera testne greške čekaju nalog.
- [x] **T12-5 (dio) R2 signed URL** — protiv lokalnog S3 servera: PDF ruta vraća **302** na presigned
      URL (`X-Amz-Signature`, `X-Amz-Expires=900`), objekat se servira kao PDF (~29 KB), drugi poziv
      radi `HEAD` bez novog uploada, a bez R2 env PDF se **streamuje** (200, bez `Location`). Skripte u
      `tools/local-integration/`. Bucket/ključevi i provjera isteka potpisa na stvarnom R2 čekaju nalog.
- [x] **T12-6 (dio) Generički SMS HTTP adapter** — `SmsService` režim `http`: JSON POST na `SMS_HTTP_URL`
      (`{ to, message, sender }`), `Authorization: Bearer` (`SMS_HTTP_TOKEN`/`SMS_API_KEY`), sender ID,
      timeout 1–15 s, greška nosi samo HTTP status (bez tijela odgovora); +9 unit testova (prazan
      `SMS_PROVIDER` se tretira kao `log`). Commit `f11ace4`. **End-to-end (21. 11.):** OTP (6 cifara) i
      ručni podsjetnik stižu na lokalni SMS endpoint sa sender ID `DA` i Bearer tokenom
      (`verify-integrations.mjs`, 15/15). Izbor provajdera, kredencijali i test na 2 broja čekaju.
- [x] **Verifikacija (21. 11. 2026, lokalno)** — `pnpm lint` 5/5, `pnpm typecheck` 5/5,
      `pnpm --filter web build` exit 0 (instrumentation kompajliran), **333 testa** (shared 51, api 168,
      web 17, mobile 97), `prisma migrate deploy` (7 migracija, no pending), integracije
      **15/15 + 4/4** (commitovi `7d9846a` i `318db87`). Playwright e2e nije ponovno pokretan —
      nema izmjena u web rutama.
- [ ] **T12-4 Sentry DSN**, **T12-5 R2 ključevi**, **T12-6 SMS provajder**, **T12-7 staging** — čekaju
      naloge; T12-3 (fizički uređaji) i T12-8 (staging) čekaju opremu/naloge
- [x] **Go-live runbook integracija** — `docs/INTEGRATIONS_GO_LIVE.md`: tačne komande i provjere za
      Sentry DSN, R2, SMS, staging i restore, sa rollback-om i tabelom dokaza (pokriva T12-4/5/6/7/8).
- [ ] **Plan v3.0 (23. 11.)** — G12 pomjeren na **30.11.** (2/8 uslova: CI i APK); četiri kod-rupe
      (pravne stranice, AAB job, staging smoke, Play screenshotovi) idu u **Sprint 12B** i ne čekaju
      naloge. Detalji: `PLAN_DALJEG_RADA_v3.md`.

### Sprint 12B — kod do kapije (2026-11-23, završen)

Cilj: zatvoriti kod-rupe koje ne čekaju naloge. **Sve provjere lokalno zelene.**

- [x] **S12B-1 Javne pravne stranice** — `/privacy` i `/terms` (`apps/web/app/(legal)/`,
      `components/legal-document.tsx`, tekst u `lib/legal.ts`, verzija 1.0 · 23.11.2026.);
      linkovi na prijavi, u `(app)` podnožju i na mobilnom ekranu **Nalog**; `config.ts` dobio
      `PRIVACY_URL`/`TERMS_URL`. Testovi: `lib/legal.test.ts` (8) + `e2e/legal.spec.ts` (3) +
      `config.test.ts` (2). Placeholderi `<...>` ostaju vidljivi do pravnika.
- [x] **S12B-2 CI job za AAB** — `.github/workflows/ci.yml` job **`android-release`**
      (`bundleRelease`, artifact `digitalni-asistent-aab`, `workflow_dispatch` + tag `v*`,
      guard `allow_debug_signing`); `versionName "1.0.0"` (code 1); uputstvo u `docs/PLAY_RELEASE.md`
      §2. Bez `DA_*` secrets AAB je debug-potpisan (samo dokaz pipeline-a).
- [x] **S12B-3 Staging smoke** — `tools/staging-smoke.mjs` + `pnpm smoke:staging`: 8 provjera
      (health, prijava, kupci, fakture, detalj, PDF 302/stream, draft, izdavanje + PFR), `--json`,
      `--no-create`, bez PII u logu; uputstvo u `docs/STAGING_DEPLOY.md` §8.1.
      **Lokalno: 8/8 za 1,0 s** (Postgres 16 + Redis 7 + API + demo seed).
- [x] **S12B-4 Play screenshotovi** — 5 snimaka u `apps/mobile/assets/screenshots/`
      (1080×2160, 2:1; prijava, fakture, detalj, naplata, nalog) + `tools/check-play-assets.mjs`
      (`pnpm check:play`, u CI `verify`); feature graphic pretvoren u 24-bit PNG.
- [x] **S12B-5 Osvježen audit** — `docs/PRE_DEPLOYMENT_AUDIT.md` v1.2: **24 ✅ / 7 ⚠️ / 0 ❌**
      (31 stavka); `docs/SECURITY_AUDIT.md` v2: produkcija **8 nalaza (4 moderate, 4 low), 0
      high/critical** (advisory baza narasla: webpack ×2 low, minimatch moderate).
- [x] **Verifikacija (23. 11., lokalno)** — `pnpm lint` 5/5, `pnpm typecheck` 5/5, `pnpm build` 3/3,
      **343 testa** (shared 51, api 168, web 25, mobile 99), Playwright **e2e 12/12** (14,6 s),
      `pnpm check:play` OK, `pnpm audit --prod` 0 high/critical, `prisma migrate deploy` (7 migracija).
- [ ] **Push + CI run** — commit je lokalni; `git push` u ovoj sesiji nije prošao jer nema GitHub
      kredencijala (`gh` nije prijavljen). Pokrenuti push i provjeriti CI 5/5 + `android-release`.

### Sprint 13 — store i pravni paket (u pripremi, 2026-11-21)

- [x] **T13-5 (dio) Security/quality pass** — `pnpm audit`: produkcija **0 high/critical** (34 → **6**
      nalaza; ukupno 46 → 13) kroz 11 ciljanih `pnpm.overrides` (multer, body-parser, `qs`, lodash,
      js-yaml, postcss, picomatch, glob, tmp, deepmerge-ts, effect). Poslije override-a: lint 5/5,
      typecheck 5/5, build 3/3, **333 testa**, e2e 9/9, `prisma validate` i `migrate status` ✅.
      Prihvaćeni P2 (planirano): tinypool (dev, vitest 3), `@nestjs/core` i `file-type` (Nest 11),
      vitest/mocker (dev) — detalji u `docs/SECURITY_AUDIT.md`. Tajne: samo AWS primjer u spec-u;
      `.env` nije u gitu. Commitovi `8c01c07` (override-i) i `fef5461` (dokumentacija);
      [CI run 44955731509](https://github.com/rakita-milos/digitalni-asistent-fakture/actions/runs/44955731509)
      ✅ 4/4 (frozen lockfile prošao).
- [ ] **T13-1…T13-4, T13-6** — čekaju brend/package, keystore, pravnika i Play Console.

### Release priprema 2 (2026-11-25)

Nastavak po planu bez novih korisnikovih naloga; sve provjere su ponovljive.

- [x] **Preflight spremnosti** — `pnpm release:preflight` (`tools/release/preflight.mjs`):
      provjerava Sentry DSN, R2 ključeve, SMS provajder, staging URL/bazu, keystore, verziju,
      pravne stranice, Play materijal i (opciono `--devices`) povezane telefone. Ne ispisuje tajne;
      `--json`, `--strict`. **Stanje 25. 11.: 5/13 spremno**; blokiraju Sentry, R2, SMS, staging,
      uređaji i keystore.
- [x] **CI Docker job** — `docker` job (workflow_dispatch i tag `v*`): build API/worker image →
      `prisma migrate deploy` iz image-a → demo seed → `/health` → worker start. Time se Dockerfile
      provjerava u CI-ju, ne samo lokalno.
- [x] **Dnevni backup workflow** — `.github/workflows/backup.yml`: cron 02:00 UTC + ručno;
      `pg_dump` → R2 + artifact `db-backup` (14 dana); bez secrets preskače uz upozorenje.
- [x] **Engleski listing** — `docs/PLAY_LISTING.en.md` (naziv, kratki/puni opis, Data Safety i
      content rating na engleskom, checklist) + link u `PLAY_RELEASE.md`.
- [x] **Provjere** — `preflight` 5/13 (očekivano — nema naloga), `check-signing` OK (nema keystore
      → debug potpis), YAML oba workflowa validan.
- [x] **CI validacija novih jobova** — ručni `ci.yml` dispatch
      ([run 23](https://github.com/rakita-milos/digitalni-asistent-fakture/actions/runs/45582414195),
      commit `481a70a`): **svih 7 jobova zeleno**, uključujući novi
      **`docker image (API + worker)`** (build → migracije → seed → `/health` → worker start) i
      `android release AAB`. `backup.yml` ručno pokrenut
      ([run 1](https://github.com/rakita-milos/digitalni-asistent-fakture/actions/runs/45582417420)):
      zelen, preskočio backup uz upozorenje jer secrets nisu postavljeni (očekivano ponašanje).
      Push run #22 je otkazan jer ga je dispatch (isti ref) preuzeo kroz concurrency — nije pad.
- [x] **Staging smoke workflow** — `.github/workflows/staging-smoke.yml`: ponedjeljkom 06:00 UTC i
      ručno; iste 8 provjera kao `pnpm smoke:staging`, artifact `staging-smoke`. Bez secrets
      preskače uz upozorenje — ručno pokrenut
      ([run 1](https://github.com/rakita-milos/digitalni-asistent-fakture/actions/runs/45591926987))
      **zelen**.
- [x] **Audit refresh (25. 11.)** — `pnpm audit`: produkcija **8 nalaza (4 moderate, 4 low), 0
      high/critical**; sve **16 (2 critical dev-only, 10 moderate, 4 low)** — nepromijenjeno u odnosu
      na 23. 11. (`SECURITY_AUDIT.md` ažuriran datumom).
- [x] **Sedmični Docker build** — `ci.yml` dobio `schedule` (ponedjeljak 03:00 UTC): tada se
      izvršava samo `docker` job (build image → migracije → seed → `/health` → worker), ostali se
      preskaču. Time se hvata drift baznog image-a i zavisnosti bez trošenja minuta na svaki push.
      `preflight` je dodat u `verify` (informativno, ne pada bez naloga).
- [x] **Rollback vježba (lokalno)** — compose stack `TAG=drill-good` na portu 3101; simuliran loš
      deploy (pogrešan `DATABASE_URL` na istom portu): detekcija **1,3 s**, rollback na prethodni
      image **7,0 s** do `200 /health`, smoke poslije rollbacka **8/8 (615 ms)**. Mehanizam dokazan;
      prava vježba na stagingu ostaje za T13-6.
- [x] **Pilot dry-run (2 sintetičke firme)** — `pnpm pilot:dryrun` prošao kroz registraciju, EFD,
      porez, artikal, kupca, fakturu sa 2 stavke, izdavanje, PDF, naplatu, podsjetnik i setup-complete:
      **22/22 koraka**, oba naloga očišćena (**2/2**), vrijeme do prve fakture **0,6 s / 0,4 s**
      (API, bez UI). Izvještaj: `docs/pilot/reports/DRYRUN-2026-11-25.md`. **Nalaz:** podsjetnik
      traži telefon kupca — dodato u onboarding skriptu.
- [x] **Backup upload grana provjerena** — `pnpm backup:db --upload` protiv lokalnog S3 servera
      (`R2_ENDPOINT`, `R2_FORCE_PATH_STYLE=true`): dump **54,8 KB** uploadovan u `backups/db/…`,
      `GET` vraća **200** iste veličine. Pravi Cloudflare R2 čeka ključeve (G12).
- [ ] **Blokada** — nema Sentry/R2/SMS kredencijala, staging naloga, keystore-a ni 3 telefona.
      Ako ne stignu do **27.11.**, po pravilu klizanja: **G12 7.12., G13 14.12., pilot 15.12.–12.1.,
      G14 18.1.2027.**

### G12 dokazni paket (2026-11-25)

Cilj: kapija se izvršava bez improvizacije kad nalozi i telefoni stignu.

- [x] **CI #30 zelen na HEAD `9d9e72a`** — 5/5 izvršenih jobova (`verify`, `e2e`, `integracije`,
      `android debug`, `compose`); `android-release` i `docker` preskočeni po dizajnu (samo
      `workflow_dispatch`/tag). [run 45605101499](https://github.com/rakita-milos/digitalni-asistent-fakture/actions/runs/45605101499).
- [x] **Lokalna provjera 25. 11.** — `lint` 5/5, `typecheck` 5/5, `build` 3/3. Testovi lokalno nisu
      izvršeni: sandbox blokira `spawn` (esbuild/Prisma `EPERM`), pa se brojevi testova uzimaju iz
      CI-ja (posljednje **343**, 23. 11.).
- [x] **`docs/G12_EVIDENCE_PACK.md`** — 8 uslova kapije sa tačnim komandama i dokazima, matrica
      **3 uređaja / 15 scenarija** i sign-off tabela; jedini izvor za G12 pregled.
- [x] **Mobilni API URL nije više hardkodiran (26. 11.)** — `src/app-config.json` +
      `scripts/set-api-url.mjs` (`DA_API_URL`; `--release` zahtijeva https); release build odbija
      `10.0.2.2`/localhost, a CI `android` i `android-release` upisuju URL iz repository variable.
      **Nađeno u audit-u:** stari `config.ts` je za svaki build vraćao `http://10.0.2.2:3001`, pa APK
      na fizičkom telefonu nije mogao do API-ja — G12 matrica bi pala već na prijavi.
- [x] **Standalone release APK za matricu (26. 11.)** — `android-release` job sada pravi i
      `assembleRelease` APK (`digitalni-asistent-release-apk`); debug APK traži Metro, pa nije
      pogodan za fizičke telefone.
- [x] **CI #32 na `ff524c2`** — `verify` (lint/typecheck/test/build), `e2e`, `integracije` i
      `compose` ✅; Android APK job je sporiji od uobičajenog (debug build), ali ne zavisi od
      mobilnog configa. README dopunjen za `DA_API_URL` i novi broj testova (**345**).
- [x] **RC4 pipeline (26. 11.)** — tag `v1.0.0-rc4` → CI **#33 7/7 zeleno**, uključujući
      `android-release`: artifact `digitalni-asistent-release-apk` (**32.256.627 B**) i AAB
      (**52.544.622 B**); `docker` image job takođe zelen. Release APK je debug-potpisan i bez
      `DA_API_URL` namjerno pada na guard-u — to je dokaz pipeline-a, ne build za telefone.
- [x] **RC5 — provjera standalone APK-a (26. 11.)** — CI **#35 7/7 zeleno** na `v1.0.0-rc5`;
      `android-release` sada prije uploada provjerava da release APK sadrži
      `assets/index.android.bundle`. Provjera ✅, APK **32.256.666 B**, AAB **52.544.618 B**.
      Time je artifact za matricu dokazano standalone (ne zavisi od Metro-a).
- [x] **Produkcijska upozorenja pri startu (26. 11.)** — API i worker loguju: `ESIR_MODE=mock`,
      `SMS_PROVIDER=log`, localhost `PUBLIC_API_URL`/`WEB_APP_URL` i Sentry bez DSN-a
      (`collectProductionWarnings`, 4 testa). Ne mijenja ponašanje — sprečava tihu pogrešnu konfiguraciju.
- [ ] **DA_API_URL za uređaje** — treba staging ili LAN URL prije matrice; bez njega G12 stavka 3 pada.
- [ ] **G12 izvršenje** — čeka Sentry, R2, SMS, staging, keystore i 3 telefona; `preflight` **5/12**
      (5/13 sa `--devices`).

### Release automatizacija i Docker proba (2026-11-23)

Sve bez korisnikovih naloga: AAB pipeline, keystore tajne, backup/restore i produkcijski image.

- [x] **AAB kroz CI (tag)** — `push.tags: ['v*']` pokreće `android-release`; `-rc` tag bez keystore-a
      smije debug potpis, pravi release tag pada. Prvi `v1.0.0-rc1` pao (Metro tražio
      `packages/shared/dist`), drugi `v1.0.0-rc2` pao (Gradle tražio `hermes-compiler` relativno od
      `apps/mobile`), treći **`v1.0.0-rc3` zelen** — artifact **`digitalni-asistent-aab` 52.544.217 B**
      (~50 MB, debug potpis dok nema keystore-a).
- [x] **Keystore u CI** — podrška za `DA_KEYSTORE_BASE64` (dekodira se u `$RUNNER_TEMP`), guard
      za `-rc` vs release tag; `docs/KEYSTORE.md` (generisanje, 2 kopije, base64, rotacija, Play
      App Signing) i `pnpm release:check-signing` (provjera bez tajni, u CI-ju).
- [x] **Backup automatizacija** — `pnpm backup:db` (`pg_dump -Fc`, `pg_restore -l` provjera,
      opcioni R2 upload sa SSE, retencija); `pnpm backup:restore-drill` (privremena baza, 11 tabela,
      RTO limit, sigurnosna imena baza). Lokalno: dump 49,7 KB / 91 objekat; restore **2,7 s**,
      svi brojevi isti.
- [x] **Docker image + prod compose** — `apps/api/Dockerfile` (API + worker, Prisma CLI, healthcheck),
      `infra/docker-compose.prod.yml` (postgres → migrate → api/worker), `.dockerignore`,
      `.env.production.example`; CI validira oba compose fajla.
- [x] **Lokalna produkcijska proba** — image build, compose up, migracije (7/7), seed (50 faktura),
      smoke **8/8 za 0,8 s**, backup + restore drill **3,2 s** (11/11 tabela), worker log
      „Worker pokrenut“. **Nađen i popravljen bug:** `WorkerModule` nije importovao `StorageModule`
      (globalni modul), pa je worker padao na `R2StorageService` — u produkciji bi pao odmah pri startu.
- [x] **Verifikacija** — `api typecheck` 0, `api lint` 0, `compose config` 0, image build 0,
      smoke 8/8, restore drill 11/11; stack i image obrisani poslije probe.
- [ ] **Stvarni staging i AAB za Play** — i dalje čeka naloge (Neon/Vercel/Railway) i keystore.

### Sprint 14 — pilot (priprema, 2026-11-23)

Cilj: pripremiti sve što ne traži korisnike. **Start pilota je blokiran** dok G12/G13 nisu zatvoreni
(staging, Play, SMS, keystore).

- [x] **T14-2 (dio) Alati za metrike** — `tools/pilot/status.mjs` (`pnpm pilot:status`: kohorta,
      onboarding, „bez pomoći“, podsjetnik, NPS, blokatori, svih 6 kriterija G14, `--json`, `--strict`);
      `tools/pilot/weekly.mjs` (`pnpm pilot:weekly`: platform-metrike + kohorta → Markdown/JSON u
      `docs/pilot/reports/`, Δ u odnosu na prethodnu sedmicu, `--run`, `--example`, `--dry-run`);
      `tools/pilot/selftest.mjs` (`pnpm pilot:selftest`, 5/5) + CI korak u `verify`.
- [x] **Bugfix — `metrics:platform` nije radio** — skripta je brojala korisnike po nepostojećem
      `users.created_at` (`Unknown argument createdAt`); sada registracije mjeri po
      `companies.created_at`. Provjereno na lokalnoj bazi: 2 korisnika, 2 firme, 50 faktura,
      23 naplate, 0 podsjetnika. Bez ovoga sedmični izvještaj pilota nije mogao raditi.
- [x] **T14-1 (dio) Regrutacija** — `docs/pilot/RECRUITMENT.md`: kriteriji, pipeline
      `invited → confirmed → onboarded → active` (15 → 12), WhatsApp/e-mail pozivnica, follow-up
      i potvrda termina, šta se ne obećava, etika i privatnost.
- [x] **T14-1 (dio) Onboarding i NPS** — `docs/pilot/ONBOARDING.md` (20 min, skripta poziva,
      mjerenje „bez pomoći“ štopericom, e-mail poslije poziva) i `docs/pilot/NPS.md`
      (pitanja, 7./21. dan, računanje, follow-up za kritičare).
- [x] **T14-3 (dio) Trijaža** — `docs/pilot/TRIAGE.md`: P1/P2/P3 definicije, petak ritual,
      šablon issue-a bez PII, komunikacija i eskalacija.
- [x] **T14-4 (dio) Exit report** — `docs/pilot/EXIT_REPORT_TEMPLATE.md` (G14 kriteriji, platforma,
      kvalitativni nalazi, odluka i uslovi) + `docs/PILOT_PLAN.md` (operativni plan, zavisnosti,
      stop uslovi, privatnost).
- [x] **Praćenje kohorte** — `docs/pilot/tracking.example.csv` (12 učesnika, bez PII) i
      `docs/pilot/tracking.csv` u `.gitignore`; primjer izvještaja
      `docs/pilot/reports/2026-W48.example.md` (sintetički, jasno označen).
- [x] **Verifikacija (23. 11.)** — selftest **5/5**; status na primjeru: kohorta 12, 3/6 kriterija
      (očekivano — primjer je „usred pilota“); `pilot:weekly --run` protiv lokalne baze **exit 0**;
      primjer izvještaja regenerisan.
- [ ] **T14-1 start (12–15 firmi)** — blokirano: nema staginga, Play naloga, keystore-a ni SMS
      provajdera; nema realnih korisnika. G14 **nije ispunjen** — ovo je priprema, ne pilot.

### Sprint 10 — integracije i okruženja (u pripremi, 2026-11-12)

- [x] **S10-4 (dio) R2 signed URL** — `R2StorageService` (AWS S3 SDK): content-addressed ključevi,
      `ensureObject` (HEAD+PUT), presign TTL ≤ 15 min; `GET /invoices/:id/pdf` i javni PDF vraćaju 302
      na signed URL kad su ključevi postavljeni, inače stream; 3 unit testa.
      Verifikovano: **api 122/122**, build 3/3, e2e 8/8.
- [x] **S10-1 (dio) CI Playwright job** — `e2e` job u `ci.yml` (Postgres/Redis, build, Chromium,
      `pnpm --filter web test:e2e`, izvještaj kao artifact); čeka GitHub remote da se pokrene.
- [x] **S10-3 (dio) Monitoring (Sentry, API/worker)** — `MonitoringService` sa `@sentry/node`: bez DSN-a
      no-op; sa DSN-om 5xx iz globalnog filtera (tagovi request-id/ruta/status) + `FISCAL_ALARM` i padovi
      worker jobova; env `SENTRY_DSN`/`SENTRY_ENVIRONMENT`/`SENTRY_TRACES_SAMPLE_RATE`/`APP_RELEASE`.
      Verifikovano: **api 127/127**, worker smoke, e2e 8/8; commit `c7d87eb`. Web instrumentacija čeka DSN.
- [x] **S10-6/S10-7 (dio) Operativni runbook** — `docs/STAGING_DEPLOY.md`: staging arhitektura,
      env po servisu, prvi deploy, rutina release-a, rollback tabela, dnevni backup u R2, restore drill
      sa SQL provjerama, smoke checklist; commit `c711c96`. Stvarni staging i test restore čekaju naloge.
- [ ] **GitHub remote + prvi CI run** — tvoj korak (repo/org + kredencijali)
- [ ] **Sentry DSN** — uključivanje monitoringa (S10-3)
- [ ] **R2 ključevi** — uključivanje signed URL režima (S10-4)
- [ ] **SMS provajder** — stvarni OTP/podsjetnici (S10-5)
- [ ] **Staging + backup restore** — stvarni deploy/restore poslije naloga (runbook spreman)
- [ ] **JDK 17 / APK na uređajima** — S10-2

### Sprint 11 — priprema (2026-11-13)

- [x] **S11-2a Opt-out podsjetnika (§7.9)** — `customers.reminder_opt_out` (migracija
      `20261113104648_customer_reminder_opt_out`); automatski podsjetnici se ne zakazuju, worker otkazuje
      već zakazane, ručni podsjetnik vraća 409; web checkbox + oznaka na detalju; 3 API e2e.
      Verifikovano: **api 125/125**, shared 47/47, web 13/13, mobile 63/63, build 3/3, e2e 8/8;
      commit `d995cb2`.
- [ ] **S11-2b Kredit kupca pri preplati** — čeka odluku vlasnika/računovođe (model kredita, PDV tretman)
- [x] **S11-3 (dio) Pravni drafti** — `docs/LEGAL_DRAFT.md`: inventar podataka, skeleton politike
      privatnosti i uslova, mapiranje GDPR prava na izvoz/brisanje/opt-out, otvorena pitanja za
      pravnika/računovođu (draft — nije pravni savjet); commit `ae56bbb`.
- [x] **S11-4 (dio) Play objava** — `docs/PLAY_RELEASE.md`: package/brend/keystore odluke, AAB i
      potpisivanje, store listing tekst, Data Safety odgovori, content rating, checklist prije
      recenzije i pravilo 12 testera/14 dana; commit `ae56bbb`.
- [x] **S11-6 Support/incident runbook** — `docs/INCIDENT_RUNBOOK.md`: severiteti, dijagnostika,
      scenariji (fiskalizacija, SMS, baza, Redis, R2/PDF, 5xx, curenje podataka), komunikacija,
      post-mortem i kontakti; commit `c711c96`.
- [x] **S11-1 Audit po Pre-Deployment Checklist** — `docs/PRE_DEPLOYMENT_AUDIT.md`: svaka stavka sa
      dokazom (fajl/test/komanda), 19 ✅ / 11 ⚠️ / 1 ❌. Usput popravljeno: `/health` sada provjerava
      bazu i Redis (503 kada padnu) + testovi; `x-request-id` middleware na svakom odgovoru;
      rate limit za izdavanje (30/min) i slanje fakture (10/min); TTL cap 15 min
      (`PDF_LINK_TTL_SECONDS`, `R2_SIGNED_URL_TTL_SECONDS`); e2e health provjerava `checks`; commit `1846926`.
- [x] **S11-5 Pilot kit** — `docs/PILOT_KIT.md`: demo nalog i seed, onboarding 5 koraka, scenario prvog
      dana, feedback upitnik sa NPS-om, metrike uspjeha (≥70 % samostalno izda račun, ≥50 % pošalje
      podsjetnik), support kanal, izlazni kriteriji i tabela za praćenje.
- [x] **S11-7 Analitika** — odluka (bez PostHog-a za MVP): `AnalyticsService` emituje `ANALYTICS`
      log redove za `registration`, `invoice_issued`, `payment_recorded`, `reminder_sent` (allowlist
      svojstava, bez PII; 4 unit testa), `pnpm --filter api metrics:platform` daje brojeve iz baze;
      `docs/ANALYTICS.md`. `setup_completed` čeka serverski signal (mobile setup je lokalni);
      commit `1846926` (kod) i `b985022` (dokumentacija + pilot kit).
- [x] **S11-4 (dio) Play potpisivanje i brend materijal** — release `signingConfigs` u
      `apps/mobile/android/app/build.gradle` čita `keystore.properties` ili `DA_KEYSTORE_PATH`/
      `DA_KEYSTORE_PASSWORD`/`DA_KEY_ALIAS`/`DA_KEY_PASSWORD`; `keystore.properties` u `.gitignore`;
      placeholder ikona 512×512, feature graphic 1024×500 i launcher ikone svih gustina
      (`apps/mobile/scripts/generate-play-assets.mjs`); `docs/PLAY_RELEASE.md` ažuriran; commit `5f1e565`
      (+ `b951f70` zagrade u ternarnom izrazu).
      AAB čeka JDK 17/keystore; finalni brend i screenshotovi čekaju dizajnera/uređaj.
- [x] **S11-1 (drugi prolaz) — offline retry, rate limiter test, EXPLAIN** — `sync/retry.ts` +
      mini-migracija `sync_queue` (`attempts`, `nextAttemptAt`): backoff 1m/5m/15m/1h/6h, max 5
      pokušaja, FAILED stavke + dugme „Pokušaj ponovo“, alarm u UI poslije 3 dana; 9 Jest testova.
      Rate limiter dobio 6 unit testova (`rate-limit.guard.spec.ts`). EXPLAIN izvršen nad lokalnom
      Postgres 16 (40 firmi × 500 faktura): lista faktura je bila `Seq Scan` → dodat indeks
      `invoices_company_id_created_at_idx` (migracija `20261113180000`), sada sva tri upita koriste
      indeks; skripta `pnpm --filter api db:explain` pada ako se seq scan vrati.
- [x] **S11-7 (dopuna) setup_completed** — `POST /company/setup-complete` (owner, idempotentno),
      `companies.setup_completed_at` (migracija `20261113170000`), 3 e2e testa; mobilni wizard zove
      rutu best-effort pri završetku, analitika emituje `setup_completed` samo prvi put.
- [x] **Verifikacija (drugi prolaz)** — `pnpm lint` 5/5, `pnpm typecheck` 5/5, `pnpm build` 3/3,
      `prisma migrate deploy` (7 migracija), **278 unit/API testova** (shared 47, api 146, web 13,
      mobile 72), EXPLAIN 3/3 bez seq scana. Playwright e2e nije ponovno pokrenut lokalno
      Playwright e2e **8/8** (39,6 s) pokrenut lokalno poslije seed-a (background job, exit 0).

### Sprint 11 — dopuna S11-8 (2026-11-15)

- [x] **S11-8a M-01 biometrijska prijava i zaključavanje** — `apps/mobile/src/storage/biometricSession.ts`
      (Keychain zapis sa `ACCESS_CONTROL.BIOMETRY_ANY`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`); auth store dobija
      status `locked`, `unlockWithBiometrics`, `signInWithBiometrics`, `enableBiometricLogin`,
      `disableBiometricLogin`, `continueWithPassword`; `LockScreen` pri pokretanju; opcija
      „Zapamti prijavu biometrijom“ na prijavi; isključivanje u podešavanjima; odjava i promjena lozinke
      brišu upamćenu prijavu; `USE_BIOMETRIC`/`USE_FINGERPRINT` u `AndroidManifest.xml`.
      21 novi Jest test (9 `biometricSession` + 10 auth store + 2 slanje fakture).
- [x] **S11-8b Slanje fakture iz mobilne (M-08)** — `sendInvoice()` u `api/invoices.ts` i modal na detalju
      (kanal e-mail/SMS, opcioni primalac, poruka sa stvarnim primaocem iz API odgovora); vidljivo za
      `ISSUED`/`SENT`/`PARTIALLY_PAID`/`PAID`/`OVERDUE`, ne za VOID i offline.
- [x] **S11-8c M-12 nalog i lozinka** — `PATCH /auth/me` (telefon; e-mail uz trenutnu lozinku, 409 za
      duplikat u firmi, audit `user.profile_update`) i `POST /auth/change-password` (trenutna + nova,
      opoziv ostalih uređaja, audit `user.password_change`, rate limit 5/15 min); mobilni `AccountScreen`
      (profil + lozinka) iz podešavanja; `applyUser` osvježava i Keychain sesiju.
- [x] **S11-8d `PATCH /items/:id`** — `updateItemSchema` (`packages/shared`), servis sa 404 za tuđi
      artikal, ruta (owner/worker), arhiviranje kroz `archivedAt`; web sekcija „Artikli“ u podešavanjima
      (izmjena u mjestu, arhiviranje, novi artikal, izbor porezne stope).
- [x] **S11-8e Rate limiter e2e na stvarnom Redis-u** — `test/rate-limit.e2e-spec.ts`: 5 prijava/min pa
      429 (i sa ispravnom lozinkom), limit je po ruti (`forgot-password`, `/health` rade dalje), brojači
      se čiste iz Redis-a prije svakog testa (`rate:*`).
- [x] **S11-8f Dokumentacija** — poččišćeni zaostali fragmenti u `README` (offline retry) i
      `docs/PRE_DEPLOYMENT_AUDIT.md`; README tabele ruta/odluka/ograničenja i testovi ažurni.
- [x] **S11-8g Health readiness stabilizovan** — `GET /health` je na prvom zahtjevu poslije starta vraćao
      503 jer `ioredis` još nije bio povezan (`enableOfflineQueue=false`); `checkRedis` sada radi jedan
      retry (250 ms), pravi pad Redis-a i dalje vraća 503; +1 unit test (retry uspije iz drugog pokušaja).
- [x] **S11-8h Android build wiring** — `settings.gradle` sam nađe RN Gradle plugin i poziva
      `@react-native-community/cli config` kroz `node` (pnpm hoisted nema `.bin` u `apps/mobile`); CI
      `android` job dodaje linkove `react-native` i `@react-native` prije `gradlew`; `verify` job dobio
      `NODE_OPTIONS=--max-old-space-size=4096`; web e2e dobio scenario za artikle.
      **Lokalni APK:** JDK 17 (Temurin), Gradle 9.4.1, SDK platform 37, build-tools 36, NDK 27.1 i
      CMake 3.22 instalirani/pripremljeni; build prošao compile/codegen, pao na `op-sqlite` native
      buildu zbog Windows `MAX_OBJECT_PATH` (putanja repoa > 250 znakova) — APK ostaje za CI ili kraću
      putanju. Detalji u `README` (Troubleshooting).
- **Verifikovano lokalno (16. 11. 2026, CI ekvivalent):** `pnpm lint` 5/5, `pnpm typecheck` 5/5,
      `pnpm build` **3/3** (Next kompajliran), `prisma migrate deploy` (Postgres 16 + Redis 7),
      **316 testova** (shared 51, api 159, web 13, mobile 93) i **Playwright e2e 9/9** (31,8 s) — sve zeleno.
      Napomena: pun API set na Windowsu traži veći heap (`NODE_OPTIONS=--max-old-space-size=6144`), inače
      worker padne sa `ERR_IPC_CHANNEL_CLOSED`. Biometrija i dalje čeka APK i fizički uređaj.

### Sprint 9 — zatvaranje MVP rupa (završen, 2026-11-12)

- [x] **S9-1 Reset lozinke** — API `POST /auth/forgot-password` i `POST /auth/reset-password` (§21.2);
      token 32B, SHA-256 hash u Redis-u, TTL 30 min, jednokratan (`GETDEL`), novi zahtjev briše stari;
      reset opoziva sve sesije (briše refresh hashove uređaja); `EmailService` sa `MAIL_PROVIDER=log`;
      web `/forgot-password` i `/reset-password` + link na prijavi; 5 unit + 5 e2e testova.
      Verifikovano (2026-11-12): **api 99/99**, shared 47/47, web 10/10, mobile 62/62,
      `pnpm build` 15 ruta + middleware; commit `a48db82`.
- [x] **S9-2 `POST /invoices/:id/send`** — slanje fakture e-mailom (PDF u prilogu) ili SMS-om
      (kratkotrajni link); `EmailService` dobija attachments; javni `GET /public/invoices/:id/pdf?t=`
      sa HMAC tokenom (TTL 15 min, vezan za fakturu); audit `invoice.send`; web dugme „Pošalji“ sa
      izborom kanala i primaoca; 6 e2e + 4 unit testa. Verifikovano: **api 109/109** (ukupno 17 fajlova),
      shared 47/47, web 10/10, mobile 62/62, `pnpm build` 15 ruta; commit `08f2813`.
- [x] **S9-3 GDPR izvoz i brisanje** — `GET /account/export` (JSON: firma, korisnici, kupci, stavke, stope,
      fakture sa linijama/naplatama, podsjetnici, fiskalni zapisi, audit, pretplata — bez hash-eva/tajni);
      `DELETE /account` (owner + potvrda `OBRISI`, flag `FEATURE_ACCOUNT_DELETION`): anonimizacija naloga
      i kontakt podataka kupaca, brišu se uređaji/refresh tokeni, **fakture i fiskalni zapisi ostaju**;
      web sekcija „Podaci i nalog“ (izvoz + brisanje) i proxy za download; 5 e2e testa.
      Verifikovano: **api 114/114** (18 fajlova), `pnpm build` 16 ruta; commit `e7c8201`.
- [x] **S9-4 Playwright e2e** — `apps/web/e2e`: prijava, pogrešna lozinka, zaboravljena lozinka,
      nevažeći reset token, kreiranje drafta → izdavanje (mock) → PDF, lista faktura; config podiže
      API + Next `start`, globalSetup radi `prisma migrate deploy` + demo seed; `test:e2e` skripta.
      Verifikovano: **6/6 e2e prolazi** (1,6 min, Chromium); commit `69f0b5c`.
- [x] **S9-6 Feature flagovi + alarm** — `FEATURE_FISCAL_ENABLED`/`FEATURE_SMS_ENABLED` (isključivanje bez
      deploya: rute vraćaju 503 sa jasnom porukom, worker preskače retry); alarm za `PENDING_FISCAL` > 3 dana
      sa Redis dedupe (1× dnevno po fakturi) i logom `FISCAL_ALARM`; worker vraća broj alarma; 2 unit +
      1 worker e2e (alarm se diže jednom). Verifikovano: **api 117/117**, worker proces se diže (smoke);
      commit `439fdd2`.
- [x] **S9-5 W-03 masovne akcije** — checkbox po redu + „izaberi sve“, traka sa „Izdaj izabrane“ i
      „Pošalji podsjetnik“, limit 50, potvrda i rezultat po fakturi; server akcije zovu postojeće API rute
      po fakturi (bez bulk rute van §6); pravila: izdavanje samo DRAFT SALE, podsjetnik za izdate/neplaćene.
      Verifikovano: web unit **13/13**, Playwright **7/7** (novi scenario masovnog izdavanja); commit `f25545d`.
- [x] **S9-7 Dokumentacija** — README osvježen: stanje Sprinta 9, kompletna tabela API ruta (nove rute i
      odstupanja od §6), flagovi i e-mail/SMS adapteri, Playwright uputstvo, testovi, poznata ograničenja;
      commit `ec5f0a0`.
- [x] **S9-8 `POST /auth/logout`** — JWT ruta opoziva refresh hash trenutnog uređaja (idempotentna);
      web logout zove API prije brisanja cookie-ja; mobilni `signOut` best-effort (radi i offline);
      2 API e2e + 2 mobilna unit + Playwright logout scenario; commit `b85a71c`.

### Sprint 8 — stabilizacija (zatvoren planom 2026-11-12)

- [x] **Web silent refresh** — `apps/web/middleware.ts`: kad access cookie istekne (15 min), middleware
      pozove `POST /auth/refresh` sa refresh cookie-jem, rotira oba tokena, prepiše request cookie
      prije rendera i vrati `Set-Cookie`; bez refresh cookie-ja ide redirect na `/login`
- [x] Cookie konstante objedinjene (`lib/session-constants.ts`) — koriste ih akcije, session helper i middleware
- [x] **CI**: trigger i na granu `master` (+ `workflow_dispatch`), novi `android` job (JDK 17 + Android SDK,
      `./gradlew assembleDebug`, APK kao artifact); `compose` job ostaje
- [x] **Idempotency-Key** (§6, §21) — interceptor za `POST /invoices` i `POST /invoices/:id/payments`:
      Redis `SET NX` (24 h), ponovljeni zahtjev vraća keširan odgovor bez novog zapisa, zahtjev u toku → 409,
      neuspješan zahtjev oslobađa ključ; web editor šalje stabilan ključ po formi (dupli klik / retry)
- [x] **`POST /devices/register`** (§6) — push token trenutnog uređaja (uređaj iz JWT sesije); `pushToken: null`
      briše token; tuđi uređaj se ne može mijenjati
- [x] **`GET/POST /subscriptions`** (§6) — owner-only evidencija pretplate: `{ subscription: … | null }`,
      upsert po firmi (plan/status su stringovi jer §5 nema enuma); naplata čeka provajdera (§19)
- [x] **Seed podaci (§12)** — `prisma/seed.js` + `pnpm db:seed`: demo firma (JIB `9999999999999`),
      20 kupaca, 10 artikala, 3 porezne stope, **50 faktura** (draft/izdate/plaćene/djelimično/dospjele),
      podešavanja podsjetnika, trial pretplata i mock fiskalni zapisi; idempotentno (preskače ako postoji),
      `SEED_RESET=1` briše i ponovo kreira; demo pristup `demo@digitalni-asistent.ba` / `DemoLozinka123`
- [x] **Web akcije na detalju fakture** — naplata (puna/djelimična + način), refundacija, storno (VOID)
      i ručni podsjetnik kroz UI; iste server akcije/validacije kao mobilni, poslije uspjeha `router.refresh()`
- [x] **Web unit testovi** — Vitest (`vitest.config.ts`, `test` skripta): 10 testova za `lib/format`,
      `lib/invoice-preview` (obračun kao API) i `lib/invoice-form` (parsiranje/datumi); `pnpm test` sada
      pokriva i web
- [ ] GitHub remote + push — **blokirano** (nema remote-a ni kredencijala; CI jobovi nisu pokrenuti na GitHubu)
- [ ] Android build lokalno — **blokirano okruženjem**: postoji samo JRE 8, a Gradle 9.4/AGP traži JDK 17+
      (SDK postoji); build ide kroz CI kad se repo poveže
- [ ] Sentry/monitoring — čeka DSN/nalog

**Verifikacija (lokalno, sve exit 0)**

- [x] web `typecheck` i `eslint`
- [x] `pnpm --filter web build` — 13 ruta + middleware (34.5 kB)
- [x] `pnpm --filter api typecheck` i `eslint`
- [x] `pnpm --filter api test` — **89/89** (12→13 fajlova; novo: devices/subscriptions 6)
- [x] `pnpm --filter @digitalni-asistent/shared test` — **47/47** (nove šeme 2)
- [x] `pnpm --filter @digitalni-asistent/mobile test` — **61/61**
- [x] `pnpm --filter web test` — **10/10**
- [x] Ukupno **208 testova**: shared 47, api 89, **web 10**, mobile 62
- [x] **Smoke silent refresh** (API + Next `start` + Postgres/Redis): istekao access + validan refresh →
      stranica 200 sa sadržajem firme i novim `da_access`/`da_refresh` cookie-jima; istekao access bez
      refresh-a → 307 na `/login`; svjež access → 200 bez nepotrebne rotacije
- [x] **Seed smoke** — seed dvaput (drugi put preskočen), `SEED_RESET=1` (obrisano + ponovo kreirano),
      API prijava demo korisnikom i provjera: firma, 50 faktura, aging 4241,39 KM / 35 otvorenih
- [x] **Puni verifikacijski prolaz (CI ekvivalent)** — `pnpm lint` 5/5, `pnpm typecheck` 5/5,
      `pnpm build` 3/3 (shared + api dist + web 13 ruta/middleware), `prisma validate`,
      `migrate deploy` (no pending) i `migrate status` (up to date), `docker compose config`,
      `pnpm test` **197/197**
- [x] **Demo web smoke** (Next `start` + API + seed): `/`, `/invoices` (50), `/customers` (20),
      `/reports`, `/settings`, detalj fakture sa PFR — svi 200; nove akcije na detalju vidljive
      (Naplati, Pošalji podsjetnik, Refundiraj, Poništi); PDF 200 (`%PDF`, ~29 KB)
- [x] Napomena: e2e testovi `TRUNCATE`-uju bazu, pa poslije `pnpm test` treba ponovo `pnpm db:seed`
      (dodato u README)

### Sprint 7 — mobilne fakture (završen, 2026-11-09–10)

- [x] **M-05 Nova faktura** — online forma: kupac (bottom-sheet sa pretragom), SALE/PRAČUN, datumi,
      način plaćanja, stavke (katalog + ručni opis, količina, cijena, popust, PDV iz aktivnih stopa),
      live obračun BigInt half-up identičan API-ju
- [x] **M-06 Pregled prije izdavanja** — sažetak + „Izdaj i fiskalizuj“ / „Sačuvaj kao draft“;
      PRAČUN ima samo čuvanje (ne fiskalizuje se)
- [x] **M-08 Detalj fakture** — stavke, sume, naplate, PFR; akcije: izdavanje, naplata (puna/djelimična,
      način plaćanja), **refundacija** (iznos ≤ naplaćeno, novi REFUND dokument), **ručni SMS podsjetnik**
      i poništenje (VOID uz potvrdu); potvrde/poruke o uspjehu i grešci
- [x] **M-02 Setup (5 koraka)** — firma, EFD, porezi, numeracija, podsjetnici; napredak u lokalnoj SQLite
      `meta` tabeli (`setup_progress`), pa se setup može prekinuti i nastaviti; poslije završetka ulaz radi
      kao podešavanja; vlasničke sekcije (podsjetnici) imaju 403 poruku; dugme „Podešavanja firme“ na početnoj
- [x] **M-12 Podešavanja** — jedinstven ekran: firma/EFD/porezi/numeracija (M-02 wizard), podsjetnici
      (M-10), pretplata (owner-only čitanje: plan/status/probni period), nalog (email/telefon/uloga) i odjava
- [x] **M-10 Podsjetnici** — plan i šablon (owner: enabled, šablon sa `{broj}`/`{iznos}`, do 4 stavke
      plana), lista podsjetnika sa statusima i greškama, **„pošalji odmah“** kroz izbor fakture sa
      otvorenim dugom; 403 za ne-vlasnike je pokriven porukom, lista i slanje rade
- [x] **M-07 Fiskalizacija** — PFR, vrijeme fiskalizacije, jasna poruka rezultata i PENDING_FISCAL
      objašnjenje; **QR kod fiskalnog računa se prikazuje na telefonu** (API `GET /invoices/:id/qr`
      vraća PNG; mobilni `Image` šalje Bearer header — bez nove native biblioteke)
- [x] **M-09 Predračun → račun** — `POST /invoices/:id/convert` (samo DRAFT ADVANCE → SALE, audit
      `invoice.convert`, 409 za ne-PRAČUN/ponovnu konverziju, 404 za tuđu fakturu); dugme na
      mobilnom i web detalju; broj se i dalje dodjeljuje pri izdavanju
- [x] **M-05 offline** — bez mreže forma koristi **lokalne kupce iz SQLite**, stavke se unose ručno
      (katalog nije keširan); draft se čuva lokalno (`DRAFT-…`) i ide u `sync_queue`, `flushQueue`
      šalje kad se mreža vrati, `pullAndMerge` upisuje server broj/status; lista faktura (M-04) je
      offline-first (lokalna baza + sync u pozadini) i prikazuje broj lokalnih izmjena koje čekaju slanje
- [x] **Izmjena drafta** — „Uredi draft“ na detalju vodi u formu u edit režimu (prefill kupca,
      tipa, datuma, plaćanja, napomene i svih stavki); čuvanje ide `PATCH /invoices/:id` (samo DRAFT),
      poslije uspjeha nazad na detalj sa porukom; izdavanje je i dalje odvojeno dugme
- [x] **M-08 offline** — detalj fakture se kešira u lokalnoj `invoice_details` tabeli pri svakom
      online učitavanju; bez mreže se prikazuje read-only uz napomenu, a akcije (izdavanje, naplata,
      refund, storno, podsjetnik, QR) su skrivene; offline kreiran draft odmah dobija keširan detalj
- [x] Brza akcija „Nova faktura“ na M-03 početnoj i M-04 listi; red fakture vodi na detalj
- [x] API klijent: `createInvoice`, `updateInvoice`, `getInvoice`, `issueInvoice`, `convertInvoice`,
      `createPayment`, `cancelInvoice`, `refundInvoice`, `sendInvoiceReminder`, `listReminders`,
      podešavanja podsjetnika, katalog (`/items`, `/tax-rates`), `getCompany`/`updateCompany`,
      `getMeta`/`setMeta`
- [x] Testovi: mobilni **61** (invoiceMath, API klijenti, setup helperi, offline draft i detalj);
      API **80**
      (QR ruta 3 + konverzija 4); Android bundle prolazi (1.9 MB)
- [x] Popravljen Metro na Windowsu: uklonjeni zaostali `.ignored_*` junction-i iz `node_modules`
      (blokirali su file-map) — bundle sada radi bez zaobilaznica

**Verifikacija (lokalno, sve exit 0)**

- [x] `pnpm --filter api typecheck` i `eslint` (api)
- [x] `pnpm --filter web typecheck`/`eslint` i `pnpm --filter web build` (13 ruta)
- [x] `pnpm --filter @digitalni-asistent/mobile typecheck` i `eslint` (mobile strict)
- [x] `pnpm --filter api test` — 80/80 (e2e na pravoj bazi + Redis)
- [x] `pnpm --filter @digitalni-asistent/mobile test` — 59/59
- [x] `pnpm --filter @digitalni-asistent/shared test` — 45/45
- [x] Ukupno **184 testa**: shared 45, api 80, mobile 59 (svaka komponenta zasebno, sve zeleno)
- [x] Metro `react-native bundle --platform android --dev false` — bundle 1.9 MB

## Urađeno

### Sprint 6 — web MVP (2026-11-09)

- [x] **W-01 Prijava** — server action → `POST /auth/login`, tokeni u httpOnly cookie (15 min / 30 dana)
- [x] Zaštita ruta u `(app)` layout-u (bez cookie-ja → 307 na `/login`)
- [x] **W-02 Dashboard** — firma, ukupno nenaplaćeno, aging buckets
- [x] **W-03 Fakture** — tabela sa statusima, PRAČUN oznakom, linkom na detalj i PDF linkom
- [x] **W-04 Editor fakture** — `/invoices/new` + `/invoices/[id]/edit` (kupac, SALE/ADVANCE, datumi,
      način plaćanja, stavke sa artiklima i porezom, popust, live obračun BigInt half-up kao API);
      `/invoices/[id]` detalj (stavke, sume, naplate, PFR/QR poslije fiskalizacije, „Izdaj“, PDF)
- [x] **W-05 PDF/štampa** — proxy ruta `/api/invoices/[id]/pdf` (cookie → Bearer)
- [x] **W-06 Kupci** — `/customers` (pretraga, tabela), `/customers/new`, `/customers/[id]` (izmjena,
      arhiviranje, nenaplaćeno po kupcu)
- [x] **W-07 Izvještaji** — `/reports`: aging potraživanja + mjesečni izvještaj sa izborom godine
- [x] **W-08 Podešavanja** — `/settings`: firma (EFD, logo), numeracija, porezne stope, automatski
      podsjetnici (šablon + plan do 4); sekcija podsjetnika skrivena za ne-vlasnike (403)
- [x] Navigacija: Početna / Fakture / Kupci / Izvještaji / Podešavanja

**Verifikacija (lokalno, sve exit 0)**

- [x] `pnpm --filter web build` — 13 ruta, bez grešaka
- [x] `pnpm lint` i `pnpm --filter web typecheck` (web strict)
- [x] `pnpm test` — 136 testova: shared 45, api 73 (e2e na pravoj bazi + Redis), mobile 18
- [x] Produkcijski smoke (Next `start` + API + Postgres/Redis): svih 11 web stranica 200 sa očekivanim
      sadržajem; PDF 200 (`%PDF`, ~28 KB); PFR + QR na detalju izdate fakture; bez cookie-ja 307 → `/login`
- [x] Uhvaćen i popravljen bug prije commita: web tip kupca je imao `createdAt/updatedAt` kojih nema u
      Prisma šemi → 500 na `/customers/[id]`; uklonjeno i provjereno smoke testom

### Sprint 0 (2026-11-09)

- [x] pnpm workspaces + Turborepo, `apps/mobile` (RN), `apps/web` (Next), `apps/api` (Nest)
- [x] `packages/shared`, `packages/config`, Prisma šema (15 tabela), docker-compose, CI, README

### Sprint 1 (2026-11-09)

- [x] Auth (register/login/refresh rotacija/OTP), argon2id, JWT, rate limiting, guardovi
- [x] Firma, kupci, artikli, porezne stope (+ POST), Zod validacija, IDOR zaštita
- [x] Mobilna: M-01 prijava, navigacija, Zustand, Keychain

### Sprint 2 (2026-11-09)

- [x] Obračun (§7.3) u BigInt-u sa half-up zaokruživanjem + unit testovi
- [x] Fakture: DRAFT kreiranje, lista sa filterima, detalj, DRAFT-only izmjena
- [x] Numeracija: `unique(company_id, type, number)`, `numbering_next_advance`, migracija
- [x] Mobilna: M-11 kupci (lista, pretraga, dodavanje)

### Sprint 3 (2026-11-09)

- [x] Fiskalni adapter + mock, `POST /invoices/:id/issue`, PENDING_FISCAL na pad ESIR-a (502)
- [x] Alokator broja pri izdavanju (row lock, brojači po tipu, reset na novu godinu)
- [x] PDF (pdfkit + qrcode + DejaVu), PFR/QR, PRAČUN oznaka

### Sprint 4 (2026-11-09)

- [x] Naplata: puna/djelimična, preplata odbijena, audit, `payments` u detalju fakture
- [x] Podsjetnici: podešavanja (owner), šablon `{broj}/{iznos}`, plan do 4, automatsko planiranje
      pri izdavanju, ručni SMS, lista, 409/400 validacije
- [x] Izvještaji: aging (`/reports/receivables`), mjesečni (`/reports/monthly`)
- [x] Mobilna: M-03 Početna (KPI + aging), M-04 Fakture

### Sprint 5 (2026-11-09) — poništenje i refundacija

- [x] `invoices.transaction_type` (SALE/VOID/REFUND) + migracija `20261109120000_invoice_transaction_type`
- [x] `POST /invoices/:id/cancel` — novi VOID zapis sa brojem i kopijom stavki; original → CANCELLED;
      plaćena faktura → 409 (refundacija)
- [x] `POST /invoices/:id/refund` — novi REFUND zapis (ISSUED), iznos ≤ naplaćeno, kumulativno ograničenje,
      original ostaje PAID
- [x] Audit `invoice.cancel` / `invoice.refund`; IDOR zaštita; testovi (6)
- [x] **Worker (BullMQ)** — odvojen proces `src/worker.ts` (`pnpm --filter api worker`):
      `reminders` svakih 60 s (šalje `SCHEDULED`, preskače plaćene/poništene/bez telefona) i
      `fiscal-retry` svakih 5 min (backoff 1m/5m/15m/1h/6h, max 5, alarm > 3 dana)
- [x] `retryPendingFiscal` u `InvoicesService` (refaktorisan `issue` → `fiscalize`, bez dupliranja)
- [x] Testovi worker logike preko `scan()` (bez queue-a): slanje, otkazivanje za plaćenu fakturu, fiskalni retry
- [x] **Sync API**: `POST /sync/push` (batch, idempotencija po `entityId`, `sync_queue` DONE/FAILED,
      customer create/update + invoice create) i `GET /sync/pull` (kupci + fakture delta po `updatedAt`)
- [x] **Mobilni offline**: op-sqlite šema (`customers`, `invoices`, `sync_queue`, `meta`), repozitoriji,
      `pullAndMerge` + `flushQueue` + `enqueueOperation`; M-11 kupci lokal-first (pretraga lokalno,
      dodavanje radi bez mreže), offline indikator
- [x] Testovi sync engine-a (uuid v7, mapiranje rezultata primjene)
- [x] Test infra: Vitest izolacija po fajlu (`maxForks: 1`) + `pnpm test` preko pnpm recursive
      (turbo pipe je usporavao testove ~3× i izazivao timeout)

**Verifikacija (lokalno, sve exit 0)**

- [x] `pnpm lint`, `pnpm typecheck`, `pnpm build` (uključuje `dist/worker.js`)
- [x] `pnpm test` — **136 testova**: shared 45, api 73 (e2e na pravoj bazi + Redis), mobile 18
- [x] `prisma migrate deploy` / `status` — 4 migracije, schema up to date

## Nije urađeno / blokirano

- [ ] **Test matrica na 3 uređaja** — APK je spreman (`digitalni-asistent-debug-apk`, 49 MB), ali nema
      povezanih uređaja: offline, biometrija i slanje fakture još nisu provjereni na telefonu
- [ ] **Sentry DSN, R2 ključevi, SMS provajder, staging nalozi** — kod spreman (API/worker + **web**
      Sentry instrumentacija, R2 signed URL, **generički SMS `http` adapter**), čekaju naloge (Sprint 12)
- [ ] **G0: upit operateru ESIR** — čeka odgovor (mock je privremen); storno fiskalizacija i PDV
      tretman refundacije poslije G0/računovođe
- [ ] **Play objava** — signing config i placeholder brend materijal spremni; čekaju finalni brend/package,
      keystore (2 kopije), AAB (JDK 17/CI) i screenshotove s uređaja
- [ ] **Pravni paket** — drafti u `docs/LEGAL_DRAFT.md`; objava politike privatnosti/ToS-a čeka pravnika
- [ ] **Backup + testiran restore** — procedura u `docs/STAGING_DEPLOY.md`; stvarni restore čeka staging
- [ ] **Biometrija na uređaju** — kod i 9 Jest testova postoje; sistemski prompt nije verifikovan bez APK-a
      (potvrditi u S10-2 na 3 uređaja: otključavanje, otkazivanje, uređaj bez biometrije)
- [ ] **Kredit kupca pri preplati** — čeka odluku vlasnika/računovođe (preplata se odbija)

## Odluke (potvrđene na kickoff-u)

1. Refresh tokeni: hash u `devices`; 2. `POST /tax-rates` dodat uz §6; 3. OTP = verifikacija telefona (mock SMS);
4. Numeracija po tipu, broj pri izdavanju, draft `DRAFT-…`; 5. Obračun BigInt + half-up;
6. DRAFT-only izmjena (409 van DRAFT-a); 7. `consistent-type-imports` isključen u API-ju (Nest DI);
8. Fiskalizacija kroz adapter, `ISSUED` samo poslije ESIR odgovora; 9. PRAČUN se ne fiskalizuje;
10. PDF se streamuje dok nema R2 kredencijala; 11. Preplata se odbija (nema kredita u šemi);
12. Šablon podsjetnika: `{broj}` i `{iznos}` obavezni; 13. Automatski podsjetnici se planiraju, šalje ih worker;
14. VOID/REFUND su nova dokumenta sa svojim brojem; 15. VOID/REFUND se ne fiskalizuju (G0);
16. Worker je odvojen proces (BullMQ 6 scheduler): podsjetnici 60 s, fiskalni retry 5 min po §7.5.
17. **M-09 konverzija:** `POST /invoices/:id/convert` (nije u §6) mijenja tip u mjestu
    DRAFT ADVANCE → SALE; broj se dodjeljuje pri izdavanju, audit `invoice.convert`.
18. **Pretplata (MVP):** `GET/POST /subscriptions` samo evidentiraju plan/status/datume (bez naplate i
    bez provajdera) — `GET` vraća `{ subscription: … | null }`; naplata čeka odluku iz §19.
19. **Push token:** `POST /devices/register` mijenja samo uređaj iz JWT sesije (`deviceId`);
    `pushToken: null` odjavljuje notifikacije za taj uređaj.
20. **Analitika (S11-7):** za MVP nema PostHog-a — `ANALYTICS` log redovi bez PII preko
    `AnalyticsService`, brojevi iz baze (`metrics:platform`); imena događaja ostaju ista ako se doda PostHog.
21. **Health i request-id (S11-1):** `GET /health` je readiness (baza + Redis, 503 kada padnu),
    `x-request-id` ide na svaki odgovor (middleware), filter ga koristi za log/Sentry.
22. **Offline retry (S11-1/E6):** `sync_queue` ima `attempts`/`nextAttemptAt`, backoff
    1m/5m/15m/1h/6h, max 5 pokušaja → `FAILED`; UI alarm poslije 3 dana i ručni retry.
23. **Setup signal (S11-7):** `POST /company/setup-complete` je owner-only i idempotentan;
    `setup_completed` se emituje samo prvi put; mobilni ga zove best-effort.
24. **Nalog i katalog (S11-8):** `PATCH /auth/me`, `POST /auth/change-password` i `PATCH /items/:id`
    nisu u §6 (kao `POST /tax-rates`, `convert`, `logout`, `DELETE /account`). Promjena e-maila traži
    trenutnu lozinku; promjena lozinke opoziva ostale uređaje; artikli se arhiviraju kroz `archivedAt`;
    tuđi artikal vraća 404 (ne 403).
25. **Biometrija (S11-8):** upamćena prijava = Keychain zapis sa `ACCESS_CONTROL.BIOMETRY_ANY` i
    `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; pri pokretanju status `locked` dok se ne otključa biometrijom ili
    prijavom lozinkom (`continueWithPassword` briše sesiju, ne i upamćenu prijavu); odjava i promjena
    lozinke brišu upamćenu prijavu; uređaj bez biometrije radi kao ranije.

## Otvorena pitanja

- **Storno fiskalizacija** i **PDV tretman refundacije** — potvrditi sa operaterom/računovođom.
- **PFR/QR format** — mock placeholder; zavisi od Pravilnika (95/25) i operatera (G0).
- **Numeracija** — format/prefix potvrditi sa računovođom.
- **SMS provajder** — `log` adapter u razvoju; generički `http` adapter spreman (T12-6), ali bez
  izabranog provajdera, sender ID-a i ugovora nema stvarnih podsjetnika/OTP-a u produkciji.
- **Setup završen** — `setup_completed_at` postoji (S11-7), ali signal je best-effort:
  ako je telefon offline pri završetku, događaj se ne pošalje (proxy u `metrics:platform` ostaje).
- **Kredit kupca pri preplati** — nema polja/tabele u §5.
- **R2 kredencijali**, **JIB checksum**, **brend** (`com.digitalniasistent` privremeno).
- **OTP namjena**, **role/status vrijednosti**, **M-02 napredak**, **`POST /auth/logout`**.
- **Biometrija** — ponašanje na uređajima bez biometrije i poslije promjene otiska (Keychain
  `BIOMETRY_ANY` invalidacija) potvrditi na fizičkim uređajima u S10-2.

## Sljedeći korak

Plan daljeg rada: **`PLAN_DALJEG_RADA_v3.md`** (v3.0, 2026-11-23) i `Plan_Daljeg_Rada_v3.docx`;
v2 (`PLAN_DALJEG_RADA_v2.md`, 16.11.) i v1 (12.11.) su arhiva. Sprintske kapije: **G12 30.11.**
(CI/APK/integracije/uređaji), **G13 7.12.** (AAB + pravni paket), **G14 11.1.2027.** (pilot).
Sprint 12B je **završen 23. 11.** (prije roka): pravne stranice, AAB job, staging smoke, screenshotovi
i osvježen audit — detalji u sekciji „Sprint 12B“. **G14 priprema je takođe završena 23. 11.** —
detalji u sekciji „Sprint 14 — pilot (priprema)“; start pilota čeka G12/G13, pa G14 ostaje otvoren.
Sledeće: **G12** po `docs/G12_EVIDENCE_PACK.md` — čim stignu Sentry/R2/SMS/staging/keystore
i 3 telefona; kod-zadataka koji ne čekaju nalog nema.
- **Sprint 11 (stanje 2026-11-13)** — urađeno: opt-out podsjetnika (`d995cb2`), incident runbook
  (`c711c96`), Play/legal drafti (`ae56bbb`), **S11-1 audit** (`docs/PRE_DEPLOYMENT_AUDIT.md`),
  **S11-5 pilot kit** (`docs/PILOT_KIT.md`), **S11-7 analitika** (`docs/ANALYTICS.md`,
  `AnalyticsService` + `metrics:platform`), **S11-4 priprema** (release signing config + placeholder
  brend materijal). Time je kod koji ne čeka nikoga zatvoren; ostalo je vezano za naloge, brend i odluke.
- **S11-8 (stanje 2026-11-15)** — urađeno: biometrijska prijava + zaključavanje (M-01), slanje fakture iz
  mobilne (M-08), profil i promjena lozinke (M-12, API + ekran), `PATCH /items/:id` + web sekcija
  „Artikli“, rate limiter e2e na stvarnom Redis-u, čišćenje README/audit fragmenata.
- **Verifikacija (2026-11-16):** `pnpm lint` 5/5, `pnpm typecheck` 5/5, `pnpm build` **3/3**,
  `prisma migrate deploy` (Postgres 16 + Redis 7), **316 testova** (shared 51, api 159, web 13,
  mobile 93) i **Playwright e2e 9/9** — sve zeleno, izvršeno lokalno sa Docker bazom/Redis-om.
  Usput nađen i popravljen health bug (503 na prvom zahtjevu zbog `ioredis` konekcije).
- **Sprint 12 (stanje 2026-11-21)** — urađeno: GitHub + CI 4/4 zelen, APK artifact, APK na Android 17
  emulatoru (uz popravljen P1 refresh token bug), **web Sentry instrumentacija** (T12-4, bez DSN-a) i
  **generički SMS `http` adapter** (T12-6, bez provajdera), commit `f11ace4`. Verifikacija: lint 5/5,
  typecheck 5/5, web build, **333 testa** (shared 51, api 168, web 17, mobile 97) i integracije
  15/15 + 4/4. Push prošao;
  [CI run 44935671851](https://github.com/rakita-milos/digitalni-asistent-fakture/actions/runs/44935671851)
  i [run 44937857283](https://github.com/rakita-milos/digitalni-asistent-fakture/actions/runs/44937857283)
  i [run 44948453986](https://github.com/rakita-milos/digitalni-asistent-fakture/actions/runs/44948453986)
  **zeleni 4/4**. Ostaje: DSN, R2, SMS ugovor, staging, fizički uređaji.
- **Sljedeće kod (bez čekanja):** nema otvorenih stavki koje ne čekaju nalog/odluku; samo bugfixevi
  iz testiranja na uređajima i pilota.
- **Sljedeće tvoje akcije:** Sentry DSN, R2 ključevi, SMS provajder + sender ID, staging + backup
  restore, 3 fizička uređaja (offline/biometrija/slanje), Play Console + finalni brend/keystore +
  screenshotovi, pravnik, računovođa, G0 upit operateru, pilot 5–15 korisnika (`docs/PILOT_KIT.md`).

---

## Istorija sprintova

| Sprint | Status | Datum |
|---|---|---|
| 0 — kostur monorepo-a | završen | 2026-11-09 |
| 1 — auth, firma, kupci, artikli | završen | 2026-11-09 |
| 2 — faktura (obračun, draft, lista, detalj) | završen | 2026-11-09 |
| 3 — fiskalizacija (mock), numeracija, PDF/QR | završen | 2026-11-09 |
| 4 — naplata, podsjetnici, izvještaji | završen | 2026-11-09 |
| 5 — poništenje, refundacija, worker, sync, mobilni offline | završen | 2026-11-09 |
| 6 — web MVP (W-01…W-08: editor, kupci, izvještaji, podešavanja) | završen | 2026-11-09 |
| 7 — mobilne fakture (M-02, M-05…M-12, offline, izmjena drafta) | završen | 2026-11-10 |
| 8 — stabilizacija (silent refresh, CI android job) | zatvoren; 3 stavke → Sprint 10 | 2026-11-10 |
| 9 — zatvaranje MVP rupa (reset, send, GDPR, e2e, bulk, flagovi, logout) | završen | 2026-11-12 |
| 10 — integracije (R2 kod, CI e2e job, Sentry kod; čekaju kredencijali) | u pripremi | 2026-11-12 |
| 11 — audit/pilot kit/analitika/Play priprema + offline retry/EXPLAIN (kredit čeka odluku) | u pripremi | 2026-11-13 |

## Kako ažurirati (na kraju sesije)

1. Premjesti završene stavke iz „Nije urađeno“ u „Urađeno“.
2. Upiši nove blokade i otvorena pitanja.
3. Upiši „Sljedeći korak“ jednom rečenicom.
4. Ne briši istoriju — dodaj novi sprint ispod.