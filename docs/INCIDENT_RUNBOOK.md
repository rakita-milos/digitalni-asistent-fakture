# Incident runbook — Digitalni Asistent

> Verzija 1.0 · 13. 11. 2026. · Prati: `STAGING_DEPLOY.md`, `Pre-Deployment_Checklist`, Sentry alarme.
> Cilj: prvi reaguje 5 minuta — dijagnoza, mitigacija, pa analiza. Ne „popravljati u produkciji“ bez plana.

## 1. Severiteti i reakcija

| Nivo | Primjer | Reakcija |
|---|---|---|
| S1 | Ne radi prijava, baza nedostupna, fiskalizacija blokira sve | odmah; status stranica; rollback/flag |
| S2 | PDF ne radi, SMS ne ide, izvještaji netačni | u roku 1 h; flag/rollback |
| S3 | Jedna faktura zapela u `PENDING_FISCAL`, spor ekran | u roku 1 radnog dana |
| S4 | Kozmetika, nejasna poruka | sljedeći sprint |

**Prvi koraci za svaki S1/S2:** provjeri Sentry (5xx/queue), `GET /health`, zadnji deploy, da li je
migracija rađena, i da li je feature flag nedavno mijenjan.

## 2. Dijagnostika (60 sekundi)

```bash
curl -fsS https://api.<domen>/health
# Sentry: 5xx stopa, request-id, release
# DB: veze, spori upiti; Redis: ping, memorija, queue backlog
# Worker log: „podsjetnici“ / „fiskalni retry“ / FISCAL_ALARM
```

Korelacija: svaki API odgovor ima `x-request-id`; isti ID je u logu i Sentry tagovima.

## 3. Scenario → postupak

### 3.1 Fiskalizacija ne radi (S1/S2)

1. Provjeri `ESIR_MODE` (mora biti `mock` do G0 — `esir` namjerno pada) i `FEATURE_FISCAL_ENABLED`.
2. Ako je problem provajder/operater: isključi `FEATURE_FISCAL_ENABLED=false` → izdavanje vraća 503 sa
   jasnom porukom; fakture ostaju DRAFT/PENDING_FISCAL, ništa se ne gubi.
3. Provjeri `PENDING_FISCAL` fakture i `fiscal_records` (FAILED), retry backoff (1m/5m/15m/1h/6h).
4. Alarm `FISCAL_ALARM` > 3 dana: ručno odluči — čekaj operatera ili poništi/refundiraj po proceduri.
5. Ne izdavati „ručne“ fiskalne račune; dokumentuj period i obavijesti korisnike.

### 3.2 SMS ne ide (S2)

1. Provjeri provajder status i `SMS_PROVIDER`/`SMS_API_KEY`/`SMS_SENDER_ID`.
2. Provjeri rate limit (10/min) i log adaptera; `FAILED` podsjetnici imaju razlog.
3. Ako provajder padne: `FEATURE_SMS_ENABLED=false` (OTP/podsjetnici vraćaju 503) i obavijesti korisnike;
   podsjetnici se mogu poslati kad se vrati (status i dalje `FAILED` — ručno ponoviti).
4. Opt-out kupca se poštuje — provjeri `customers.reminder_opt_out` prije prijave „ne šalje“.

### 3.3 Baza nedostupna (S1)

1. Provjeri Neon status/connection limit; API vraća 5xx (health pao).
2. Ako je connection pool pun: restart API/worker, provjeri pooled vs direct URL.
3. Ako je restore potreban: po `STAGING_DEPLOY.md` §6.2, uz odobrenje; prvo backup trenutnog stanja ako je moguće.
4. Poslije oporavka: pokreni smoke i provjeri `prisma migrate status`.

### 3.4 Redis nedostupan (S1/S2)

1. Rate limiting je u produkciji **fail-closed** (503) — očekivano; ne isključivati ga tek tako.
2. Worker/BullMQ: jobovi stoje; podsjetnici se šalju po povratku (scheduler pokupi zaostalo).
3. Provjeri Upstash status/limite, restart API/worker; prati backlog.

### 3.5 PDF/R2 problem (S2)

1. Kod ima automatski **stream fallback** kada R2 nije konfigurisan ili upload/presign padne — PDF i dalje radi.
2. Ako je R2 konfigurisan a puca: provjeri ključeve/bucket/endpoint; po potrebi ukloni `R2_*` env i restart
   (prelazak na stream), pa popravi.
3. Provjeri TTL signed URL-a (≤ 15 min) i da bucket nije javno listable.

### 3.6 Web/API 5xx poslije deploya (S1/S2)

1. Vercel instant rollback (web) / prethodni image (API, worker).
2. Ako je uzrok migracija: `prisma migrate resolve` za neuspjelu, provjeri expand/contract; restore ako je šema oštećena.
3. Uključi feature flag za rizičnu funkciju dok se ne stabilizuje.

### 3.7 Sumnja na curenje podataka / kompromitovan nalog (S1)

1. Opozovi refresh tokene: briši `devices.refresh_token_hash` za pogođene korisnike; rotiraj JWT tajne.
2. Promijeni lozinke/servisne ključeve (SMS, R2, Sentry, baza).
3. Provjeri audit log (`invoice.issue`, `payment.create`, `invoice.send`, `account.delete`).
4. Obavijesti vlasnika i pravnu/procjenu GDPR obaveza (72 h) — ne improvizovati.

## 4. Komunikacija

- Status: „Istražujemo / Ograničeno / Riješeno“ + pogođene funkcije + vrijeme.
- Korisnicima ne slati tehničke detalje ni stack trace.
- Za S1: obavijest odmah, pa na 30 min dok se ne riješi; poslije: kratak post-mortem.

## 5. Post-mortem (obavezno za S1/S2)

1. Vremenska linija (detekcija → mitigacija → oporavak).
2. Uzrok (5 whys), šta je pomoglo/odmoglo.
3. Akcione stavke sa vlasnikom i rokom (dodati u PROGRESS/plan).
4. Ako je uzrok nedostatak testa/alarma — dodati test/alarm prije zatvaranja incidenta.

## 6. Kontakti (popuniti prije pilota)

| Uloga | Ime | Kontakt |
|---|---|---|
| Vlasnik proizvoda | — | — |
| Tehnički lead | — | — |
| Hosting/baza | — | — |
| SMS provajder | — | — |
| Računovođa | — | — |
| Pravnik | — | — |
