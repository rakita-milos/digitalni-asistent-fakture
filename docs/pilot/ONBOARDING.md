# Onboarding poziv — skripta (20 minuta)

> Prati: `docs/PILOT_PLAN.md` §5. Cilj poziva: korisnik **sam** izda prvi dokument, zna gdje je
> podrška i zna da je fiskalizacija mock. Sve što primijetiš ide odmah u `docs/pilot/tracking.csv`.

## 0. Prije poziva (5 minuta, obavezno)

- [ ] Firma i nalog su kreirani na **stagingu** (ne demo nalog); korisnik zna e-mail/lozinku.
- [ ] Aplikacija instalirana iz Play-a (internal/closed track) ili APK na telefonu.
- [ ] Poznat model telefona i Android verzija → kolona `device`.
- [ ] `docs/pilot/tracking.csv` ima novi red sa `id` (npr. `P07`) i datumom poziva.
- [ ] Testni broj za SMS (tvoj) da pokažeš kako podsjetnik izgleda.
- [ ] Otvoren `docs/INCIDENT_RUNBOOK.md` ako nešto pukne uživo.

## 1. Uvod (2 min)

Reci ovo, bez marketinga:

> „Ovo je pilot verzija. Fiskalizacija je trenutno **mock** — dokumenti se zovu PRAČUN i nisu
> fiskalni računi. Cilj pilota je da vidimo da li ti aplikacija stvarno štedi vrijeme. Ako nešto
> zapne, to je naš bug, ne tvoja greška — pokaži mi gdje si stao.“

## 2. Postavljanje firme (8 min)

Korisnik radi, ti gledaš (ne klikćeš umjesto njega):

1. **Nalog i firma** — naziv, JIB, adresa, telefon; potvrda e-maila.
2. **EFD i numeracija** — EFD ID (mock), prefix, godina; objasni da se broj dodjeljuje pri izdavanju.
3. **Porezi i katalog** — dodaj 17 % (ili njegovu stopu) i 2–3 usluge/artikla koje stvarno koristi.
4. **Prvi kupac** — unesi stvarnog ili testnog kupca (ime, JIB ako ima, adresa).

Zabilježi svako zapinjanje: ekran + akcija + šta je očekivao.

## 3. Prvi PRAČUN bez pomoći (5 min) — mjerenje

Ovo je **ključna metrika** („izda račun bez pomoći“).

1. Reci: „Napravi račun sa dvije stavke, bez mog pomaganja. Ako zapneš, pitaj — ali prvo probaj.“
2. **Pokreni štopericu** kad počne. Ne govori, ne pokazuj, ne klikaš.
3. Ako zapne: zabilježi **tačan ekran i korak**, pusti ga još 30 s, pa pomozi. Prekini mjerenje.
4. Ako uspije: zaustavi štopericu, upiši `first_invoice_seconds` i `unaided_invoice=da`.
5. Poslije izdavanja: otvoriti PDF, pokazati QR, objasniti oznaku PRAČUN.

> Cilj je < 30 s za račun sa 2 stavke. Ako je > 60 s ili je trebala pomoć — to je UX zadatak,
> ne „korisnik nije tehnički“.

## 4. Naplata i podsjetnici (4 min)

1. Zabilježi djelimičnu naplatu; provjeri da početna strana pokazuje ostatak.
2. Uključi plan podsjetnika (npr. 3 dana prije i na dan roka).
3. Pošalji **ručni podsjetnik** na svoj testni broj (ili e-mail ako SMS još nije živ).
4. Objasni opt-out: kupac koji se odjavi ne dobija automatske podsjetnike.

## 5. Zatvaranje (1 min)

- [ ] Reci gdje je podrška (e-mail + grupa) i radno vrijeme.
- [ ] Dogovori prvi feedback za **7 dana** (NPS + 2 pitanja, `docs/pilot/NPS.md`).
- [ ] Pitaj: „Šta bi jedna stvar bila da je popravimo prvo?“
- [ ] Potvrdi da smije koristiti aplikaciju za svoje firme u pilotu i da su podaci na stagingu.

## 6. Upis u tabelu (odmah poslije poziva)

| Kolona | Šta upisuješ |
|---|---|
| `id` | `P07` (nikad ime) |
| `company`, `contact`, `phone` | PII — ostaje lokalno, ne u git |
| `device` | npr. `Android 14, Samsung A54` |
| `invited_at` / `onboarded_at` | datum poziva / datum završenog onboardinga |
| `unaided_invoice` | `da` samo ako je sam izdao bez ijedne pomoći |
| `first_invoice_seconds` | štoperica iz koraka 3 |
| `reminder_sent` | `da` ako je poslao bar jedan |
| `feedback_at`, `nps` | poslije upitnika |
| `blocker_open` | `da` ako ne može izdati račun ili je izgubio podatke |
| `notes` | kratko: gdje je zapelo, šta je tražio |

## 7. E-mail poslije poziva (šablon)

> **Predmet:** Digitalni Asistent — tvoj prvi račun i šta dalje
>
> Zdravo,
>
> hvala za današnji poziv. Tvoj nalog je spreman na staging adresi: `<link>`.
> Podsjećam: fiskalizacija je u pilotu **mock** — dokumenti su PRAČUNI i nisu fiskalni računi.
>
> Sljedeće sedmice ti šaljem kratak upitnik (2 minute). Ako bilo šta zapne, piši na
> `podrska@<domen>` ili u grupu — odgovaramo isti dan za blokade.
>
> Hvala što gradiš ovo sa nama.

## 8. Šta ne raditi

- Ne izdavati račun umjesto korisnika „da bude brže“ — kvari mjerenje.
- Ne obećavati fiskalni račun, SMS u produkciji ni rok za G0.
- Ne unositi stvarne podatke kupaca bez izričite potvrde firme.
- Ne ostavljati poziv bez upisanog reda u `tracking.csv` — izgubljeni podatak se ne vraća.
