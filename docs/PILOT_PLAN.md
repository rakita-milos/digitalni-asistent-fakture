# Pilot — operativni plan (G14)

> Verzija 1.0 · 23. 11. 2026. · Prati: `PLAN_DALJEG_RADA_v3.md` §7 (Sprint 14), `docs/PILOT_KIT.md`,
> `docs/ANALYTICS.md`, `PROGRESS.md`. Cilj: **12–15 firmi** koristi aplikaciju 4 sedmice, izda bar
> jedan račun bez pomoći, pošalje bar jedan podsjetnik, vrati feedback — i na kraju odluka o G0.

## 1. Status i zavisnosti (23. 11. 2026.)

**Priprema je završena:** alati za praćenje i sedmični izvještaj, onboarding skripta, NPS upit,
trijaža i šablon exit reporta (vidi §12). **Pilot još ne može početi** jer nema okruženja ni korisnika.

| Zavisnost | Zašto blokira pilot | Gdje se zatvara |
|---|---|---|
| Staging (web + API + worker + baza + Redis) | sve metrike i podrška idu na staging, ne na lokalni računar | T12-7, G12 |
| 3 fizička uređaja | offline i biometrija su ključni za majstore; emulator nije dokaz | T12-3, G12 |
| SMS provajder | „pošalje podsjetnik“ je jedna od dvije glavne metrike; `log` režim ne dokazuje dostavu | T12-6, G12 |
| AAB + Play internal/closed track | 12–15 korisnika mora instalirati iz Play-a (lični nalog traži 12 testera / 14 dana) | T13-2/T13-3, G13 |
| Objavljene pravne stranice | Play listing traži URL politike privatnosti; piloti trebaju znati obradu podataka | T13-4, G13 |
| Keystore | bez njega nema potpisanog AAB-a za Play | T13-2 |

> **Pravilo:** dok staging nije živ i stabilan, pilot se ne otvara — inače mjerimo okruženje, a ne proizvod.

## 2. Kohorta

- **12–15 firmi.** Minimum 12 nije marketinški izbor: Play za lični developer nalog traži
  12 testera / 14 dana closed testinga, a G14 traži ≥12 aktivnih. 15 je gornja granica koju
  jedan osnivač može podržati bez gubljenja kvaliteta.
- **Profil:** mikro-firma ili majstor koji **redovno izdaje fakture** (5–50 mjesečno), koristi
  telefon za posao, Android 10+, spreman 4 sedmice + dva kratka upitnika.
- **Izvori:** lična mreža, preporuke, grupe majstora/izvođača. Bez plaćenih oglasa — pilot
  traži ljude koji će dati iskren feedback, ne publiku. Pozivnice, kvalifikacija i pipeline
  (`invited → confirmed → onboarded → active`) su u [`docs/pilot/RECRUITMENT.md`](pilot/RECRUITMENT.md).
- **Ne uključivati:** konkurenciju, firme koje ne izdaju fakture, iOS-only korisnike, ljude
  koji očekuju pravi fiskalni račun (G0 nije zatvoren).
- **Evidencija:** `docs/pilot/tracking.csv` (kopija šablona `tracking.example.csv`). Fajl sadrži
  PII i **nije u gitu**; u git idu samo agregati.

## 3. Vremenska linija

`T0` = dan prvog onboarding poziva (kad su G12 i G13 zatvoreni).

| Kada | Šta | Rezultat |
|---|---|---|
| T0 − 3 dana | **dry-run** sa 2 interne „firme“ (demo nalozi) | provjerena onboarding skripta, mjerenje „bez pomoći“, alati |
| T0 | talas 1: 4 firme | svaka izda bar jedan dokument |
| T0 + 2 | talas 2: 4 firme | kohorta ≥ 8 |
| T0 + 4 | talas 3: 4–7 firmi | kohorta 12–15 |
| svaki petak | trijaža + `pnpm pilot:weekly` | izvještaj u `docs/pilot/reports/` |
| T0 + 14 | minimalna dužina za odluku | G14 uslov „≥ 14 dana“ |
| T0 + 28 | exit report + odluka | `docs/pilot/EXIT_REPORT.md` |

Ako T0 kasni zbog G12/G13, sve klizi za isti broj dana — ne skraćuje se 14-dnevni period.

## 4. Uloge

| Uloga | Odgovornost |
|---|---|
| **Vlasnik** | regrutacija, onboarding pozivi, prvi odgovor na support, odluke o nastavku |
| **Agent** | alati i izvještaji, trijaža, P1/P2 fixevi, draft exit reporta |
| **Pravnik** | potvrda teksta privatnosti/uslova i načina obavještavanja pilota |
| **Računovođa** | numeracija, PDV tretman refundacije, paušal — pitanja iz feedbacka |

## 5. Onboarding (20 minuta)

Detaljna skripta: [`docs/pilot/ONBOARDING.md`](pilot/ONBOARDING.md). Pet koraka: nalog/firma →
EFD i numeracija → porezi i katalog → prvi kupac i PRAČUN → podsjetnici. Na kraju korisnik **sam**
ponovi izdavanje, a vrijeme se mjeri (cilj < 30 s). Sve se odmah upisuje u `tracking.csv`.

## 6. Podrška

- Kanal: e-mail `podrska@<domen>` + zajednička WhatsApp/Viber grupa (postaviti prije T0).
- Radno vrijeme: radni dani 09–17; **P1 (ne može izdati račun) — isti dan, fix u 24 h**.
- Eskalacija i komunikacija: `docs/INCIDENT_RUNBOOK.md`; trijaža: `docs/pilot/TRIAGE.md`.
- Pilot koristi **staging**, ne produkciju; svaka firma ima svoj nalog, ne dijele se podaci.

## 7. Metrike i sedmični izvještaj

Dva izvora, namjerno razdvojena:

1. **Platforma** — `pnpm --filter api metrics:platform` (baza): registracije, firme, setup,
   fakture, naplate, podsjetnici. Bez PII.
2. **Kohorta** — `docs/pilot/tracking.csv`: onboarding, prva faktura bez pomoći, podsjetnik,
   feedback, NPS, blokatori.

```bash
# status kohorte i kriterija G14
pnpm pilot:status

# sedmični izvještaj (na stagingu)
pnpm --filter api metrics:platform > metrics.json
pnpm pilot:weekly -- --metrics=metrics.json

# ili odjednom (traži bazu i izgrađen API)
pnpm pilot:weekly -- --run

# primjer formata bez PII
pnpm pilot:weekly -- --example --dry-run
```

Pragovi G14: **≥12 korisnika**, **≥14 dana**, **≥70 %** izda račun bez pomoći, **≥50 %** pošalje
podsjetnik, **NPS ≥ 30**, **0 blokatora**. Alat prikazuje svaki kriterij pojedinačno i nikad ne
proglašava kapiju ispunjenom dok svi nisu ✅.

## 8. NPS i feedback

Upitnik i pravila: [`docs/pilot/NPS.md`](pilot/NPS.md). NPS se pita 7. dana i 21. dana; odgovori
se upisuju u `tracking.csv` (kolone `feedback_at`, `nps`). Kritičari (0–6) dobijaju poziv u roku
48 h — to je izvor najkorisnijih nalaza.

## 9. Privatnost i podaci

- `docs/pilot/tracking.csv` je **lokalni** fajl (u `.gitignore`); sedmični izvještaji sadrže samo agregate.
- Pilot firme unose podatke svojih kupaca. Prije T0 im poslati kratko obavještenje (link na
  `/privacy` i `/terms` sa staginga) i zatražiti potvrdu da razumiju da je fiskalizacija **mock**
  (PRAČUN, ne fiskalni račun).
- Za prve testove koristiti **testne kupce**; stvarne podatke tek kad firma izričito pristane.
- GDPR izvoz i brisanje rade na stagingu; ne brisati ništa ručno u bazi.
- Incident sa podacima = stop pilota dok se ne utvrdi uzrok (`INCIDENT_RUNBOOK.md`).

## 10. Stop uslovi

Pilot se pauzira ako se dogodi bilo šta od ovoga:

- P1 bug duže od 24 h ili bilo kakav gubitak podataka;
- pravni zahtjev ili pritužba na obradu podataka;
- Play odbije build/listing, pa korisnici ne mogu instalirati;
- poslije 2 sedmice < 50 % kohorte je izdalo ijedan račun (problem je onboarding/proizvod, ne korisnici);
- support prelazi 1 h/dan po firmi (znak da UI ili dokumentacija ne rade).

## 11. Exit i odluka

Šablon: [`docs/pilot/EXIT_REPORT_TEMPLATE.md`](pilot/EXIT_REPORT_TEMPLATE.md). Odluka ima tri ishoda:

| Ishod | Uslov |
|---|---|
| **Produkcija** | G14 ispunjen, 0 blokatora, pravni paket objavljen, Play spreman |
| **Produžiti pilot** | 1 kriterij blizu cilja (npr. NPS 25) i jasan plan popravke za 2 sedmice |
| **Stop / čekati G0** | pravni ili fiskalni rizik, ili korisnici ne vide vrijednost bez pravog računa |

## 12. Šta je spremno (dokazi)

| Stavka | Gdje | Dokaz |
|---|---|---|
| Praćenje kohorte + kriteriji G14 | `tools/pilot/status.mjs` | `pnpm pilot:selftest` 5/5; primjer 12 učesnika |
| Regrutacija i pipeline | `docs/pilot/RECRUITMENT.md` | pozivnice, kvalifikacija, 15 → 12 |
| Dry-run toka (2 firme) | `tools/pilot/dryrun.mjs` | 22/22 koraka, 2/2 naloga očišćena; `docs/pilot/reports/DRYRUN-2026-11-25.md` |
| Sedmični izvještaj | `tools/pilot/weekly.mjs` | primjer `docs/pilot/reports/2026-W48.example.md` |
| Onboarding skripta | `docs/pilot/ONBOARDING.md` | 20 min, mjerenje „bez pomoći“ |
| NPS upit | `docs/pilot/NPS.md` | 9 pitanja + NPS, rok 7/21 dan |
| Trijaža | `docs/pilot/TRIAGE.md` | P1/P2/P3, petak ritual |
| Exit report | `docs/pilot/EXIT_REPORT_TEMPLATE.md` | odluka sa dokazima |
| Platform-metrike | `apps/api/scripts/platform-metrics.mjs` | `pnpm --filter api metrics:platform` |
| Staging smoke | `tools/staging-smoke.mjs` | 8/8 lokalno (S12B-3) |

## 13. Rizici

| Rizik | Vjerovatnoća | Uticaj | Mitigacija |
|---|---|---|---|
| Korisnici očekuju fiskalni račun | visoka | visok | u pozivu i onboardingu: PRAČUN + mock; G0 status u svakom e-mailu |
| SMS u `log` režimu → metrika podsjetnika bezvrijedna | srednja | visok | ne otvarati pilot bez provajdera; do tada mjeriti samo e-mail podsjetnike |
| Play kašnjenje (12 testera / 14 dana) | srednja | visok | organizacioni nalog ako je moguć; inače pilot = closed test od prvog dana |
| Staging nestabilan | srednja | visok | smoke prije svakog poziva; incident runbook |
| Kohorta se raspadne (sezona radova) | srednja | srednji | 15 pozvanih za 12 aktivnih; zamjene unaprijed |
| Scope creep iz feedbacka | visoka | srednji | samo P1/P2; nove funkcije u parking (plan §14) |
| PII procure u git | niska | visok | `tracking.csv` u `.gitignore`, izvještaji samo agregati, selftest provjerava |
