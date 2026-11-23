# Regrutacija pilota — pozivnice i pipeline

> Prati: `docs/PILOT_PLAN.md` §2–§3. Cilj: **15 pozvanih → 12 aktivnih** firmi (minimum zbog
> G14 i Play pravila 12 testera / 14 dana). Bez plaćenih oglasa i bez nagrada za pozitivne odgovore.

## 1. Kriteriji (kratka provjera prije poziva)

Pitaj u prvom razgovoru, ne u formi:

- [ ] Vodi firmu ili radi kao majstor/izvođač i **redovno izdaje fakture** (5–50 mjesečno).
- [ ] Fakture izdaje sa telefona ili laptopa — ne samo „na papiru kod knjigovođe“.
- [ ] Android telefon (10 ili noviji) i Google nalog za Play instalaciju.
- [ ] Može 4 sedmice koristiti aplikaciju u stvarnom poslu i dati dva kratka odgovora.
- [ ] Razumije da je fiskalizacija u pilotu **mock** (PRAČUN, ne fiskalni račun).

Ako ne prolazi 1, 2 ili 5 — ljubazno odbij i zapiši u pipeline; nemoj „ubjeđivati“.

## 2. Pipeline (15 pozvanih)

| Faza | Definicija | Cilj |
|---|---|---|
| `invited` | poslana pozivnica | 15 |
| `confirmed` | potvrdio učešće i termin | 13 |
| `onboarded` | prošao onboarding poziv | 12 |
| `active` | izdao bar jedan dokument u prvoj sedmici | 12 |
| `dropped` | odustao (razlog u `notes`) | ≤ 3 |

U `docs/pilot/tracking.csv` se vodi od `onboarded` faze; pozvani bez termina drži u jednostavnoj
listi (e-mail/WhatsApp) dok ne potvrde. Ne miješati „poslao sam poruku“ sa „potvrdio“.

## 3. Poruka (WhatsApp/Viber, kratko)

> Zdravo `<ime>`, radim na aplikaciji za fakture i naplatu za majstore. Tražim 12 firmi koje bi je
> koristile 4 sedmice u stvarnom poslu i rekle mi šta ne radi. Besplatno je, bez obaveze da ostaneš.
> Fiskalizacija je za sada probna — izdaje se PRAČUN, ne fiskalni račun. Ako si zainteresovan,
> pošaljem ti 5 pitanja i dogovorimo 20 minuta za postavljanje.

## 4. E-mail pozivnica

> **Predmet:** Tražim 12 firmi za pilot — fakture i naplata (4 sedmice)
>
> Zdravo `<ime>`,
>
> pravim Digitalni Asistent — aplikaciju za izdavanje faktura, PRAČUNA i praćenje naplate, namijenjenu
> majstorima i mikro-firmama. Prije objave tražim **12 firmi** koje će je koristiti u stvarnom poslu
> četiri sedmice i reći mi gdje zapinju.
>
> **Šta dobijaš:** besplatan pristup u pilotu, 20 minuta postavljanja sa mnom, direktan kanal za
> prijave i popravke, i uticaj na to šta se prvo gradi.
>
> **Šta tražim:** da izdaš bar jedan račun prve sedmice, probaš podsjetnik kupcu i odgovoriš na dva
> kratka upitnika (7. i 21. dan).
>
> **Važno:** fiskalizacija je u pilotu **probna** — dokumenti se izdaju kao PRAČUN i nisu fiskalni
> računi. Podaci su na testnom (staging) okruženju, a obrađuju se po politici privatnosti
> (`<link>/privacy`); možeš prestati u svakom trenutku i zatražiti izvoz ili brisanje.
>
> Ako ti odgovara, odgovori sa „da“ i predloži dva termina za 20 minuta. Ako ne — nema problema,
> javi samo „ne“ da znam da ne šaljem ponovo.
>
> `<ime i kontakt>`

## 5. Follow-up (3. dan, samo jednom)

> Zdravo `<ime>`, samo kratko — da li ti pilot još stoji na radaru? Ako je gužva, mogu se javiti
> za dvije sedmice. Ako ne, javi „ne“ i neću više pisati.

Poslije ovoga **ne** poslati treću poruku. Pipeline ide u `dropped` sa razlogom „nije odgovorio“.

## 6. Potvrda termina (prije poziva)

> Super, vidimo se `<dan> u <vrijeme>`. Prije poziva ti pošaljem link za instalaciju i 5 minuta
> uputstva. Treba ti samo telefon i podaci firme (JIB, adresa); ako imaš, pripremi i jednog kupca
> za probni račun.

## 7. Šta se ne obećava

- Fiskalni račun, veza sa ESIR-om, ni datum za G0.
- SMS u produkciji (dok provajder nije uključen).
- Da će aplikacija ostati besplatna poslije pilota.
- Rok za funkcije koje traži (samo „zapisujem, javljam“).

## 8. Etika i privatnost

- Pozivnice šalji lično ili u grupi gdje je to dozvoljeno; bez mass e-maila i bez kupljenih lista.
- Feedback se ne plaća i ne uslovljava nastavkom korištenja.
- Ne dijeli podatke jedne firme sa drugom; ne pokazuj tuđe fakture u demo pozivima.
- Ako firma traži brisanje prije kraja pilota — odmah izvoz/brisanje i `dropped` sa razlogom.
- PII (ime, telefon, firma) ostaje u `tracking.csv`, ne u git-u i ne u izvještajima.
