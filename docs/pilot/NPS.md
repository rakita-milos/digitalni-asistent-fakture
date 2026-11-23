# NPS i feedback — upitnik i pravila

> Prati: `docs/PILOT_PLAN.md` §8. NPS je jedan od šest kriterija G14 (cilj **≥ 30**), ali sa
> kohortom od 12–15 ljudi broj je **grub** — zato se uvijek čita zajedno sa otvorenim odgovorima.

## 1. Kada se pita

| Talas | Kada | Šta |
|---|---|---|
| 1 | 7. dan poslije onboardinga | NPS + 2 otvorena pitanja (5 min) |
| 2 | 21. dan (ili na kraju pilota) | NPS + šta bi popravili + da li bi nastavili |

Ne pitati ranije od 7 dana — korisnik još nije izdao dovoljno računa da ima mišljenje.

## 2. Pitanja

**NPS (obavezno):**

> Koliko je vjerovatno da ćeš preporučiti Digitalni Asistent kolegi koji vodi sličnu firmu?
> (0 = nikako, 10 = sigurno)

**Otvorena (obavezno):**

1. Šta te je najviše usporilo u prvoj sedmici?
2. Koja jedna stvar bi najviše pomogla da ovo koristiš stalno?

**Opciono (ako ima vremena):**

3. Da li bi nastavio koristiti aplikaciju i poslije pilota? (da / ne / možda + zašto)
4. Šta ti je nedostajalo kod PDF-a/QR-a ili podsjetnika?

## 3. Skala i računanje

- 9–10 = **promoter**, 7–8 = **pasivan**, 0–6 = **kritičar**.
- `NPS = % promotera − % kritičara` (zaokruženo na cijeli broj).
- Računa ga `pnpm pilot:status` iz kolona `feedback_at` i `nps`; ne računati ručno u tabeli.
- Bez odgovora se **ne** broji kao 0 — nego kao nedostajući podatak (i vidi se u `feedback %`).

## 4. Kako se šalje

**E-mail (preporučeno, 7. dan):**

> **Predmet:** 2 minute — kako ti ide sa Digitalnim Asistentom?
>
> Zdravo,
>
> prošla je sedmica od kada koristiš aplikaciju. Zanima me iskreno mišljenje, i dobro i loše:
>
> 1. Koliko je vjerovatno da ćeš je preporučiti kolegi? (0–10)
> 2. Šta te je najviše usporilo?
> 3. Koja jedna stvar bi najviše pomogla?
>
> Odgovori možeš samo odgovoriti na ovaj e-mail. Hvala — ovo direktno mijenja šta radimo sljedeće.

**U aplikaciji (opciono, kad bude feature flag):** isto pitanje + dugme „Pošalji“.

## 5. Šta poslije odgovora

| Odgovor | Akcija | Rok |
|---|---|---|
| 0–6 (kritičar) | pozvati 15 min, pitati šta bi ih zadržalo; upisati razlog u `notes` | 48 h |
| 7–8 (pasivan) | poslati jedno konkretno pitanje: „šta bi podiglo na 9?“ | 7 dana |
| 9–10 (promoter) | pitati za preporuku (2 kolege) + dozvolu za citat u exit reportu | 7 dana |
| Bilo koji P1 problem u odgovoru | odmah u trijažu (`TRIAGE.md`), ne čekati petak | 24 h |

## 6. Kako se citira u exit reportu

- Samo anonimizovano: „4 od 9 korisnika navelo je unos kupca kao najveće usporavanje.“
- Bez imena, naziva firme, grada i specifičnih iznosa.
- NPS uvijek uz `n` (npr. „NPS +11 (n=9)“) da se vidi koliko je uzorak mali.

## 7. Česte greške

- Miješati NPS sa CSAT-om („koliko si zadovoljan“) — ovdje je samo preporuka 0–10.
- Računati NPS iz 3 odgovora i donositi odluku — uvijek gledati i otvorena pitanja.
- Tjerati promotere da daju imena bez pitanja za dozvolu.
- Upisivati NPS u `tracking.csv` kao 0 kad nema odgovora — ostaviti prazno.
