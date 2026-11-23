/**
 * Pravni tekstovi za javne stranice `/privacy` i `/terms`.
 *
 * Izvor: `docs/LEGAL_DRAFT.md` (verzija 1.0, 13.11.2026). Tekst je namjerno razdvojen od JSX-a
 * da bi se mogao testirati bez rendera i da bi ga pravnik mogao mijenjati na jednom mjestu.
 *
 * Mjesta u uglastim zagradama (`<...>`) su podaci koje firma mora popuniti prije objave —
 * test provjerava da su označena i da se ne izgube. Ovo nije pravni savjet.
 */

export const LEGAL_VERSION = '1.0';
export const LEGAL_UPDATED_AT = '23.11.2026.';
export const LEGAL_UPDATED_ISO = '2026-11-23';

export const LEGAL_DISCLAIMER =
  'Radna verzija — tekst je pripremljen za pregled pravnika i ne smatra se konačnim pravnim ' +
  'tekstom do potvrde. Podaci firme označeni uglastim zagradama popunjavaju se prije objave.';

export interface LegalSection {
  readonly id: string;
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly items?: readonly string[];
}

/** Podprocesori iz `docs/LEGAL_DRAFT.md` §1 — moraju se poklopiti sa stvarnim ugovorima/DPA. */
export const LEGAL_PROCESSORS = [
  'Neon (hosting baze podataka)',
  'Vercel (hosting web aplikacije)',
  'Railway ili Fly.io (hosting API-ja i worker-a)',
  'Upstash (Redis: sesije, ograničenja i red poslova)',
  'Cloudflare R2 (čuvanje PDF faktura)',
  'SMS provajder: <ime provajdera>',
  'Sentry (dijagnostika grešaka, kada je uključen)',
] as const;

export const PRIVACY_SECTIONS: readonly LegalSection[] = [
  {
    id: 'rukovalac',
    title: '1. Ko obrađuje podatke',
    paragraphs: [
      'Rukovalac podacima je <naziv firme>, <adresa>, JIB <JIB>, kontakt <e-mail>.',
      'Za podatke o kupcima koje firma unosi u aplikaciju, firma je rukovalac, a Digitalni Asistent ' +
        'obrađuje te podatke po njenom nalogu kao obrađivač.',
    ],
  },
  {
    id: 'podaci',
    title: '2. Koje podatke prikupljamo',
    paragraphs: [
      'Prikupljamo samo podatke potrebne za rad aplikacije. Vrste podataka i svrhe su:',
    ],
    items: [
      'Podaci naloga: ime, e-mail, telefon i adresa vlasnika — nalog, fakture i kontakt.',
      'Podaci kupaca: naziv, JIB, adresa, telefon i e-mail — izdavanje računa i naplata.',
      'Fakture, stavke, naplate i fiskalni zapisi — poslovna i fiskalna evidencija.',
      'Podsjetnici: telefon, tekst i status — naplata potraživanja.',
      'Uređaji: push token i hash refresh tokena — sigurnost i prijava.',
      'Audit log: zapis akcija u aplikaciji — sigurnost i revizija.',
      'Dijagnostika: podaci o greškama kada je Sentry uključen.',
      'Logovi pristupa serveru — sigurnost.',
    ],
  },
  {
    id: 'svrhe',
    title: '3. Svrhe i pravni osnovi',
    paragraphs: [
      'Podatke obrađujemo radi izvršenja ugovora (pružanje usluge fakturisanja), radi zakonskih ' +
        'obaveza (fiskalizacija i čuvanje poslovne evidencije), na osnovu legitimnog interesa ' +
        '(sigurnost, sprečavanje zloupotreba, podsjetnici kupcima) i, kada je potrebno, na osnovu privole.',
      'Podatke ne koristimo za reklamiranje niti ih prodajemo.',
    ],
  },
  {
    id: 'dijeljenje',
    title: '4. Dijeljenje i podprocesori',
    paragraphs: [
      'Podatke dijelimo samo sa podprocesorima koji su neophodni za rad usluge. Sa svakim ' +
        'podprocesorom sklapamo ugovor o obradi podataka (DPA) i ugovaramo odgovarajuće mjere zaštite.',
    ],
    items: LEGAL_PROCESSORS,
  },
  {
    id: 'prenos',
    title: '5. Prenos podataka van BiH i EEA',
    paragraphs: [
      'Neki podprocesori mogu obrađivati podatke van Bosne i Hercegovine i Evropskog ekonomskog ' +
        'prostora (na primjer Sentry ili Cloudflare R2). U tom slučaju prenos se vrši uz odgovarajuće ' +
        'zaštitne mjere: standardne ugovorne klauzule ili drugi zakonom predviđen mehanizam. ' +
        'Konkretne lokacije i mjere potvrđuju se prije objave i ažuriraju u ovoj politici.',
    ],
  },
  {
    id: 'rokovi',
    title: '6. Rokovi čuvanja',
    paragraphs: [
      'Fiskalne račune i prateću evidenciju čuvamo u roku propisanom zakonom (<zakonski rok>). ' +
        'Ostale podatke čuvamo do brisanja naloga, osim ako zakon nalaže duže čuvanje.',
      'Dijagnostičke podatke (kada je Sentry uključen) čuvamo 30–90 dana, a logove pristupa 30 dana.',
    ],
  },
  {
    id: 'prava',
    title: '7. Tvoja prava',
    paragraphs: [
      'U skladu sa Zakonom o zaštiti ličnih podataka i GDPR-om imaš pravo na:',
    ],
    items: [
      'pristup svojim podacima i kopiju podataka (izvoz iz aplikacije: Podešavanja → Preuzmi podatke);',
      'ispravku netačnih podataka (izmjena profila, kupaca i draft faktura);',
      'brisanje podataka (Podešavanja → Obriši nalog; fiskalni dokumenti ostaju po zakonu);',
      'ograničenje obrade i prigovor na obradu (kontakt e-mailom);',
      'prenosivost podataka (izvoz u mašinski čitljivom formatu);',
      'pritužbu Agenciji za zaštitu ličnih podataka BiH.',
    ],
  },
  {
    id: 'brisanje',
    title: '8. Brisanje naloga',
    paragraphs: [
      'Brisanjem naloga uklanjaju se lični podaci i pristup se ukida. Fiskalni računi i prateća ' +
        'evidencija se ne brišu, već se zadržavaju u skladu sa zakonskim rokovima; veza sa ličnim ' +
        'podacima se anonimizuje gdje je to zakonom dozvoljeno.',
    ],
  },
  {
    id: 'bezbjednost',
    title: '9. Bezbjednost',
    paragraphs: [
      'Sav saobraćaj ide preko TLS-a. Lozinke čuvamo kao argon2id hash, sesije se mogu opozvati po ' +
        'uređaju, a svaki zahtjev se provjerava prema firmi korisnika (zaštita od pristupa tuđim podacima). ' +
        'Pristup produkcijskim podacima je ograničen na ovlašćena lica.',
    ],
  },
  {
    id: 'kolacici',
    title: '10. Kolačići',
    paragraphs: [
      'Koristimo samo neophodne kolačiće za održavanje prijavljene sesije. U MVP-u nema analitičkih ' +
        'niti marketinških kolačića.',
    ],
  },
  {
    id: 'djeca',
    title: '11. Djeca',
    paragraphs: [
      'Usluga je namijenjena poslovnim korisnicima starijim od 18 godina i ne prikuplja podatke o djeci.',
    ],
  },
  {
    id: 'izmjene',
    title: '12. Izmjene politike',
    paragraphs: [
      'Svaka izmjena dobija novu verziju i datum objave. O bitnim izmjenama korisnici se obavještavaju ' +
        'u aplikaciji ili e-mailom najkasnije 30 dana prije stupanja na snagu, kada je to moguće.',
    ],
  },
];

export const TERMS_SECTIONS: readonly LegalSection[] = [
  {
    id: 'usluga',
    title: '1. Usluga',
    paragraphs: [
      'Digitalni Asistent je softver kao usluga (SaaS) za fakturisanje i naplatu za mikro-poduzeća. ' +
        'Funkcije su opisane u aplikaciji i mogu se mijenjati uz obavijest iz člana 10.',
    ],
  },
  {
    id: 'nalog',
    title: '2. Nalog',
    paragraphs: [
      'Korisnik je dužan da unese tačne podatke, čuva lozinku i odgovoran je za aktivnosti na nalogu. ' +
        'U MVP-u jedna firma ima jednog vlasnika naloga.',
    ],
  },
  {
    id: 'pretplata',
    title: '3. Pretplata i plaćanje',
    paragraphs: [
      'Usluga se naplaćuje po modelu probni period + pretplata (uplatnica ili e-faktura; kartično ' +
        'plaćanje kasnije). Cijene, PDV, period i način otkaza istaknuti su prije plaćanja; povrat ' +
        'sredstava uređuje se politikom povrata: <politika povrata>.',
    ],
  },
  {
    id: 'koristenje',
    title: '4. Prihvatljivo korištenje',
    paragraphs: [
      'Zabranjeno je pokušavati pristup tuđim podacima, opterećivati uslugu automatizovanim ' +
        'zahtjevima, unositi nezakonit sadržaj ili na drugi način zloupotrijebiti uslugu. U slučaju ' +
        'zloupotrebe možemo privremeno ili trajno suspendovati nalog.',
    ],
  },
  {
    id: 'podaci-korisnika',
    title: '5. Podaci korisnika',
    paragraphs: [
      'Korisnik je vlasnik podataka koje unosi. Mi ih obrađujemo u skladu sa Politikom privatnosti. ' +
        'Izvoz i brisanje podataka omogućeni su u aplikaciji.',
    ],
  },
  {
    id: 'fiskalizacija',
    title: '6. Fiskalizacija',
    paragraphs: [
      'Aplikacija trenutno radi u probnom (mock) režimu fiskalizacije do integracije sa operaterom ' +
        'ESIR. Dokumenti izdati u tom režimu nose oznaku PRAČUN i nisu fiskalni računi. Korisnik ne ' +
        'smije izdavati dokumente kao fiskalne dok ta mogućnost nije zvanično omogućena. Korisnik je ' +
        'odgovoran za zakonsku usklađenost svoje evidencije.',
    ],
  },
  {
    id: 'dostupnost',
    title: '7. Dostupnost',
    paragraphs: [
      'Uslugu pružamo po principu najboljeg napora, sa nivoom usluge <nivo SLA>. Planirano ' +
        'održavanje se najavljuje unaprijed. Ne odgovaramo za prekide uzrokovane provajderima ' +
        '(hosting, SMS, operater) niti za radnje van naše kontrole.',
    ],
  },
  {
    id: 'odgovornost',
    title: '8. Ograničenje odgovornosti',
    paragraphs: [
      'Odgovornost je ograničena na iznos pretplate plaćene u 12 mjeseci prije nastanka štete. Ne ' +
        'odgovaramo za indirektnu štetu, izgubljenu dobit ili izgubljene podatke koje je korisnik ' +
        'dužan da čuva izvozom. Ova odredba se primjenjuje u granicama koje dozvoljava zakon.',
    ],
  },
  {
    id: 'raskid',
    title: '9. Raskid',
    paragraphs: [
      'Korisnik može prestati koristiti uslugu u svakom trenutku i zatražiti brisanje naloga. ' +
        'Fiskalni dokumenti ostaju sačuvani u skladu sa zakonom i nakon raskida.',
    ],
  },
  {
    id: 'izmjene-uslova',
    title: '10. Izmjene uslova',
    paragraphs: [
      'O bitnim izmjenama obavještavamo najkasnije 30 dana prije stupanja na snagu. Nastavak ' +
        'korištenja poslije tog roka znači prihvatanje izmijenjenih uslova.',
    ],
  },
  {
    id: 'pravo',
    title: '11. Mjerodavno pravo',
    paragraphs: [
      'Primjenjuje se pravo Republike Srpske i Bosne i Hercegovine. Za sporove je nadležan sud u ' +
        '<mjesto>.',
    ],
  },
];
