# Plan daljeg rada — Digitalni Asistent (v3.0)

> Verzija 3.0 · 23.11.2026. · zamjenjuje `PLAN_DALJEG_RADA_v2.md` (16.11.2026).
> Izvor stanja: `PROGRESS.md`, git `main @ 1ef72bf` (22.11. 00:00), CI run #11
> ([44959718369](https://github.com/rakita-milos/digitalni-asistent-fakture/actions/runs/44959718369)),
> `docs/PRE_DEPLOYMENT_AUDIT.md`, `docs/SECURITY_AUDIT.md`, `docs/INTEGRATIONS_GO_LIVE.md`.
> Pravilo ostaje: **jedan sprint = jedan chat**; svaki zadatak ima DoD; bez dokaza nema „urađeno“;
> sve van scope-a ide u parking, ne u sprint.

## 1. Kratak zaključak

1. **Kod je i dalje zatvoren** — 333 testa, e2e 9/9, CI 5/5 zelen, 0 high/critical u produkciji; nema
   otvorenih kod-zadataka iz v2 plana.
2. **Kapija G12 (23.11.) nije ispunjena: 2/8.** Ispunjeni su CI i APK artifact; ostalih 6 uslova čeka
   **tvoje naloge i uređaje** (Sentry, R2, SMS, staging, restore, 3 telefona).
3. Pregledom koda 23.11. nađene su **4 rupe koje nisu bile u v2 planu**, a mogu se zatvoriti bez ijednog
   naloga: nema `/privacy` i `/terms` stranica, nema CI joba za AAB, nema skripte za staging smoke i nema
   Play screenshotova. One su sada **Sprint 12B** i idu prve.
4. Realan raspored ako nalozi i uređaji stignu do **petka 27.11.**: **G12 → 30.11.**, **G13 → 7.12.**,
   **pilot 8.12.–8.1.**, **G14 → 11.1.2027.**

## 2. Provjereno stanje (23.11.2026)

| Oblast | Stanje | Dokaz |
|---|---|---|
| Repo | `rakita-milos/digitalni-asistent-fakture`, `main`, radno stablo čisto | `git status`, HEAD `1ef72bf` |
| CI | **5/5 zeleno** (verify, e2e, compose, android, integracije); 11 runova, posljednji #11 uspješan | run `44959718369`, 21.11. 23:11 |
| Testovi | 333 unit/API (shared 51, api 168, web 17, mobile 97) + e2e 9/9 | PROGRESS, 21.11. |
| Provjere | lint 5/5, typecheck 5/5, build 3/3, `prisma migrate status` ✅ | 21.11. |
| Sigurnost | produkcija **0 high/critical**; 6 nalaza (4 moderate, 2 low); P2 planiran | `docs/SECURITY_AUDIT.md` |
| APK | artifact 51.466.880 B; testiran na emulatoru Android 17/API 37 | PROGRESS T12-3 |
| Integracije (kod) | Sentry web instrumentacija, R2 signed URL, SMS `http` adapter + 9 testova; CI job `integracije` | `f11ace4`, `80f1bcb` |
| Integracije (dokaz) | lokalni fake S3/SMS/Sentry: **15/15** i **4/4** | `tools/local-integration/` |
| Audit checklist | **21 ✅ / 10 ⚠️ / 0 ❌** (32 stavke, stanje 13.11.) | `docs/PRE_DEPLOYMENT_AUDIT.md` |
| Staging | **ne postoji** — postoji samo procedura | `docs/STAGING_DEPLOY.md` |
| Store | placeholder ikona i feature graphic; **nema screenshotova**, nema AAB joba; `versionName 1.0` | `apps/mobile/assets`, `ci.yml` |
| Pravno | draft postoji; **stranice `/privacy` i `/terms` ne postoje** | `docs/LEGAL_DRAFT.md`, `apps/web/app` |
| Uređaji | samo emulator; fizička 3 telefona nisu testirana | PROGRESS |
| G0 | bez odgovora operatera; fiskalizacija i PFR su mock | `Upit_Operateru_ESIR.docx` |

**Šta se promijenilo od v2:** CI je 3 → **5 jobova** (dodat `integracije`); T13-5 sigurnosni pass je
urađen; T12-4/5/6 su završeni na nivou koda i lokalnog dokaza; G12 je **prošao bez ispunjenja**; otkrivene
su 4 nove kod-rupe (sekcija 3.5).

## 3. Šta nije završeno

### 3.1 Kapija G12 — 2/8 (rok 23.11. propušten)

| # | Uslov G12 | Stanje | Ko |
|---|---|---|---|
| 1 | CI `verify` + `e2e` + `android` zeleni | ✅ 5/5 | — |
| 2 | APK artifact se preuzima | ✅ 51,47 MB | — |
| 3 | APK instaliran na **3 fizička uređaja**, matrica očitanja | ❌ samo emulator | **ti** (uređaji) + ja |
| 4 | Sentry prima testnu grešku sa `request-id` + alarmi | ⚠️ kod spreman, **nema DSN-a** | **ti** (nalog) + ja |
| 5 | PDF preko **pravog** R2 signed URL-a + istek poslije TTL-a | ⚠️ lokalni S3 dokaz, **nema ključeva** | **ti** (nalog) + ja |
| 6 | SMS na **2 test broja** (OTP + podsjetnik) + opt-out | ⚠️ adapter + lokalni dokaz, **nema provajdera** | **ti** (ugovor) + ja |
| 7 | Staging smoke (prijava, faktura, PDF, podsjetnik) | ❌ **nema staginga** | **ti** (nalozi) + ja |
| 8 | Restore < 30 min sa 50 faktura (staging/Neon) | ⚠️ lokalno 3,7 s, **staging restore nije** | **ti** (nalog) + ja |

### 3.2 Kapija G13 — 0/5 (rok 30.11.)

| # | Stavka | Stanje |
|---|---|---|
| 1 | T13-1 brend i store materijal (ikona, feature graphic, **4–8 screenshotova**, opis bs/en) | placeholder; screenshotovi ne postoje |
| 2 | T13-2 keystore (2 kopije) + potpisan AAB + internal track + instalacija sa Play-a na 2 uređaja | keystore ne postoji, AAB job ne postoji |
| 3 | T13-3 listing, Data Safety, content rating | odgovori draftovani, forme nisu popunjene |
| 4 | T13-4 pravnik + **objava `/privacy` i `/terms`** + DPA + linkovi u app/web | stranice ne postoje, DPA nema |
| 5 | T13-6 checklist ≥ 28/32 + rollback vježba na stagingu | 21/32; rollback nije testiran |

### 3.3 Pilot (G14) — nije počeo

| # | Stavka | Stanje |
|---|---|---|
| 1 | T14-1 12–15 korisnika (vidi rizik 12/14 u §12), demo nalozi, support kanal | 0 korisnika |
| 2 | T14-2 sedmične metrike + NPS | alat postoji (`metrics:platform`), izvještaja nema |
| 3 | T14-3 trijaža petkom, P1 fix u 24 h | nije počelo |
| 4 | T14-4 exit report i odluka o G0 | nije počelo |

### 3.4 Poslije G0 — prava fiskalizacija

Bez odgovora operatera nema ulaza: ESIR adapter umjesto mock-a, PFR/QR po Pravilniku 95/25, storno
fiskalizacija (VOID/REFUND), offline do 5 dana, retry/alarm, potvrda formata sa operaterom. Paralelno
računovođa: PDV tretman refundacije, format numeracije, paušalni limit, kredit pri preplati.

### 3.5 Kod-rupe nađene 23.11. (nisu bile u v2 planu, mogu odmah)

| # | Rupa | Zašto je važna | Dokaz |
|---|---|---|---|
| R1 | Nema `/privacy` i `/terms` | Play listing traži URL politike privatnosti; GDPR transparentnost; bez toga G13 pada | `apps/web/app` nema rute |
| R2 | Nema CI joba za **AAB** (`bundleRelease`) | T13-2 traži AAB, a CI pravi samo debug APK; potpisivanje je konfigurisano ali se nikad ne izvršava | `ci.yml` samo `assembleDebug` |
| R3 | Nema skripte za **staging smoke** | T12-7/T13-6 traže ponovljivu provjeru; ručni klik se ne dokazuje | `tools/` nema smoke |
| R4 | Nema **Play screenshotova** | T13-1 traži 4–8 snimaka; mogu se napraviti na emulatoru sa demo podacima | `assets/` samo ikona + graphic |

Uz njih: `versionName` je `1.0` (plan traži `1.0.0 (1)`), `docs/PRE_DEPLOYMENT_AUDIT.md` je od 13.11. i
ne odražava 21.11. stanje, a checklist se računa ručno.

### 3.6 Odluke koje čekaju (sa podrazumijevanim izborom u §11)

Kredit pri preplati (S11-2b) · promjena e-maila bez verifikacije · Play package name · SMS provajder ·
finalni brend/ime · veličina pilota (12 vs 5). Nijedna ne blokira Sprint 12B.

## 4. Sprint 12B — kod do kapije (24–26.11., bez ijednog naloga)

**Cilj:** zatvoriti 4 rupe i osvježiti dokaze, da G12/G13 ne čekaju kod.
**Trajanje:** 3 radna dana; sve ide na `main` kroz CI.

### S12B-1 Pravne stranice `/privacy` i `/terms` (P1, 0,5–1 dan)

- Javne server-rendered rute bez sesije, `robots: index`, sa verzijom i datumom objave.
- Sadržaj iz `docs/LEGAL_DRAFT.md` §2/§3; mjesta `<...>` ostaju **vidljivo označena** (ne izmišljati
  podatke); banner „radna verzija — čeka pregled pravnika“ dok pravnik ne potvrdi.
- Linkovi: login footer, footer u `(app)/layout.tsx`, mobile `SettingsScreen` (Privacy/Terms →
  `Linking.openURL`), README.
- **DoD:** obje rute vraćaju 200 bez kolačića; linkovi rade; 2 Vitest + 1 e2e test; lint/typecheck/test
  zeleni; commit + CI 5/5.

### S12B-2 CI job za AAB (P1, 0,5 dana)

- Novi job `android-release` u `.github/workflows/ci.yml`: `workflow_dispatch` (i tag `v*`), korak
  `bundleRelease`, upload artifact `digitalni-asistent-aab`, `DA_*` iz secrets.
- Bez keystore-a job pravi **unsigned** AAB (dokaz pipeline-a); sa secrets potpisuje release.
- `versionName "1.0.0"`, `versionCode 1`; pravilo za bump u `docs/PLAY_RELEASE.md`.
- **DoD:** `workflow_dispatch` run zelen, AAB se preuzima; poslije keystore-a potpisan AAB na internal
  track (dio T13-2).

### S12B-3 Staging smoke skripta (P1, 0,5 dana)

- `tools/staging-smoke.mjs`: `STAGING_API_URL`, `SMOKE_EMAIL`, `SMOKE_PASSWORD`; koraci: `/health` →
  prijava → lista faktura → detalj → PDF (302 ili 200) → kreiranje drafta → izdavanje (mock) →
  ručni podsjetnik **samo ako** `SMOKE_SEND_SMS=1`.
- Exit 1 na prvi pad, `--json` izlaz, bez PII u logu; uputstvo u `docs/STAGING_DEPLOY.md`.
- **DoD:** prolazi protiv lokalnog compose stacka 100 %; poslije staginga jedan zelen run kao dokaz za
  T12-7.

### S12B-4 Play screenshotovi sa emulatora (P2, 0,5 dana)

- Emulator API 37, 1080×1920, demo seed (bez stvarnih podataka): prijava, početna (aging), lista
  faktura, detalj sa **PFR + QR**, nova faktura, Nalog.
- 6 PNG u `apps/mobile/assets/screenshots/`, dimenzije provjerene, spisak u `docs/PLAY_RELEASE.md`;
  ponoviti snimanje kad brend bude finalan.
- **DoD:** 6 snimaka, nijedan sa stvarnim podacima, dimenzije odgovaraju Play zahtjevu.

### S12B-5 Osvježavanje audita i checkliste (P2, 0,5 dana)

- Ponoviti `pnpm audit`, testove i e2e; upisati novo stanje u `docs/PRE_DEPLOYMENT_AUDIT.md`
  (21 ✅ / 10 ⚠️ → novo) i u `Pre-Deployment_Checklist.docx` generator.
- Dodati redove za R1–R4 i za `integracije` CI job; provjeriti da nema ❌.
- **DoD:** brojevi u dokumentu odgovaraju izlazu komandi; checklista ima dokaz za svaku ✅ stavku.

## 5. Sprint 12C — integracije i uređaji (27–30.11., čeka naloge)

**Cilj:** ispuniti G12. Redoslijed je zavisnosni — staging prvi, jer na njemu provjeravamo sve ostalo.

| Dan | Korak | Dokaz |
|---|---|---|
| 1 (27.11.) | Neon Postgres + Upstash Redis + R2 bucket; Vercel (web) + Railway/Fly (API + worker); `prisma migrate deploy`; demo seed; `/health` | staging URL, `migrate status` up to date, smoke skripta zelena |
| 2 (28.11.) | Sentry DSN (API, web, worker) → testna greška sa `request-id` → alarmi: 5xx stopa, p95, queue backlog, `FISCAL_ALARM`, SMS fail | screenshot događaja + e-mail/Slack alarm |
| 2–3 | R2 ključevi → PDF 302 na signed URL (TTL ≤ 15 min), poslije TTL-a link ne radi, streaming fallback i dalje radi | 302 + `X-Amz-Expires`, 403 poslije isteka |
| 3 (29.11.) | SMS provajder → OTP i ručni podsjetnik na **2 broja**, sender ID, opt-out, trošak u panelu | 2 potvrđena SMS-a + opt-out test |
| 3–4 | Restore drill: Neon PITR → staging, 50 faktura, brojevi identični, **< 30 min**; rollback na prethodni release | trajanje + SQL provjere |
| 4–5 | Matrica 3 uređaja: instalacija, prijava, faktura (2 stavke + PDV), izdavanje, PDF/QR, naplata, **offline + sync**, **biometrija** (uključi, restart, otkaži, promijeni otisak), **slanje** e-mail/SMS | tabela uređaj/verzija/rezultat, 0 crash-eva |
| 5 (30.11.) | **G12 pregled**: tabela dokaza, 0 P1, odluka da li G13 kreće | ispunjena kapija |

Ako neki nalog ne stigne do 27.11., taj red se **izbacuje iz sprinta** i kapija se pomjera za nedjelju —
ne produžava se rok i ne ulazi se u G13 sa rupom.

## 6. Sprint 13A — store i pravni paket (1–7.12.)

| # | Zadatak | Ko | DoD |
|---|---|---|---|
| T13-1 | Finalni brend: ime, ikona 512×512, feature graphic 1024×500, screenshotovi (S12B-4), opis bs/en | ti (brend) + ja | materijal u `assets/`, nema placeholdera |
| T13-2 | Keystore (2 kopije van repoa), CI secrets, potpisan AAB, internal track, instalacija **sa Play-a** na 2 uređaja | ti + ja | AAB na tracku, `1.0.0 (1)` |
| T13-3 | Listing, content rating, Data Safety iz `docs/PLAY_RELEASE.md` §4 | ti | nema „requires attention“ |
| T13-4 | Pravnik potvrdio tekstove; objava `/privacy` i `/terms` (S12B-1); DPA za Neon, Vercel, R2, SMS, Sentry; linkovi u app/web | ti (pravnik) + ja | stranice bez prijave, verzija + datum |
| T13-5 | Ostatak security pass-a: `pnpm audit` na stagingu, rotacija ključeva, provjera `FEATURE_*` flagova | ja | nalazi u `SECURITY_AUDIT.md` |
| T13-6 | Checklist ≥ 28/32, rollback vježba na stagingu | ja | checklista + zapis vježbe |
| **G13** | **7.12.** | | AAB na internal tracku, pravni paket objavljen, 0 P1 |

Napomena: ako je Play developer account **lični**, produkcija traži **12 testera / 14 dana** closed
testinga — zato pilot ide kao closed test sa **12–15** korisnika, ne 5 (vidi §12).

## 7. Sprint 14 — pilot / closed test (8.12.–8.1.)

| # | Zadatak | DoD |
|---|---|---|
| T14-1 | 12–15 firmi: pozivi, demo nalozi, checklist iz `docs/PILOT_KIT.md`, support kanal | 12 aktivnih firmi, svaka izda bar 1 račun |
| T14-2 | Sedmično `pnpm --filter api metrics:platform` + tabela + NPS poslije 7 dana | 4 sedmična izvještaja |
| T14-3 | Trijaža petkom; P1 fix u 24 h; P2 sljedeća sedmica | 0 otvorenih P1 na kraju |
| T14-4 | Exit report + odluka (produžiti pilot / produkcija / čekati G0) | `docs/PILOT_REPORT.md` |
| **G14** | **11.1.2027.** | ≥ 70 % izda račun bez pomoći, ≥ 50 % pošalje podsjetnik, NPS ≥ 30, 0 blokatora |

## 8. Poslije G0 — prava fiskalizacija (3–6 nedjelja)

Ulaz je odgovor operatera. Posao: ESIR adapter (mjesto mock-a, ista arhitektura), PFR/QR po Pravilniku
95/25, storno fiskalizacija VOID/REFUND, offline do 5 dana, retry/alarm, testovi sa operaterom i potvrda
formata računa. Paralelno računovođa: PDV refundacije, numeracija, paušal. Ništa od toga ne ulazi u pilot.

## 9. Kalendar i pravilo klizanja

| Period | Fokus | Rezultat |
|---|---|---|
| 24–26.11. | **Sprint 12B** (kod bez naloga) | R1–R4 zatvorene, AAB pipeline, smoke skripta, screenshotovi |
| 27–30.11. | **Sprint 12C** (integracije + uređaji) | **G12 — 30.11.** |
| 1–7.12. | **Sprint 13A** (store + pravno) | **G13 — 7.12.** |
| 8.12.–8.1. | **Sprint 14** (pilot / closed test) | **G14 — 11.1.2027.** |
| od G0 + 3–6 ned. | prava fiskalizacija | ESIR + PFR/QR + storno |

**Pravilo klizanja:** svaka nedjelja kašnjenja naloga/uređaja pomjera G12, G13 i G14 za **tačno jednu
nedjelju**; Sprint 12B se ne pomjera (ne zavisi ni od čega). Ako nalozi stignu poslije 4.12., pilot se
pomjera na januar i G14 na februar — bolje nego pilot u praznicima.

## 10. Tvoje akcije — po rokovima

| # | Akcija | Zašto | Rok |
|---|---|---|---|
| 1 | **Pošalji upit operateru ESIR** (ako nije poslan) | G0 je jedini dugi rok; svaki dan čekanja kasni fiskalizaciju | **24.11.** |
| 2 | Sentry nalog + DSN (api/web/worker) | T12-4 | 24.11. |
| 3 | R2 bucket + 3 ključa (account ID, access key, secret) | T12-5 | 24.11. |
| 4 | Neon (baza) + Upstash (Redis) + Vercel (web) + Railway/Fly (API + worker) | T12-7 | 25.11. |
| 5 | SMS: 2–3 ponude, izbor, ugovor, sender ID | T12-6 | 26.11. |
| 6 | 3 Android telefona (Android 10–12, srednji, 15/16) + USB debug | T12-3 | 26.11. |
| 7 | Play Console nalog + odluka lični/organizacioni | T13-2/3, pravilo 12/14 | 26.11. |
| 8 | Keystore: generisanje + **2 kopije van repoa** + lozinke u password manager | T13-2 | 1.12. |
| 9 | Finalni brend: ime, ikona, feature graphic, package name | T13-1/2 — **nepovratno poslije objave** | 1.12. |
| 10 | Pravnik: ToS, privatnost, DPA | T13-4 | 3.12. |
| 11 | Računovođa: PDV refundacije, numeracija, paušal, kredit | odluke + G0 | 3.12. |
| 12 | Pilot: 12–15 majstora sa telefonima i Google nalozima | G14 | 5.12. |

**Šta mi tačno treba (jedan paket, kroz password manager, ne u chat):** `SENTRY_DSN`, `R2_ACCOUNT_ID`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `SMS_PROVIDER` + `SMS_HTTP_URL` +
`SMS_HTTP_TOKEN` + `SMS_SENDER_ID`, staging URL-ovi i `SMOKE_EMAIL`/`SMOKE_PASSWORD` za demo firmu,
`DA_*` za keystore.

## 11. Odluke sa podrazumijevanim izborom

Ako odluka ne dođe do roka, primjenjuje se default i ne blokira sprint.

| # | Odluka | Opcije | Default ako ćutiš | Rok |
|---|---|---|---|---|
| 1 | Kredit pri preplati (S11-2b) | polje na `customers` / credit ledger / odbijanje | **odbijanje** (kao sada) za pilot | 1.12. |
| 2 | Promjena e-maila bez verifikacije | ostaje uz lozinku / kod | **ostaje** za MVP | 1.12. |
| 3 | Play package name | `com.digitalniasistent` / brend | **`com.digitalniasistent`** | 1.12. |
| 4 | SMS provajder | domaći / regionalni | **prvi sa sender ID-om i najnižom cijenom po SMS-u** | 26.11. |
| 5 | Brend / ime | finalno / radno | **„Digitalni Asistent“** + placeholder ikona | 1.12. |
| 6 | Veličina pilota | 5–15 / 12–15 | **12–15** ako je lični Play nalog, inače 8–15 | 5.12. |
| 7 | Web push / notifikacije | — | **odgođeno** (anti-scope) | — |

## 12. Rizici i mitigacije (ažurirano 23.11.)

| Rizik | Vjerovatnoća | Uticaj | Mitigacija |
|---|---|---|---|
| G12 već propušten; nalozi kasne | **visoka** | visok | Sprint 12B ide bez naloga; pravilo klizanja §9; G13 se ne otvara sa rupom |
| Lični Play nalog → 12 testera / 14 dana | srednja | **visok** | organizacioni nalog ako je moguće; inače pilot = closed test sa 12–15 ljudi od 8.12. |
| Pilot u praznicima (decembar) | visoka | srednji | produžiti pilot do 8.1.; metrike sedmično, ne dnevno |
| Pravnik kasni → nema URL-a politike za Play | srednja | visok | S12B-1 objavljuje stranice sa stvarnim podacima firme i oznakom verzije; pravnik potvrđuje prije G13 |
| Windows long-path blokira lokalni APK | visoka lokalno | niskog | build kroz CI (Linux); lokalno `C:\da` fallback |
| Offline/biometrija rade samo u testovima | srednja | visok | matrica 3 uređaja prije G12, ne poslije |
| SMS dostavljivost / sender ID | srednja | visok | 2 broja, 2 mreže, opt-out, trošak u panelu |
| Restore nije testiran na stagingu | srednja | visok | T12-8 obavezan prije G12; drill sa 50 faktura |
| Pilot koristi PRAČUNE, očekuje fiskalni račun | visoka | visok | onboarding jasno kaže status G0; PRAČUN oznaka vidljiva |
| Scope creep u pilotu | visoka | srednji | samo P1/P2; nove funkcije u parking (§14) |

## 13. Definicija gotovog po kapijama (dokazi)

| Kapija | Uslov | Dokaz koji se prilaže |
|---|---|---|
| **G12** (30.11.) | CI 5/5; APK na 3 uređaja; Sentry testna greška; R2 PDF + istek; SMS na 2 broja; staging smoke; restore < 30 min; 0 P1 | linkovi runova, tabela uređaja, screenshot alarma, `Expires=900` + 403, potvrde SMS-a, smoke `--json`, trajanje restore-a |
| **G13** (7.12.) | AAB na internal tracku + instalacija sa Play-a; `/privacy` i `/terms` objavljene; Data Safety popunjen; checklist ≥ 28/32; rollback vježba; 0 P1 | Play link, URL-ovi stranica, checklista, zapis rollbacka |
| **G14** (11.1.2027.) | ≥ 12 testera ≥ 14 dana; ≥ 70 % izda račun bez pomoći; ≥ 50 % pošalje podsjetnik; NPS ≥ 30; 0 blokatora; odluka o G0 | `docs/PILOT_REPORT.md`, metrike, NPS |

## 14. Anti-scope (ostaje zamrznut)

- iOS, multi-user/radnici, bankovni izvodi, knjigovodstvo/KPR/PDV prijave, inventar, plate.
- Tamna tema, ćirilica, offline web, kartična naplata pretplate, agencijski multi-client.
- Push notifikacije osim registracije tokena; web push.
- Refaktorisanje „uspavane“ koda (Nest 11, tinypool) — P2, poslije pilota.
- Sve što nije u §13 i nije neophodno za pilot — parking lista, ne sprint.

## 15. Prvih 5 radnih dana — konkretan redoslijed

1. **Pon 23.11.** — odluka: G12 se pomjera na 30.11. (ovaj dokument); ti šalješ ESIR upit; ja krećem
   S12B-1 (pravne stranice).
2. **Uto 24.11.** — S12B-1 commit + CI; ti otvaraš Sentry i R2; ja S12B-2 (AAB job).
3. **Sre 25.11.** — S12B-3 (staging smoke) protiv lokalnog stacka; ti Neon/Upstash/Vercel/Railway.
4. **Čet 26.11.** — S12B-4 (screenshotovi) + S12B-5 (audit); ti SMS ponude i 3 telefona.
5. **Pet 27.11.** — prvi staging deploy čim kredencijali stignu; smoke; počinje matrica uređaja.

## 16. Kako pratimo napredak

- Početak sprinta: priložiti `MASTER_PROMPT`, `PROGRESS.md` i ovaj plan.
- Svaki zadatak: commit + test/dokaz + unos u `PROGRESS.md` (urađeno / nije / blokada / sljedeće).
- Petak: status kapije, blokade, odluke, plan za sljedeću sedmicu.
- Sprint je gotov kad je kapija ispunjena i dokumentacija ažurna — ne kad je kod napisan.
