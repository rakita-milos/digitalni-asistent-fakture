# Trijaža pilota — severiteti i petak ritual

> Prati: `docs/PILOT_PLAN.md` §8, `docs/INCIDENT_RUNBOOK.md`. Cilj: nijedan blokator ne preživi
> 24 h, a sve ostalo ima jasnog vlasnika i rok.

## 1. Severiteti

| Nivo | Definicija | Primjeri | Prvi odgovor | Fix |
|---|---|---|---|---|
| **P1 — blokator** | korisnik **ne može izdati račun** ili gubi podatke | izdavanje vraća 500; PDF prazan; sync obriše draft; login ne radi; aplikacija pada pri pokretanju | isti dan (radno vrijeme) | **24 h** ili rollback/feature flag |
| **P2 — ozbiljno** | može raditi, ali uz zaobilazni put ili je izgubljeno vrijeme | pogrešan obračun PDV-a u specifičnom slučaju; podsjetnik ne ode; QR se ne skenira; spor unos > 5 s | 1 radni dan | naredna sedmica |
| **P3 — kozmetika/UX** | ne blokira posao | poravnanje, tekst, boja, sitna konfuzija u formi | 3 radna dana | backlog / parking |
| **Pitanje** | nije bug | „kako da…“, zahtjev za funkciju | 1 radni dan | odgovor ili parking |

**Pravilo:** ako ne možeš izdati račun na stagingu — to je P1, bez rasprave. Ako je samo jedan
uređaj/verzija, i dalje P1 za tog korisnika.

## 2. Petak ritual (30 minuta)

1. **5 min — brojevi:** `pnpm pilot:status` i `pnpm pilot:weekly` (ili ručno ako baza nije dostupna).
2. **10 min — nove prijave:** svaka dobija nivo, vlasnika i rok; P1 se rješava odmah, ne u sprintu.
3. **10 min — šta je popravljeno:** svaki fix dobija test i unos u `PROGRESS.md`.
4. **5 min — odluke:** šta ide u parking (nove funkcije), šta se odlaže, koga treba pitati.

Rezultat petka: ažuriran `tracking.csv` (`blocker_open`), zatvoreni P1, jedan kratak zapis u
`docs/pilot/reports/<sedmica>.md` (generiše ga alat).

## 3. Šablon prijave (GitHub issue)

```
Naslov: [P1] Izdavanje fakture vraća 500 na Android 12

Korisnik: P07 (bez imena/firme u issue-u)
Uređaj: Android 12, <model>
Koraci:
1. Prijava
2. Nova faktura, 2 stavke, PDV 17 %
3. Klik „Izdaj“
Očekivano: faktura ISSUED + PFR
Stvarno: ekran greške, faktura ostaje DRAFT
Dokaz: screenshot / request-id iz poruke (npr. 3f2a…)
Učestalost: uvijek / povremeno (koliko puta)
Uticaj: ne može izdati račun
```

- U issue **ne** unositi ime, telefon ni naziv firme — samo `id` učesnika (PII ostaje u `tracking.csv`).
- Ako postoji `request-id`, obavezno ga zalijepiti — filter ga šalje u log/Sentry.
- Poslije fixa: dodati test (API/e2e/unit) i upisati commit u `PROGRESS.md`.

## 4. Komunikacija sa korisnikom

**Potvrda (P1, isti dan):**

> Primio sam, reprodukujem odmah. Javljam ti u toku dana — do tada možeš koristiti <zaobilazni put>
> ako ti odgovara. Hvala što si prijavio.

**Riješeno:**

> Popravljeno je i dostupno na stagingu. Možeš li probati <korak> i javiti da li radi?
> Ako i dalje puca, pošalji screenshot i vrijeme kad se desilo.

**Neće biti riješeno u pilotu:**

> Ovo je van obima pilota (funkcija <X>). Zapisao sam za poslije pilota; u pilotu ostaje <zaobilazni put>.

## 5. Eskalacija

- Gubitak podataka, sumnja na curenje podataka, ili firma ne može raditi 2 h → **stop pilota** i
  `docs/INCIDENT_RUNBOOK.md` (severitet, komunikacija, RCA).
- Isto pitanje od 3+ korisnika → nije support, nego UX/bug: ide u sprint, ne u pojedinačne odgovore.
- P1 koji se ponavlja poslije fixa → feature flag isključi rizičnu funkciju dok se ne nađe uzrok.

## 6. Šta se ne radi

- Ne otvarati issue bez `id` učesnika i koraka reprodukcije.
- Ne miješati P1 i „važno za budućnost“ — P1 je samo ono što blokira izdavanje računa.
- Ne obećavati rok za G0 ni fiskalni račun u odgovoru na P2/P3.
