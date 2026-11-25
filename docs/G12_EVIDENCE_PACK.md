# G12 — dokazni paket i matrica uređaja

> Verzija 1.0 · 25. 11. 2026. · Prati: `PLAN_DALJEG_RADA_v3.md` §3.1, §5 i §13,
> `docs/INTEGRATIONS_GO_LIVE.md`, `docs/STAGING_DEPLOY.md`, `docs/PLAY_RELEASE.md`.
> Pravilo: **bez dokaza nema ✅**. Ovo je jedini izvor za G12 pregled — prazno polje znači
> „nije dokazano“, ne „urađeno“. Dokazi se poslije upisuju i u `PROGRESS.md`.

**Stanje 25. 11. 2026: 2/8.** Ispunjeni su CI i APK; ostalih šest čeka naloge i uređaje.
`pnpm release:preflight` (bez `--devices`) daje **5/12**; sa telefonima **5/13**.

## 1. Tabela kapije

| #   | Uslov G12                                       | Stanje | Dokaz koji se prilaže                                                                                                             | Ko                 |
| --- | ----------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | CI `verify` + `e2e` + `android` zeleni          | ✅     | [run #30](https://github.com/rakita-milos/digitalni-asistent-fakture/actions/runs/45605101499) na `9d9e72a`; 5/5 izvršenih jobova | —                  |
| 2   | APK artifact se preuzima                        | ✅     | `digitalni-asistent-debug-apk`, ~51,5 MB                                                                                          | —                  |
| 3   | APK na **3 fizička uređaja** + matrica          | ⏳     | §4 ovog fajla, popunjena tabela                                                                                                   | ti + ja            |
| 4   | Sentry prima testnu grešku + alarmi             | ⏳     | link na event sa `request_id` + screenshot alarma                                                                                 | ti (DSN) + ja      |
| 5   | PDF preko **pravog** R2 + istek TTL-a           | ⏳     | `302` sa `X-Amz-Expires=900`, download `%PDF`, `403` poslije TTL-a                                                                | ti (ključevi) + ja |
| 6   | SMS na **2 broja** (OTP + podsjetnik) + opt-out | ⏳     | 2 potvrđene poruke, sender ID, `409` za opt-out                                                                                   | ti (ugovor) + ja   |
| 7   | Staging smoke (prijava, faktura, PDF)           | ⏳     | `smoke --json` izlaz + staging URL                                                                                                | ti (nalozi) + ja   |
| 8   | Restore < 30 min sa 50 faktura                  | ⏳     | trajanje + brojevi iz SQL provjere                                                                                                | ti (Neon) + ja     |

## 2. Redoslijed izvršenja

Zavisnost je jednostavna: **staging prvi**, jer se na njemu provjeravaju Sentry, R2, SMS i restore.

| Dan | Šta                                                                           | Završeno kada                              |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | Neon + Upstash + Vercel + Railway/Fly; `migrate deploy`; demo seed; `/health` | `/health` 200, `migrate status` up to date |
| 2   | Sentry DSN (API/web/worker) + testna greška + alarmi; R2 ključevi + 302/403   | event sa tagovima, 302 i 403               |
| 3   | SMS na 2 broja + opt-out; restore drill iz Neon PITR                          | 2 SMS-a, restore < 30 min                  |
| 4–5 | Matrica 3 uređaja (§4); popunjavanje §1 i §5                                  | 15/15 scenarija, 0 P1                      |

Ako nalog ne stigne na vrijeme, taj red se **izbacuje iz sprinta** i kapija klizi za nedjelju
(`PLAN_DALJEG_RADA_v3.md` §9) — ne otvara se G13 sa rupom.

## 3. Dokaz po stavci

### 3.1 Staging (T12-7)

Detalji: `docs/STAGING_DEPLOY.md` §4. Minimalni dokaz:

```bash
curl -s "$STAGING_API_URL/health" | jq          # 200, checks.db i checks.redis ok
cd digitalni-asistent
STAGING_API_URL="$STAGING_API_URL" SMOKE_EMAIL="$SMOKE_EMAIL" SMOKE_PASSWORD="$SMOKE_PASSWORD" \
  node tools/staging-smoke.mjs --json > staging-smoke.json
```

Očekivano: svih **8 provjera** prolazi (health, prijava, kupci, fakture, detalj, PDF, draft,
izdavanje + PFR). Sačuvati `staging-smoke.json` i URL staginga.

### 3.2 Sentry (T12-4)

Detalji: `docs/INTEGRATIONS_GO_LIVE.md` §1. Dokaz:

1. `SENTRY_DSN` postavljen za API, worker i web; `APP_RELEASE=$(git rev-parse --short HEAD)`.
2. Testna greška iz API-ja i iz web server action-a.
3. Event u Sentry-ju ima `request_id`, `http_path`/`route` i `release`.
4. Alarmi: 5xx > 1 %, p95 > 2 s, `FISCAL_ALARM`, worker bez heartbeat-a, queue backlog > 100,
   SMS greške — screenshot svakog.

### 3.3 R2 (T12-5)

Detalji: `docs/INTEGRATIONS_GO_LIVE.md` §2. Dokaz:

```bash
# API, TOKEN i ID kao u runbook-u §2 (prijava demo nalogom, prva faktura)
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$API/invoices/$ID/pdf" -H "authorization: Bearer $TOKEN"
# 302 ...X-Amz-Signature=...&X-Amz-Expires=900
```

Zatim: download vraća `200` i `%PDF`; sa `R2_SIGNED_URL_TTL_SECONDS=60` link poslije 2 min daje
`403`; bez R2 env PDF se streamuje (`200`, bez `Location`).

### 3.4 SMS (T12-6)

Detalji: `docs/INTEGRATIONS_GO_LIVE.md` §3. Dokaz:

- OTP na **2 broja** (2 mreže) — poruka stigne, sender ID tačan.
- Ručni podsjetnik na izdatu fakturu — poruka stigne sa brojem i iznosom.
- Kupac sa `reminder_opt_out` → `409`, poruka se ne šalje.
- Cijena po SMS-u iz panela provajdera upisana u `PROGRESS.md`.

### 3.5 Restore (T12-8)

Detalji: `docs/INTEGRATIONS_GO_LIVE.md` §5. Dokaz: Neon PITR/branch → `pg_restore`; brojevi
**50 faktura / 20 kupaca / 10 artikala** identični; ukupno trajanje **< 30 min**; aplikacija radi
na restore bazi. Lokalni drill je 3,2 s — staging broj je onaj koji se upisuje.

### 3.6 Uređaji (T12-3)

Matrica u §4. Instalacija ide iz APK artifacta (ili AAB-a kad keystore postoji), ne iz lokalnog
build-a. Na svakom uređaju uključen USB debugging i „Stay awake“.

## 4. Matrica uređaja

### 4.1 Uređaji

|                    | U1 — jeftin  | U2 — srednji | U3 — nov     |
| ------------------ | ------------ | ------------ | ------------ |
| Model              |              |              |              |
| Android verzija    | 10–11        | 12–13        | 15–16        |
| Aplikacija / build |              |              |              |
| Izvor instalacije  | APK artifact | APK artifact | APK artifact |
| Tester / datum     |              |              |              |

### 4.2 Scenariji

Popuniti `✅` / `❌` / `—` (nije primjenjivo). Svaki `❌` dobija kratku napomenu i, ako je bug,
issue bez PII. **Bilo koji crash ili blokada toka = P1 i zaustavlja kapiju.**

| #   | Scenario                                | Očekivano                                    | U1  | U2  | U3  | Napomena |
| --- | --------------------------------------- | -------------------------------------------- | --- | --- | --- | -------- |
| 1   | Instalacija i prvi start                | app se otvara, traži prijavu, bez crasha     |     |     |     |          |
| 2   | Prijava demo nalogom                    | početna se učitava, sesija traje             |     |     |     |          |
| 3   | Biometrija: uključi, restart, otključaj | LockScreen, otisak otključava                |     |     |     |          |
| 4   | Biometrija: otkaži prompt               | ostaje zaključano; „Nastavi lozinkom“ radi   |     |     |     |          |
| 5   | Početna                                 | KPI + aging se učitavaju                     |     |     |     |          |
| 6   | Lista faktura                           | 50 faktura (demo seed), filteri rade         |     |     |     |          |
| 7   | Detalj izdate fakture                   | PFR + QR vidljivi                            |     |     |     |          |
| 8   | Izdavanje drafta (2 stavke + PDV)       | broj dodijeljen, status `ISSUED`             |     |     |     |          |
| 9   | PDF                                     | otvara se, sadrži PFR/QR                     |     |     |     |          |
| 10  | Naplata (puna i djelimična)             | `PAID` / `PARTIALLY_PAID`, iznos tačan       |     |     |     |          |
| 11  | Podsjetnik SMS                          | poruka stigne; opt-out kupac → `409`         |     |     |     |          |
| 12  | Slanje fakture e-mail/SMS               | primalac dobije link/PDF                     |     |     |     |          |
| 13  | Offline: draft pa sync                  | draft lokalno, poslije mreže server broj     |     |     |     |          |
| 14  | Nalog: profil, lozinka, odjava          | izmjene rade; odjava briše sesiju            |     |     |     |          |
| 15  | Uređaj bez biometrije                   | dugme se ne prikazuje, prijava lozinkom radi |     |     |     |          |

### 4.3 Pravila mjerenja

- Testira se build iz CI artifacta (debug APK dok nema keystore-a), ne build sa lokalnog računara.
- Offline scenario: uključi airplane mode **prije** otvaranja forme; provjeri da nema crasha i da
  se draft vidi u listi sa oznakom lokalne izmjene.
- Biometrija: poslije promjene otiska (dodaj novi otisak u sistemu) upamćena prijava mora pasti na
  lozinku — zabilježi ponašanje.
- Fotografije ekrana za `❌` idu u `docs/g12/` (bez stvarnih podataka kupaca).

## 5. Sign-off

| Stavka                | Dokaz                | Datum | Potpis |
| --------------------- | -------------------- | ----- | ------ |
| Sentry event + alarmi | link                 |       |        |
| R2 302 + 403          | isječak komande      |       |        |
| SMS 2 broja + opt-out | screenshot           |       |        |
| Staging smoke 8/8     | `staging-smoke.json` |       |        |
| Restore < 30 min      | trajanje + SQL       |       |        |
| Matrica 3 uređaja     | §4 popunjena         |       |        |
| **P1 otvorenih**      | **0**                |       |        |

**Odluka:** G12 ispunjen / odgođen za `____` (zaokružiti). Kapija se proglašava ispunjenom samo
kad su svi redovi §1 ✅ i kada je §5 potpisan.

## 6. Šta je već dokazano bez naloga (25. 11.)

- CI #30 na `9d9e72a`: verify (lint/typecheck/test/build), e2e, integracije, android APK, compose — ✅.
- `release:preflight`: 5/12; `check-signing` OK (debug potpis dok nema keystore-a).
- Lokalno: smoke 8/8, restore 3,2 s, rollback 1,3 s / 7,0 s, pilot dry-run 22/22.
- Pravne stranice implementirane, AAB pipeline, Play screenshotovi i audit — urađeni 23. 11.
  (Sprint 12B); objava stranica i potpisan AAB čekaju pravnika/keystore.

## 7. Ažuriranje

Poslije svake stavke: upiši dokaz u §1 i §5, pa u `PROGRESS.md` (i `INTEGRATIONS_GO_LIVE.md` §6).
Ne brisati stare redove — kapija mora ostati dokaziva i poslije pilota.
