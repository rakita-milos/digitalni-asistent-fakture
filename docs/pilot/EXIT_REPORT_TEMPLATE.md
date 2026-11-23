# Exit report — pilot (G14)

> Šablon. Kopirati u `docs/pilot/EXIT_REPORT.md` i popuniti dokazima iz
> `docs/pilot/reports/<sedmica>.md`, `pnpm pilot:status` i trijaže. **Ne objavljivati sa PII.**
> Popunjava: vlasnik + agent · Datum: `<YYYY-MM-DD>` · Verzija: 1.0

## 1. Sažetak (5 rečenica)

- Kohorta: `<N>` firmi, `<M>` završilo onboarding, `<K>` izdalo bar jedan dokument.
- Glavni rezultat: `<jedna rečenica — npr. „8/12 izdaje račun bez pomoći, NPS +11“>`.
- Glavni problem: `<jedna rečenica>`.
- Blokatori: `<0 / N>`; svi P1 riješeni u `<24 h / duže>`.
- Preporuka: **produkcija / produžiti pilot / stop** — sa jednim razlogom.

## 2. Metod

- Period: `<T0> – <T0+28>`; staging URL: `<...>`; build/commit: `<SHA>`.
- Onboarding: 20 min po firmi, skripta `docs/pilot/ONBOARDING.md`.
- Podaci: `tracking.csv` (lokalno, bez PII u ovom dokumentu) + `metrics:platform`.
- Ograničenja: mock fiskalizacija, SMS `<provajder/log>`, `<broj>` uređaja u kohorti.

## 3. G14 kriteriji (obavezno)

| Kriterij | Cilj | Stvarno | Status |
|---|---|---|---|
| Kohorta | 12–15 | `<N>` | ✅/❌ |
| Dužina pilota | ≥ 14 dana | `<N>` | ✅/❌ |
| Izdaje račun bez pomoći | ≥ 70 % | `<N/N = %>` | ✅/❌ |
| Pošalje podsjetnik | ≥ 50 % | `<N/N = %>` | ✅/❌ |
| NPS | ≥ 30 | `<+N (n=M)>` | ✅/❌ |
| Otvoreni blokatori | 0 | `<N>` | ✅/❌ |

Izvorni ispis: `pnpm pilot:status -- --json` → priložiti u dodatku A.

## 4. Platforma (iz baze)

| Metrika | Početak | Kraj | Δ |
|---|---|---|---|
| Registracije | `<N>` | `<N>` | `<+N>` |
| Firme | `<N>` | `<N>` | `<+N>` |
| Setup završen | `<N>` | `<N>` | `<+N>` |
| Fakture izdate | `<N>` | `<N>` | `<+N>` |
| Naplate (broj / KM) | `<N / KM>` | `<N / KM>` | `<+N>` |
| Podsjetnici poslani | `<N>` | `<N>` | `<+N>` |
| Podsjetnici neuspjeli | `<N>` | `<N>` | `<N>` |

Komentar: `<da li brojevi prate kohortu; odstupanja objasniti>`

## 5. Kvalitativni nalazi (top 5)

| # | Nalaz | Dokaz (koliko korisnika) | Tip | Odluka |
|---|---|---|---|---|
| 1 | `<npr. unos kupca traje predugo>` | `<4/12>` | UX | `<fix u G0 ciklusu / parking>` |
| 2 |  |  |  |  |
| 3 |  |  |  |  |
| 4 |  |  |  |  |
| 5 |  |  |  |  |

## 6. Bugovi

| Nivo | Otvoreno na početku | Prijavljeno | Riješeno | Ostalo |
|---|---|---|---|---|
| P1 | `<N>` | `<N>` | `<N>` | `<N>` |
| P2 | `<N>` | `<N>` | `<N>` | `<N>` |
| P3 | `<N>` | `<N>` | `<N>` | `<N>` |

Najvažniji fixevi: `<commitovi + testovi>`.

## 7. NPS i feedback

- NPS: `<+N (n=M)>`; promoteri `<N>`, pasivni `<N>`, kritičari `<N>`.
- Teme iz otvorenih odgovora (anonimizovano): `<3–5 tema>`.
- Citati (uz dozvolu, bez imena): `<...>`.

## 8. Spremnost za G0 i produkciju

| Stavka | Status | Napomena |
|---|---|---|
| Pravni paket objavljen (`/privacy`, `/terms`, DPA) | `<da/ne>` |  |
| Play listing i Data Safety | `<da/ne>` |  |
| Staging stabilan (smoke svaki petak) | `<da/ne>` |  |
| Backup/restore provjeren | `<da/ne>` |  |
| Fiskalizacija (ESIR odgovor) | `<da/ne>` |  |
| Support opterećenje | `<h/dan>` |  |

## 9. Odluka

**Izabrano:** `<produkcija | produžiti pilot | stop/čekati G0>`

Obrazloženje: `<2–3 rečenice, vezano za kriterije i rizike>`.

Uslovi za sljedeći korak:

- [ ] `<npr. NPS ≥ 30 poslije još 2 sedmice>`
- [ ] `<npr. 0 P1 u 14 dana>`
- [ ] `<npr. pravnik potvrdio tekstove>`

## 10. Šta dalje (30 dana)

| # | Akcija | Vlasnik | Rok |
|---|---|---|---|
| 1 | `<...>` |  |  |
| 2 |  |  |  |
| 3 |  |  |  |

## Dodatak A — dokazi

- `pnpm pilot:status -- --json` (prilog, bez PII)
- `docs/pilot/reports/<sedmica>.md` (svi sedmični izvještaji)
- lista issue-a po nivou (linkovi)
- screenshotovi najvažnijih problema (bez podataka kupaca)
