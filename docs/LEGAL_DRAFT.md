# Pravni drafti — politika privatnosti i uslovi korištenja

> **DRAFT za pregled kod pravnika.** Ovo nije pravni savjet i ne objavljivati bez advokata.
> Verzija 1.0 · 13. 11. 2026. · Prati: `MASTER_PROMPT` §10/§11, `Pre-Deployment_Checklist`.
> Popuniti `<...>` prije objave; uskladiti sa stvarnim podprocesorima i rokovima čuvanja.

## 1. Inventar podataka (osnova za oba dokumenta)

| Podatak | Gdje | Svrha | Pravni osnov (GDPR) | Čuvanje |
|---|---|---|---|---|
| Ime, e-mail, telefon, adresa vlasnika | `users`, `companies` | nalog, fakture, kontakt | izvršenje ugovora | do brisanja naloga |
| Podaci kupaca (ime, JIB, adresa, telefon, e-mail) | `customers` | izdavanje računa | izvršenje ugovora / zakonska obaveza | fiskalni rok |
| Fakture, stavke, naplate, PFR | `invoices`, `payments`, `fiscal_records` | poslovna i fiskalna evidencija | zakonska obaveza | zakonski rok (potvrditi) |
| Podsjetnici (telefon, tekst, status) | `reminders` | naplata | legitimni interes / ugovor | do prestanka |
| Uređaji, push token, refresh hash | `devices` | sigurnost, notifikacije | ugovor / legitimni interes | do odjave uređaja |
| Audit log (akcije) | `audit_log` | sigurnost, revizija | zakonska obaveza / legitimni interes | zakonski rok |
| Dijagnostika (crash) | Sentry (kad uključen) | stabilnost | legitimni interes | 30–90 dana |
| Logovi pristupa | hosting | sigurnost | legitimni interes | 30 dana |

**Podprocesori (popuniti prije objave):** Neon (baza), Vercel (web), Railway/Fly (API), Upstash (Redis),
Cloudflare R2 (PDF), SMS provajder (`<ime>`), Sentry (dijagnostika). Za svakog: DPA i lokacija obrade.

## 2. Politika privatnosti (skeleton)

1. **Ko obrađuje podatke** — `<naziv firme>`, `<adresa>`, `<JIB>`, kontakt `<e-mail>`.
2. **Koje podatke prikupljamo** — tabela iz §1; naglasiti da su podaci kupaca koje firma unosi
   poslovni podaci, a firma je rukovalac za njih.
3. **Svrhe i pravni osnovi** — izvršenje ugovora, zakonske obaveze (fiskalizacija), legitimni interes
   (sigurnost, podsjetnici), privola gdje je potrebna.
4. **Dijeljenje** — samo podprocesori navedeni gore; ne prodajemo podatke; ne koristimo za reklame.
5. **Prenos van BiH/EEA** — ako postoji (npr. Sentry/R2 lokacije), navesti zaštitne mjere.
6. **Rokovi čuvanja** — fiskalni dokumenti po zakonu (potvrditi), ostalo do brisanja naloga.
7. **Prava korisnika** — pristup, ispravka, brisanje, ograničenje, prenosivost, prigovor, pritužba
   Agenciji za zaštitu ličnih podataka BiH; kako se ostvaruju (izvoz/brisanje u aplikaciji + kontakt).
8. **Brisanje naloga** — šta se briše/anonimizuje, šta ostaje po zakonu (fiskalni računi) i zašto.
9. **Bezbjednost** — TLS, hash lozinki (argon2id), revokacija sesija, pristup po firmi (IDOR zaštita).
10. **Kolačići** — samo neophodni (sesija); bez analitičkih/marketinških kolačića u MVP-u.
11. **Djeca** — usluga je za poslovne korisnike 18+.
12. **Izmjene politike** — verzija i datum; obavijest za bitne izmjene.

## 3. Uslovi korištenja (skeleton)

1. **Usluga** — SaaS za fakturisanje i naplatu; funkcije opisane u aplikaciji.
2. **Nalog** — tačni podaci, čuvanje lozinke, odgovornost za aktivnosti naloga; jedan vlasnik po firmi (MVP).
3. **Pretplata i plaćanje** — model: probni period + uplatnica/e-faktura (kartica kasnije, §19);
   cijene, PDV, period, otkaz; povrat sredstava `<politika>`.
4. **Prihvatljivo korištenje** — bez zloupotrebe, bez pokušaja pristupa tuđim podacima, bez automatizovanog
   opterećenja; pravo na suspenziju zbog zloupotrebe.
5. **Podaci korisnika** — korisnik je vlasnik podataka; mi smo obrađivač/rukovalac u skladu sa politikom;
   izvoz i brisanje omogućeni.
6. **Fiskalizacija** — aplikacija radi u mock režimu do integracije sa operaterom; korisnik ne smije
   izdavati dokumente kao fiskalne dok to nije omogućeno; odgovornost za zakonsku usklađenost evidencije.
7. **Dostupnost** — best effort / SLA `<nivo>`; planirano održavanje; ne odgovaramo za prekide
   provajdera (hosting, SMS, operater).
8. **Ograničenje odgovornosti** — do iznosa plaćene pretplate u 12 mjeseci; ne za indirektnu štetu
   (uz pravnu provjeru).
9. **Raskid** — korisnik može prestati; brisanje naloga; fiskalni podaci ostaju po zakonu.
10. **Izmjene uslova** — obavijest 30 dana za bitne izmjene.
11. **Mjerodavno pravo** — pravo Republike Srpske/BiH; nadležni sud `<mjesto>`.

## 4. Mapiranje GDPR prava na funkcije aplikacije

| Pravo | Kako se ostvaruje |
|---|---|
| Pristup / prenosivost | `GET /account/export` (web: Podešavanja → „Preuzmi podatke“) |
| Brisanje | `DELETE /account` (potvrda `OBRISI`); anonimizacija + zadržani fiskalni dokumenti |
| Ispravka | izmjena profila firme, kupaca, faktura (draft) |
| Ograničenje/prigovor | kontakt e-mailom; opt-out podsjetnika po kupcu |
| Pritužba | Agencija za zaštitu ličnih podataka BiH |

## 5. Otvorena pravna pitanja (za pravnika/računovođu)

- [ ] Tačan zakonski rok čuvanja fiskalnih računa i audit traga (BiH/RS) i šta se smije anonimizovati.
- [ ] Da li je firma rukovalac ili obrađivač za podatke kupaca (MVP: firma unosi svoje kupce).
- [ ] Osnov za SMS podsjetnike kupcima (legitimni interes vs privola) i kako dokumentovati opt-out.
- [ ] Pretplate: paušalni limit/PDV prag, tretman probnog perioda, e-faktura.
- [ ] DPA sa podprocesorima i prenos podataka van BiH (Sentry/R2/Vercel/Neon lokacije).
- [ ] Politika povrata i otkaza pretplate.
- [ ] Obaveze za fiskalizaciju dok je `ESIR_MODE=mock` (šta korisnik smije izdavati).
