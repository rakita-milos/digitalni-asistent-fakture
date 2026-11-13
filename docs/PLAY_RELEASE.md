# Play objava — priprema i checklist

> Verzija 1.0 · 13. 11. 2026. · Prati: `PLAN_DALJEG_RADA.md` (Sprint 11), `MASTER_PROMPT` §13,
> `Pre-Deployment_Checklist`. Cilj: objava bez odbijanja i bez mijenjanja package name-a poslije prve objave.

## 1. Odluke prije prve objave (nepovratno)

| Odluka | Trenutno | Šta treba |
|---|---|---|
| **Package name** | `com.digitalniasistent` (privremen) | finalno ime brenda **prije** prvog AAB-a; poslije objave se ne mijenja |
| **Ime aplikacije** | Digitalni Asistent | potvrditi da nije zauzeto + domen |
| **Developer account** | nema | Play Console (25 $ jednokratno); lični vs organizacioni |
| **Signing key** | debug keystore | release keystore (čuvati zauvek; izgubljen = nova aplikacija) |
| **Privacy/ToS URL** | draft | objavljeni na domenu (obavezno za Play) |

**Važno:** ako je developer account **lični** (ne organizacija), Google traži **12 testera / 14 dana**
closed testinga prije produkcije. Za organizacioni account to nije obavezno, ali je preporučeno.

## 2. Potpisivanje i AAB

**Stanje 2026-11-13:** signing config je implementiran u `apps/mobile/android/app/build.gradle`
(`signingConfigs.release`), ali **AAB još nije napravljen** — lokalno nema JDK 17.

```bash
# 1) jednom, lokalno (JDK 17); keystore NIKAD u repo
keytool -genkeypair -v -keystore digitalni-asistent-release.keystore \
  -alias digitalni -keyalg RSA -keysize 2048 -validity 10000

# 2) kopirati keystore.properties.example u keystore.properties i upisati putanju/lozinke
#    (ili postaviti DA_KEYSTORE_PATH, DA_KEYSTORE_PASSWORD, DA_KEY_ALIAS, DA_KEY_PASSWORD u CI)

# 3) build release AAB
cd apps/mobile/android
./gradlew bundleRelease
# izlaz: app/build/outputs/bundle/release/app-release.aab
```

- Signing config čita `android/keystore.properties` (lokalno) ili env varijable
  `DA_KEYSTORE_PATH`/`DA_KEYSTORE_PASSWORD`/`DA_KEY_ALIAS`/`DA_KEY_PASSWORD` (CI).
  Bez keystore-a release build ostaje na debug potpisu — **AAB za Play se tako ne šalje**.
- `keystore.properties` i `*.keystore` su u `.gitignore` (osim RN `debug.keystore`).
- `versionCode`/`versionName` u `android/app/build.gradle` — povećavati za svaku objavu
  (trenutno 1 / "1.0"; prvi Play build može ostati 1).
- Debug APK (`assembleDebug`) ostaje za interni test; release AAB ide u Play.
- CI trenutno pravi **samo debug APK**; release job dodati kad budu GitHub Secrets
  (keystore base64 + 3 lozinke) i JDK 17 u runneru (već je u `android` jobu).

## 3. Store listing (tekst draft)

- **Naziv (≤ 30):** Digitalni Asistent
- **Kratki opis (≤ 80):** Fakture, predračuni i naplata za majstore i mikro-firme — brzo i offline.
- **Puni opis (≤ 4000):** vidi dolje.
- **Kategorija:** Business
- **Kontakt e-mail:** podrška@<domen>

### Puni opis (draft)

> Digitalni Asistent je aplikacija za fakturisanje i naplatu namijenjena majstorima i mikro-firmama.
>
> **Brzo izdavanje računa.** Napravite fakturu za manje od 30 sekundi: izaberite kupca, dodajte
> stavke, PDV i popust — obračun je automatski.
>
> **PRAČUN i račun.** Izdajte predračun i pretvorite ga u račun jednim dodirom.
>
> **Naplata i dugovanja.** Zabilježite punu ili djelimičnu naplatu i vidite ko vam duguje i koliko.
>
> **Podsjetnici.** Automatski SMS podsjetnici na dospjele fakture (kupac se može odjaviti).
>
> **Izvještaji.** Pregled potraživanja po rokovima i mjesečni izvještaj.
>
> **Radi i offline.** Kreirajte fakturu bez mreže; podaci se sinhronizuju kada se veza vrati.
>
> **Vaši podaci.** Izvoz i brisanje naloga su dostupni u aplikaciji/webu; fiskalni dokumenti se
> čuvaju u skladu sa zakonom.
>
> Aplikacija je namijenjena poslovnim korisnicima (18+).

### Grafički materijal

| Element | Zahtjev | Stanje 2026-11-13 |
|---|---|---|
| Ikona | 512×512 PNG, bez providnosti | ✅ placeholder: `apps/mobile/assets/branding/play-icon-512.png` |
| Feature graphic | 1024×500 PNG/JPEG | ✅ placeholder: `apps/mobile/assets/branding/play-feature-graphic-1024x500.png` |
| Screenshotovi | 2–8 telefonskih (1080×1920 ili 9:16), bez lažnih podataka | ❌ treba snimiti na uređaju (JDK 17/APK) |
| Tabela/tablet | opciono | — |
| Launcher ikone | `mipmap-*` sve gustine | ✅ placeholder generisan u svim gustinama |

Placeholder materijal se regeneriše skriptom (bez native zavisnosti):

```bash
node apps/mobile/scripts/generate-play-assets.mjs
```

**Prije objave:** dizajner potvrđuje boje/wordmark i zamjenjuje fajlove; skripta ostaje kao
način da se ikone ponovo izgenerišu iz istih parametara.

## 4. Data Safety (odgovori za Play formu)

Popunjava se tačno prema stvarnom ponašanju aplikacije. Sažetak:

| Kategorija | Prikupljeno | Dijeljeno | Svrha | Napomena |
|---|---|---|---|---|
| Lični podaci — ime, e-mail, telefon, adresa | da | ne | funkcionalnost aplikacije, nalog, fakture | unosi ih korisnik (vlasnik firme) |
| Finansijski podaci — fakture, naplata | da | ne | funkcionalnost | poslovna evidencija; čuva se po zakonu |
| Podaci o uređaju — push token, model/verzija | da | ne | notifikacije, dijagnostika | bez reklamnog korištenja |
| Dijagnostika — crash logovi | da (kad Sentry uključen) | ne | stabilnost | bez PII u tagovima |
| Lokacija | ne | — | — | aplikacija ne traži lokaciju |
| Kontakti | ne | — | — | telefoni kupaca se unose ručno |
| Fotografije/kamera | ne | — | — | logo firme je upload, ne kamera |

- **Šifrovanje u tranzitu:** da (TLS).
- **Brisanje podataka:** korisnik može zatražiti brisanje naloga u aplikaciji/webu;
  lični podaci se anonimizuju, fiskalni dokumenti ostaju (zakonska obaveza) — to mora pisati u
  politici privatnosti.
- **Podprocesori:** hosting/baza (Neon/Vercel), R2, SMS provajder, Sentry — nisu „dijeljenje“ u
  marketinškom smislu, ali moraju biti navedeni u politici privatnosti i DPA.
- **Reklame:** ne; **praćenje:** ne.

## 5. Content rating i ostalo

- Upitnik: poslovna aplikacija, bez korisnički generisanog javnog sadržaja, bez kockanja/alkohola.
- Ciljna grupa: 18+ (poslovni korisnici).
- Obavezni linkovi: politika privatnosti i uslovi korištenja (objavljeni prije recenzije).
- Play App Signing: uključiti (Google čuva ključ; upload key ostaje kod tebe).

## 6. Checklist prije slanja na recenziju

- [ ] Finalni package name i ime brenda
- [ ] Release keystore generisan i sačuvan (2 kopije, sigurno)
- [x] Signing config za release u `build.gradle` (keystore.properties / env)
- [ ] `versionCode`/`versionName` postavljeni; AAB se potpisuje release ključem
- [x] Placeholder ikona/feature graphic i launcher ikone generisane
- [ ] Privacy policy i ToS objavljeni na stabilnim URL-ovima
- [ ] Data Safety popunjen tačno (gore)
- [ ] Screenshotovi (iz aplikacije, 2–8); finalna ikona/feature graphic od dizajnera
- [ ] Content rating upitnik
- [ ] Interni test na 3 uređaja (jeftin/srednji/nov) — APK/AAB
- [ ] Nema `debuggable`/test naloga u release build-u; API URL je produkcijski
- [ ] Pilot plan ako je account lični (12 testera / 14 dana)
- [ ] Podrška: e-mail i FAQ spremni

## 7. Poslije objave

- Internal → closed → production; prati crash rate i recenzije.
- Za svaku izmjenu: novi `versionCode`, changelog na Play-u, smoke na stagingu prije produkcije.
- Ne mijenjati Data Safety deklaraciju bez provjere da aplikacija i dalje odgovara.