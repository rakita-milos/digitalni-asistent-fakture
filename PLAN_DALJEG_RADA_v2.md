# Plan daljeg rada — Digitalni Asistent (v2.0)

> Verzija 2.0 · 16.11.2026. · zamjenjuje `PLAN_DALJEG_RADA.md` v1.0 (12.11.2026).
> Prati: `PROGRESS.md` (stanje), `MASTER_PROMPT` (spec), `docs/PRE_DEPLOYMENT_AUDIT.md`,
> `docs/PLAY_RELEASE.md`, `docs/PILOT_KIT.md`.
> Pravilo: **jedan sprint = jedan chat**; svaki zadatak ima definiciju gotovog (DoD); bez dokaza nema
> „urađeno“; sve van scope-a ide u parking, ne u sprint.

## 1. Polazna tačka (provjereno 16.11.2026)

| Oblast | Stanje | Dokaz |
|---|---|---|
| Kod (Sprint 0–11 + S11-8) | funkcionalno kompletan za pilot sa PRAČUNIMA i mock fiskalizacijom | `PROGRESS.md` |
| Testovi | **316** unit/API + **9** Playwright e2e — svi zeleni | shared 51, api 159, web 13, mobile 93; e2e 9/9 (31,8 s) |
| Provjere | `lint` 5/5, `typecheck` 5/5, `build` 3/3, `prisma migrate deploy` | izvršeno lokalno 16.11. |
| Web/Mobile funkcije | M-01 (biometrija), M-08 (slanje fakture), M-12 (profil/lozinka), W-08 (artikli) | commit-i `150c980`, `7158b70` |
| Zdravlje sistema | `/health` readiness (baza + Redis) sa retry-em; `x-request-id`; rate limiti | commit `c03c505` |
| Android build | JDK 17, Gradle 9.4.1, SDK 37, NDK 27.1, CMake spremni; build pada na Windows long-pathu (`op-sqlite`) | `README` Troubleshooting |
| CI | jobovi `verify`, `e2e`, `android` spremni; **nisu pokrenuti** (nema remote-a) | `.github/workflows/ci.yml` |
| Blokade | GitHub pristup, uređaji, SMS, staging, Sentry/R2, Play, pravnik, računovođa, G0 | sekcija 9 |

**Jedna rečenica:** kod je zatvoren; od sada je posao **release engineering + verifikacija + pilot**, ne
pisanje funkcija. Sve nove funkcije idu u parking dok pilot ne pokaže potrebu.

## 2. Šta se promijenilo od v1 (S11-8, 16.11.2026)

| v1 stavka | Status sada |
|---|---|
| M-01 biometrija „dolazi kasnije“ | urađeno: Keychain + zaključan ekran + 9 testova; čeka uređaj |
| Slanje fakture iz mobilne (opciono) | urađeno (kanal e-mail/SMS, primalac, poruka) |
| M-12 profil/lozinka „web reset tok“ | urađeno native: `PATCH /auth/me`, `POST /auth/change-password`, ekran Nalog |
| `PATCH /items/:id` „kad se odluči“ | urađeno + web sekcija „Artikli“ + e2e scenario |
| e2e rate limiter „realni Redis“ | urađeno (`test/rate-limit.e2e-spec.ts`) |
| Health 503 na startu | nađeno i popravljeno (retry) |

v1 sekcija „Sljedeće kod (bez čekanja)“ je **zatvorena** — nema više kod-zadataka koji ne čekaju
odluku ili nalog. Zato v2 mijenja fokus na isporuku.

## 3. Strategija: tri kolone rada

| Kolona | Šta je | Ko | Sada |
|---|---|---|---|
| A — kod bez zavisnosti | bugfixevi i alat | ja | skoro prazna: samo popravke iz testiranja na uređajima |
| B — tvoje akcije | nalozi, odluke, uređaji, ljudi | ti | **kritični put** (GitHub, SMS, staging, Play, pravnik, pilot) |
| C — integracije | kod + kredencijali | ja + ti | Sentry, R2, SMS, staging, backup/restore |

Pravila:

- Ne čekamo G0: pilot ide sa PRAČUNIMA i mock fiskalizacijom; prava fiskalizacija je zaseban ciklus.
- Redoslijed je **zavisnosni**, ne vremenski: GitHub → CI → APK → uređaji → SMS → staging/restore →
  Play → pilot.
- Svaki zadatak: commit + test/dokaz + unos u `PROGRESS.md`.
- Kapija sprinta se ne pomjera; ako nešto kasni, izbacuje se iz sprinta, ne produzuje rok.

## 4. Kritični put i kapije

```
G12 (23.11)  CI zelen + APK + Sentry/R2/SMS/staging/restore
   └─> G13 (30.11)  AAB na internal tracku + pravni paket objavljen
          └─> G14 (22.12)  pilot 5–15 korisnika, metrike, odluka o G0 planu
                 └─> G0 odgovor + 3–6 nedjelja → prava fiskalizacija
```

| Kapija | Datum | Uslov |
|---|---|---|
| **G12** | 23.11.2026 | CI `verify`+`e2e`+`android` zeleni; APK instaliran na 3 uređaja; Sentry prima testnu grešku; PDF preko R2 signed URL-a; SMS na 2 test broja; staging smoke; restore < 30 min; 0 P1 bugova |
| **G13** | 30.11.2026 | AAB učitan (internal testing); ToS/privatnost objavljeni; Data Safety popunjen; checklist ≥ 28/32 ✅ |
| **G14** | 22.12.2026 | ≥ 70 % pilota izda račun bez pomoći; ≥ 50 % pošalje podsjetnik; NPS ≥ 30; 0 blokatora; odluka o G0 planu |

## 5. Sprint 12 — Release engineering (17–23.11.2026)

**Cilj:** sve vanjske integracije rade na stagingu, APK na uređajima, CI zelen.
**Trajanje:** 5–7 radnih dana, paralelno sa tvojim akcijama.

### T12-1 GitHub + prvi CI run (B → A)

- **Tvoj korak:** `gh auth login` (ili token) → otvori repo → `git push -u origin master` → dodaj
  secrets (`JWT_*`, `DATABASE_URL`, `REDIS_URL`, `SMS_*`, `R2_*`, `SENTRY_DSN`).
- **Moj korak:** pokrenuti `verify`/`e2e`/`android`; popraviti CI-only probleme; branch protection;
  badge u README; potvrditi APK artifact i Playwright izvještaj.
- **DoD:** 3 joba zelena na `master`; APK artifact se preuzima; CI < 40 min; `NODE_OPTIONS` i linkovi za
  pnpm hoisted rade na Linuxu.
- **Status 16.11.2026 — urađeno:** repo `rakita-milos/digitalni-asistent-fakture` (public, grana `main`);
  prvi run pao na `android-actions/setup-android@v3` (prije projekta) → zamijenjen preinstaliranim SDK-om;
  drugi run **zelen 4/4** (8 min 43 s: verify 2:29, e2e 1:26, compose 0:06, android 8:38), APK artifact
  `digitalni-asistent-debug-apk` ~49 MB. Ostaje: branch protection (vlasnik) i badge (dodat).

### T12-2 APK fallback (A, opciono — samo ako T12-1 kasni)

- Build iz kratke putanje: kopija repoa u `C:\da`, `pnpm install`, `gradlew assembleDebug
  -PreactNativeArchitectures=arm64-v8a` (JDK/SDK su već u `.tools`).
- **DoD:** `app-debug.apk` postoji i instalira se na jedan uređaj.
- **Status 16.11.2026:** nije trebao — APK je napravljen kroz CI (`T12-1`); lokalni Windows build i dalje
  pada na long-path limitu, ali to više nije blokada.

### T12-3 Test matrica na 3 uređaja (B)

- Uređaji: jeftin (Android 10–12), srednji, nov (Android 15/16).
- Scenario po uređaju: prijava → setup → nova faktura (2 stavke, PDV) → izdavanje (mock) → PDF/QR →
  naplata → **offline** (avionski režim: draft lokalno, sync po povratku) → **biometrija** (uključi,
  restart, otključaj, otkaži prompt, promijeni otisak) → **slanje fakture** e-mail/SMS.
- **DoD:** tabela uređaja/verzija/rezultat u `PROGRESS.md`; svaki pad = issue sa koracima; 0 crash-eva.
- **Status 17.11.2026 (dio, emulator Android 17 / API 37):** APK iz CI-ja instaliran i pokrenut;
  provjereni prijava (demo nalog), početna sa aging-om, lista faktura (50), detalj sa PFR + QR,
  **slanje fakture e-mailom** (log adapter) i ekran **Nalog**; na uređaju bez biometrije dugme se ne
  prikazuje (očekivano). **Nađen i popravljen P1 bug:** mobilni klijent nije imao refresh access tokena,
  pa je poslije 15 min svaki poziv padao („Neispravan ili istekao access token“) — sada single-flight
  refresh na 401 + 4 testa (mobile 97/97). Fizička 3 uređaja (offline, biometrija, SMS) ostaju.

### T12-4 Sentry DSN + web instrumentacija (C)

- DSN u API i worker (već postoji `MonitoringService`), `@sentry/nextjs` u web; release = commit SHA;
  scrub PII; alarmi: 5xx stopa, p95, queue backlog, `FISCAL_ALARM`, SMS fail.
- **DoD:** testna greška vidljiva sa `x-request-id`; alarm stiže na e-mail/Slack.
- **Status 21.11.2026 (dio):** web instrumentacija urađena bez `@sentry/nextjs` — `apps/web/instrumentation.ts`
  (Next 15 `register`/`onRequestError`, `@sentry/node` u `serverExternalPackages`, `request_id`/ruta tagovi)
  + 4 testa, commit `f11ace4`; kompajlirana instrumentacija provjerena lokalno (envelope sa
  `request_id`/ruta tagovima, `tools/local-integration/verify-sentry.mjs` 4/4). DSN nije postavljen,
  pa provjera testne greške i alarma ostaje.

### T12-5 R2 ključevi i signed URL (C)

- Bucket, lifecycle za stare PDF-ove, TTL ≤ 15 min; `GET /invoices/:id/pdf` → 302.
- **DoD:** PDF preko signed URL-a; link poslije TTL-a ne radi; streaming fallback i dalje radi.
- **Status 21.11.2026 (dio):** PDF tok provjeren protiv lokalnog S3 (`tools/local-integration`): 302 na
  presigned URL sa `Expires=900`, PDF se servira, drugi poziv `HEAD` bez novog uploada, streaming
  fallback bez R2. Bucket/ključevi i istek potpisa na stvarnom R2 ostaju.

### T12-6 SMS provajder (C)

- Adapter u `SmsService` (izabrani provajder), sender ID, retry/backoff, log bez PII, limit 10/min.
- **DoD:** OTP i ručni podsjetnik stižu na 2 broja; trošak vidljiv u panelu; opt-out poštovan.
- **Status 21.11.2026 (dio):** generički `http` adapter u `SmsService` (JSON POST na `SMS_HTTP_URL`,
  Bearer token, sender ID, timeout 1–15 s, greška bez tijela odgovora) + 9 testova, commit `f11ace4`;
  end-to-end provjera (OTP + ručni podsjetnik) protiv lokalnog endpointa 15/15. Konkretan provajder,
  kredencijali, test na 2 broja i opt-out provjera ostaju.

### T12-7 Staging deploy (C)

- Web (Vercel) + API/worker (Railway/Fly) + Neon Postgres + Upstash Redis + R2; migracije kroz CI;
  demo seed; `docs/STAGING_DEPLOY.md` kao procedura.
- **DoD:** staging URL radi (prijava, faktura, PDF, podsjetnik); `prisma migrate status` up to date.

### T12-8 Backup i test restore (C)

- Neon PITR + dnevni dump u R2; restore drill u staging.
- **DoD:** restore < 30 min; 50 seed faktura kompletno; procedura ažurirana.
- **Status 17.11.2026 (dio, lokalno):** `pg_dump -Fc` (48,9 KB) → `pg_restore` u `da_restore` za **3,7 s**;
  brojevi identični (50 faktura, 20 kupaca, 10 artikala, 2 firme); restore baza obrisana. Staging restore
  (Neon PITR) čeka nalog.

**Kapija G12:** vidi tabelu u sekciji 4.

## 6. Sprint 13 — Store i pravni paket (24–30.11.2026)

### T13-1 Brend i store materijal (B)

- Finalni package name, ikona 512×512, feature graphic 1024×500, 4–8 screenshotova, opis (bs/en).
- **DoD:** materijal u `apps/mobile/assets` + `docs/PLAY_RELEASE.md` ažuriran; nema placeholdera.

### T13-2 AAB, potpisivanje i internal testing (B → A)

- Keystore (2 kopije, van repoa), `signingConfigs` iz `keystore.properties`/`DA_*`, AAB kroz CI.
- **DoD:** AAB učitan na internal track; instalacija sa Play-a na 2 uređaja; verzija `1.0.0 (1)`.

### T13-3 Store listing i Data Safety (B)

- Listing tekst, content rating, Data Safety odgovori iz `docs/PLAY_RELEASE.md` §4; politika privatnosti
  link.
- **DoD:** sve forme popunjene; nema „requires attention“ upozorenja.

### T13-4 Pravni paket (B)

- Pravnik pregledao `docs/LEGAL_DRAFT.md`; objavljene stranice `/privacy` i `/terms`; DPA za
  podprocesore (Neon, Vercel, R2, SMS, Sentry); linkovi u app/web.
- **DoD:** stranice dostupne bez prijave; verzija i datum objave; GDPR tok (izvoz/brisanje) usklađen.

### T13-5 Security/quality pass (A)

- `pnpm audit` (bez P1), rate limiti u produkciji, CORS, tajne van repoa, `pnpm test` + e2e na stagingu,
  provjera `FEATURE_*` flagova, rotacija ključeva.
- **DoD:** nalazi upisani u `docs/PRE_DEPLOYMENT_AUDIT.md`; 0 P1, P2 planiran.
- **Status 21.11.2026 (dio):** `pnpm audit` — produkcija **0 high/critical** (34 → 6 nalaza, 4 moderate
  + 2 low), ukupno 46 → 13 (2 critical dev-only `tinypool`); 11 ciljanih override-a; poslije: lint 5/5,
  typecheck 5/5, build 3/3, 333 testa, e2e 9/9, `prisma validate`/`status` ✅. Nalazi i P2 plan:
  `docs/SECURITY_AUDIT.md`. Ostaje: `pnpm audit` na stagingu, rotacija ključeva, provjera flagova.

### T13-6 Release checklist (A)

- `Pre-Deployment_Checklist` ažuriran dokazima; rollback procedura testirana na stagingu.
- **DoD:** checklist ≥ 28/32 ✅; rollback vježba zabilježena.

**Kapija G13:** vidi sekciju 4.

## 7. Sprint 14 — Pilot (1–22.12.2026)

### T14-1 Onboarding 5–15 korisnika (B)

- Pozivi, demo nalog, checklist iz `docs/PILOT_KIT.md`; support kanal.
- **DoD:** 5 aktivnih firmi; svaka izdala bar 1 račun.

### T14-2 Metrike i praćenje (A)

- `pnpm --filter api metrics:platform` sedmično; tabela u `docs/PILOT_KIT.md`; NPS upitnik poslije 7 dana.
- **DoD:** sedmični izvještaj (registracije, izdate fakture, naplate, podsjetnici, greške).

### T14-3 Triage i bugfix ciklus (A)

- Petak: trijaža (P1 = blokira izdavanje računa); P1 fix u 24 h; P2 u narednoj sedmici.
- **DoD:** 0 otvorenih P1 na kraju sprinta; svaki fix ima test.

### T14-4 Exit report i odluka o G0 (A + B)

- Šta je radilo, šta nije, koje funkcije traže piloti, procjena za pravu fiskalizaciju.
- **DoD:** dokument `docs/PILOT_REPORT.md`; odluka: produžiti pilot / ići na produkciju / čekati G0.

**Kapija G14:** vidi sekciju 4.

## 8. Poslije G0 — prava fiskalizacija (zaseban ciklus, 3–6 nedjelja)

**Ulaz:** odgovor operatera (model, cijena po dokumentu, test okruženje, sertifikat, PFR format).

- ESIR adapter (zamjena mock-a, ista arhitektura), PFR/QR po Pravilniku 95/25.
- Storno fiskalizacija VOID/REFUND; offline do 5 dana; retry/alarm.
- Testovi sa operaterom i potvrda formata računa.
- Paralelno: računovođa — PDV tretman refundacije, format numeracije, paušalni limit.

## 9. Tvoje akcije (paralelno sa kodom)

| # | Akcija | Zašto | Rok | Dokument |
|---|---|---|---|---|
| 1 | `gh auth login` + GitHub repo i push `master` | CI, APK, release | **17.11.** | — |
| 2 | Uređaji (3 komada) + USB debug | test matrica | 19.11. | — |
| 3 | SMS provajder: 2–3 ponude, sender ID | T12-6 | 19.11. | — |
| 4 | Sentry, R2, Neon, Vercel, Upstash nalozi | T12-4/5/7 | 19.11. | — |
| 5 | Play Console nalog + finalni brend/logo | T13-1/2 | 21.11. | `docs/PLAY_RELEASE.md` |
| 6 | Pravnik: ToS, privatnost, DPA | T13-4 | 24.11. | `docs/LEGAL_DRAFT.md` |
| 7 | Računovođa: PDV refundacije, numeracija, paušal | odluke | 24.11. | pitanja u ovom planu |
| 8 | Upit operateru ESIR (ako nije poslan) | G0 | 20.11. | `Upit_Operateru_ESIR.docx` |
| 9 | Pilot: 5–15 majstora | G14 | 28.11. | `docs/PILOT_KIT.md` |

## 10. Odluke prije Sprinta 12

| # | Odluka | Opcije | Preporuka | Ko |
|---|---|---|---|---|
| 1 | Kredit pri preplati (S11-2b) | polje na `customers` / credit ledger / ostaje odbijanje | polje za MVP | ti + računovođa |
| 2 | Promjena e-maila bez verifikacije | ostaje uz lozinku / verifikacijski kod | ostaje za MVP, revizija poslije pilota | ti |
| 3 | Play package name | `com.digitalniasistent` / brend | brend prije T13-2 | ti |
| 4 | SMS provajder | domaći / regionalni | po cijeni i sender ID-u | ti |
| 5 | Web push / notifikacije | ostaje odgođeno | odgođeno (anti-scope) | ti |

## 11. Prvih 7 dana — konkretan redoslijed

1. **Dan 1 (17.11.):** `gh auth login` → push → CI run; ja popravljam CI-only greške.
2. **Dan 1–2:** APK iz CI-ja (ili T12-2 fallback); instalacija na prvi uređaj.
3. **Dan 2–3:** test matrica 3 uređaja (offline + biometrija + slanje fakture); P1 fixevi.
4. **Dan 3:** Sentry DSN + R2 ključevi; testna greška i signed PDF.
5. **Dan 4:** SMS adapter i test na 2 broja.
6. **Dan 5:** staging deploy + demo seed; smoke.
7. **Dan 6:** backup/restore drill; checklist update.
8. **Dan 7 (23.11.):** kapija G12 — pregled dokaza, odluka da li Sprint 13 kreće.

## 12. Rizici i mitigacije

| Rizik | Vjerovatnoća | Uticaj | Mitigacija |
|---|---|---|---|
| GitHub pristup kasni | srednja | visok | T12-2 fallback (APK lokalno iz `C:\da`); CI čim pristup dođe |
| Windows long-path blokira APK | visoka lokalno | srednji | build kroz CI (Linux) ili `C:\da`; dokumentovano u README |
| Biometrija/offline rade samo u testovima | srednja | visok | T12-3 matrica na 3 uređaja prije pilota |
| SMS bez opt-outa / sender ID-a | srednja | visok | opt-out urađen; sender ID prije uključivanja |
| Restore nije testiran | srednja | visok | T12-8 obavezan prije pilota |
| Pilot koristi PRAČUNE, očekuje fiskalni račun | visoka | visok | jasna komunikacija u onboarding-u; G0 status u pilot kitu |
| CI prvi put padne (nikad nije radio) | visoka | srednji | prvi dan rezervisan za CI popravke; lokalni CI ekvivalent već zelen |
| Scope creep u pilotu | visoka | srednji | samo P1/P2 bugfix; nove funkcije u parking |

## 13. Definicija gotovog (pilot → produkcija)

| Stavka (§17) | Stanje | Gdje se zatvara |
|---|---|---|
| Registracija + setup + EFD | setup radi; EFD mock do G0 | G0 |
| Kupac + stavka + faktura < 30 s | radi | — |
| Fiskalizacija + QR + PDF | mock; prava poslije G0 | G0 |
| Naplata (puna/djelimična) | radi | — |
| SMS podsjetnici | log adapter | T12-6 |
| Dashboard sa tačnim aging-om | radi | — |
| Offline + sync na uređaju | kod radi; nije testirano na telefonu | T12-3 |
| Biometrijska prijava | kod + testovi; nije testirano na telefonu | T12-3 |
| Refundacija + poništenje | radi (mock PFR) | G0 za PFR |
| PRAČUN sa oznakom | radi | — |
| 5–15 pilot korisnika | nije počelo | T14-1 |

## 14. Kalendar (procjena, ne obećanje)

| Period | Fokus | Rezultat |
|---|---|---|
| 17–23.11. | Sprint 12 — release engineering | CI zelen, APK na uređajima, integracije rade |
| 24–30.11. | Sprint 13 — store i pravni paket | AAB na internal tracku, pravni paket objavljen |
| 1–22.12. | Sprint 14 — pilot | 5–15 korisnika, metrike, exit report |
| od G0 + 3–6 ned. | prava fiskalizacija | ESIR adapter, PFR/QR, storno |

## 15. Kako pratimo napredak

- Početak sprinta: priložiti `MASTER_PROMPT`, `PROGRESS.md` i ovaj plan.
- Svaki zadatak: commit + test/dokaz + unos u `PROGRESS.md` (urađeno / nije / blokada / sljedeće).
- Petak: status kapije, blokade, odluke, plan za sljedeću sedmicu.
- Sprint je gotov kad je kapija ispunjena i dokumentacija ažurna — ne kad je kod napisan.

## 16. Anti-scope (ostaje zamrznut)

- iOS, multi-user/radnici, bankovni izvodi, knjigovodstvo/KPR/PDV prijave, inventar, plate.
- Tamna tema, ćirilica, offline web, kartična naplata pretplate, agencijski multi-client.
- Push notifikacije osim registracije tokena.
- Sve što nije u §15 i nije neophodno za pilot — parking lista, ne sprint.
