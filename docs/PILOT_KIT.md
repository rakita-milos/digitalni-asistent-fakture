# Pilot kit — prvi korisnici (S11-5)

> Verzija 1.1 · 23. 11. 2026. · Prati: `PLAN_DALJEG_RADA_v3.md` (G14), `PROGRESS.md`.
> **Operativni plan pilota je [`PILOT_PLAN.md`](PILOT_PLAN.md)** — ovaj dokument je brzi pregled.
> Cilj pilota: **12–15 majstora/mikro-firmi** izda bar jedan račun i pošalje bar jedan
> podsjetnik bez pomoći, u roku od 7 dana, i vrati prvi feedback.

Ostali dokumenti pilota:

- [`pilot/RECRUITMENT.md`](pilot/RECRUITMENT.md) — pozivnice, kvalifikacija, pipeline 15 → 12
- [`pilot/ONBOARDING.md`](pilot/ONBOARDING.md) — skripta poziva (20 min) i mjerenje „bez pomoći“
- [`pilot/NPS.md`](pilot/NPS.md) — NPS upit, računanje i follow-up
- [`pilot/TRIAGE.md`](pilot/TRIAGE.md) — severiteti i petak ritual
- [`pilot/EXIT_REPORT_TEMPLATE.md`](pilot/EXIT_REPORT_TEMPLATE.md) — izlazni izvještaj

## 1. Šta je spremno prije poziva

| Stavka | Kako | Dokaz |
|---|---|---|
| Demo nalog | `pnpm db:seed` (SEED_RESET=1 za čistu bazu) | `apps/api/prisma/seed.js`; demo: `demo@digitalni-asistent.ba` / `DemoLozinka123` |
| Web | `pnpm --filter web build` + `start` | 16 ruta + middleware + javne `/privacy` i `/terms` |
| API + worker | `pnpm --filter api build`; worker `node dist/worker.js` | worker smoke u PROGRESS |
| Mobilni APK/AAB | CI `android` / `android-release` job | APK artifact; AAB uz keystore |
| Fiskalizacija | **samo PRAČUNI i mock** — ne obećavati fiskalne račune | `ESIR_MODE=mock` |
| SMS | `SMS_PROVIDER=log` dok nema provajdera — podsjetnici se vide u logu | `SmsService` |
| Support | e-mail + WhatsApp/Viber grupa (popuniti prije poziva) | ovaj dokument §6 |
| Praćenje | `docs/pilot/tracking.csv` (kopija šablona) + `pnpm pilot:status` | `tools/pilot/` |

> **Pravilo za pilot:** svaki korisnik dobija **svježu firmu** (ne demo) i 20 minuta
> onboardinga. Demo nalog služi samo za demonstraciju, ne za pilot podatke.

## 2. Onboarding checklist (5 koraka, ~15 min)

1. **Nalog i firma** — registracija (JIB, adresa, telefon), potvrda e-maila.
2. **EFD podešavanja** — EFD ID i numeracija (prefix/godina); *mock* fiskalizacija.
3. **Porezi i katalog** — bar jedna poreska stopa (17 %), 2–3 usluge/artikla.
4. **Prvi kupac + PRAČUN** — unijeti kupca (ime, adresa, **telefon** — bez telefona podsjetnik ne
   radi), izdati PRAČUN, pokazati PDF i QR.
5. **Podsjetnici** — uključiti plan (npr. 3 dana prije i na dan roka), poslati ručni
   podsjetnik na testni broj; objasniti opt-out kupca.

**Na kraju onboardinga korisnik sam ponovi korak 4** (bez pomoći) — to je prvi signal
da UI radi. Ako zapne, zabilježi gdje (ekran + akcija) u tabelu §8.

## 3. Scenario prvog dana (korisnički test)

1. Prijavi se na web i mobilni istim nalogom.
2. Napravi PRAČUN sa 2 stavke, popustom i PDV-om; izdaj ga; otvori PDF.
3. Zabilježi djelimičnu naplatu; provjeri da dashboard/aging pokazuje ostatak.
4. Pretvori PRAČUN u račun; pošalji ga e-mailom (log) i SMS-om (log).
5. Uključi avionski režim na telefonu: napravi draft, vrati mrežu, provjeri sync.
6. Pošalji podsjetnik za dospjelu fakturu; provjeri da opt-out kupac ne dobija podsjetnik.
7. Izvještaj: aging + mjesečni izvoz (PDF/print).
8. (opciono) Izvoz podataka (GDPR) i brisanje **na demo nalogu**, ne na pilot nalogu.

## 4. Feedback upitnik (prvi feedback u roku 7 dana)

Skala 1–5 (1 = uopšte se ne slažem, 5 = potpuno se slažem), + NPS i dva otvorena pitanja.

1. Registracija i podešavanje firme su bili jasni.
2. Izdavanje računa je brzo (cilj: **< 30 s** za fakturu sa 2 stavke).
3. PDF i QR izgledaju ispravno i profesionalno.
4. Naplata (puna/djelimična) i ostatak duga su jasni.
5. PRAČUN → račun je razumljiv i radi bez greške.
6. Podsjetnici su korisni; znam kako kupac može da se odjavi.
7. Aplikacija radi i bez mreže (offline draft se sinhronizuje).
8. Izvještaji (aging, mjesečni) odgovaraju onome što mi treba.
9. **NPS:** koliko je vjerovatno da ćete preporučiti aplikaciju kolegi? (0–10)
10. Šta vas je najviše usporilo? (otvoreno)
11. Šta bi jedna stvar bila da je popravimo prvo? (otvoreno)
12. Da li biste nastavili koristiti aplikaciju i poslije pilota? (da/ne/možda + zašto)

**Pravilo:** svaki odgovor 1–3 na pitanja 1–9 = bug ili UX zadatak; ide u tabelu §8 sa
ekranom i reprodukcijom.

## 5. Metrike pilota (S11-7)

Ciljevi iz plana:

| Metrika | Cilj | Kako se mjeri |
|---|---|---|
| Izdaje račun bez pomoći | ≥ 70 % korisnika | onboarding: korak 4 samostalno + `unaided_invoice` |
| Pošalje bar jedan podsjetnik | ≥ 50 % korisnika | `reminder.sent` događaj / `reminders` tabela / `reminder_sent` |
| NPS | ≥ 30 | upitnik `pilot/NPS.md` (7. i 21. dan) |
| Prvi feedback | 100 % u 7 dana | `feedback_at` u tabeli |
| Vrijeme do prvog računa | < 30 s (poslije setupa) | `first_invoice_seconds` |
| Greške u radu | 0 blokirajućih | `blocker_open` + trijaža |

Dva izvora brojeva:

1. **Događaji** (`ANALYTICS` log redovi, vidi `docs/ANALYTICS.md`): `registration`,
   `invoice_issued`, `payment_recorded`, `reminder_sent` — bez PII.
2. **Baza** — `cd apps/api && pnpm metrics:platform` vraća JSON (registracije, setup proxy,
   fakture, naplate, podsjetnici po mjesecu).

## 6. Support i komunikacija

- **Kanal:** e-mail `podrska@<domen>` + zajednička WhatsApp/Viber grupa za pilota
  (popuniti prije poziva; do tada koristiti lični kanal osnivača).
- **Radno vrijeme odgovora:** radni dani 09–17; kritično (ne može izdati račun) — isti dan.
- **Escalation:** `docs/INCIDENT_RUNBOOK.md` (severiteti, dijagnostika, komunikacija).
- **Šta korisnik smije da očekuje:** mock fiskalizacija, SMS u logu, bez naplate pretplate.
  To mora pisati u pozivnici i u prvom e-mailu.

## 7. Izlazni kriteriji pilota

- [ ] 12–15 korisnika prošlo onboarding i izdalo bar jedan dokument
- [ ] ≥ 70 % izdalo račun bez pomoći; ≥ 50 % poslalo podsjetnik
- [ ] NPS ≥ 30 (uz naveden broj odgovora)
- [ ] 0 blokirajućih bugova duže od 24 h
- [ ] Prvi feedback sakupljen za sve korisnike (7 dana)
- [ ] Odluka: produkcija / produžiti pilot / stop (obrazloženje u `docs/pilot/EXIT_REPORT.md`)

## 8. Tabela za praćenje

Kopirati šablon i popunjavati lokalno:

```bash
cp docs/pilot/tracking.example.csv docs/pilot/tracking.csv   # PII fajl je u .gitignore
pnpm pilot:status        # kriteriji G14 + % bez PII
pnpm pilot:weekly        # sedmični izvještaj (uz platform-metrike)
```

Kolone: `id, company, contact, phone, device, invited_at, onboarded_at, unaided_invoice,
first_invoice_seconds, reminder_sent, feedback_at, nps, blocker_open, notes`. U git nikad ne ide
`tracking.csv` — samo `tracking.example.csv` (bez PII) i agregatni izvještaji.

## 9. Rizici specifični za pilot

| Rizik | Mitigacija |
|---|---|
| Korisnik očekuje pravi fiskalni račun | u pozivnici i onboardingu jasno: PRAČUN + mock; prava fiskalizacija poslije G0 |
| SMS ne stiže (log režim) | objasniti; za demo poslati e-mail; SMS čim provajder bude spreman |
| Offline draft se ne sinhronizuje (poznata rupa, vidi audit E6) | tražiti da prvo provjere mrežu; prijaviti odmah; ne obećavati automatski retry |
| Gubitak podataka | svaki korisnik ima svoju firmu; dnevni backup staginga; ne brisati ništa ručno |
