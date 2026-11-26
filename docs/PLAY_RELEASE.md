# Play objava — priprema i checklist

> Verzija 1.1 · 23. 11. 2026. · Prati: `PLAN_DALJEG_RADA_v3.md` (Sprint 12B/13A), `MASTER_PROMPT` §13,
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

**Stanje 2026-11-23:** signing config je u `apps/mobile/android/app/build.gradle`
(`signingConfigs.release`), **CI job `android-release`** pravi AAB (`bundleRelease`) i uploaduje
artifact `digitalni-asistent-aab`. Verzija je **1.0.0 (1)**. Bez keystore-a AAB se potpisuje
**debug** ključem — to je samo dokaz da pipeline radi i **ne šalje se na Play**; sa keystore-om ide
potpisan release AAB. **Kompletno uputstvo (generisanje, base64, backup, rotacija):**
[`KEYSTORE.md`](KEYSTORE.md).

```bash
# 1) jednom, lokalno (JDK 17); keystore NIKAD u repo
keytool -genkeypair -v -keystore digitalni-asistent-release.keystore \
  -alias digitalni -keyalg RSA -keysize 4096 -validity 10000

# 2) kopirati keystore.properties.example u keystore.properties i upisati putanju/lozinke
#    (ili postaviti DA_KEYSTORE_BASE64 + 3 tajne u GitHub Secrets)

# 3) build release AAB (lokalno ili kroz CI, vidi dolje)
cd apps/mobile/android
./gradlew bundleRelease
# izlaz: app/build/outputs/bundle/release/app-release.aab
```

**CI (preporučeno):** dodaj secrets `DA_KEYSTORE_BASE64`, `DA_KEYSTORE_PASSWORD`, `DA_KEY_ALIAS`,
`DA_KEY_PASSWORD`; `android-release` dekodira keystore u `$RUNNER_TEMP` i potpisuje AAB.
Job se pokreće ručno (Actions → *Run workflow*, `allow_debug_signing=false`) ili na tag `v*`.
`-rc` tag bez keystore-a je dozvoljen uz debug potpis (za provjeru pipeline-a), pravi release tag nije.

- Signing config čita `android/keystore.properties` (lokalno) ili env `DA_KEYSTORE_PATH` +
  `DA_KEYSTORE_PASSWORD`/`DA_KEY_ALIAS`/`DA_KEY_PASSWORD` (CI; `DA_KEYSTORE_PATH` postavlja
  workflow iz `DA_KEYSTORE_BASE64`). Bez keystore-a release build ostaje na debug potpisu —
  **AAB za Play se tako ne šalje**.
- `keystore.properties` i `*.keystore` su u `.gitignore` (osim RN `debug.keystore`).
- `versionCode`/`versionName` u `android/app/build.gradle` — povećavati za svaku objavu
  (trenutno **1 / "1.0.0"**; prvi Play build ostaje `1`).
- Debug APK (`assembleDebug`) ostaje za interni test; release AAB ide u Play.
- CI: `android` job pravi debug APK na svaki push; `android-release` pravi AAB ručno/tag.

## 3. Store listing (tekst draft)

- **Naziv (≤ 30):** Digitalni Asistent
- **Kratki opis (≤ 80):** Fakture, predračuni i naplata za majstore i mikro-firme — brzo i offline.
- **Puni opis (≤ 4000):** vidi dolje.
- **Kategorija:** Business
- **Kontakt e-mail:** podrška@<domen>
- **Engleska varijanta listinga:** [`PLAY_LISTING.en.md`](PLAY_LISTING.en.md) (opciona, druga jezička verzija)

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

| Element | Zahtjev | Stanje 2026-11-23 |
|---|---|---|
| Ikona | 512×512 PNG (32-bit, providnost dozvoljena) | ✅ placeholder: `apps/mobile/assets/branding/play-icon-512.png` |
| Feature graphic | 1024×500 JPEG ili 24-bit PNG (bez providnosti) | ✅ placeholder: `apps/mobile/assets/branding/play-feature-graphic-1024x500.png` |
| Screenshotovi | 4–8 telefonskih, 320–3840 px, odnos ≤ 2:1, bez providnosti | ✅ **5 snimaka** u `apps/mobile/assets/screenshots/` (1080×2160) |
| Tabela/tablet | opciono | — |
| Launcher ikone | `mipmap-*` sve gustine | ✅ placeholder generisan u svim gustinama |

Snimci (redom kojim idu u listing): `01-prijava.png`, `02-fakture.png`, `03-faktura-detalj.png`,
`04-faktura-naplata.png`, `05-nalog.png`. Snimljeni su na emulatoru (Android 17 / API 37) sa demo
podacima; originali su 1080×2400 pa su odsječeni na 2:1 (Play dozvoljava do 2:1, preporuka je 9:16).

**Regenerisanje u 9:16 (poslije finalnog brenda):**

```bash
adb shell wm size 1080x1920        # 9:16, Play preporuka
# proći kroz ekrane i sačuvati: adb exec-out screencap -p > 01-prijava.png
pnpm check:play                    # provjera dimenzija/odnosa/providnosti
```

Provjera materijala je u CI-ju (`node tools/check-play-assets.mjs`) i pada ako nedostaje snimak,
ako je odnos > 2:1 ili ako PNG ima providnost.

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
- [x] CI job `android-release` pravi AAB (`bundleRelease`, artifact `digitalni-asistent-aab`)
- [x] `versionCode`/`versionName` postavljeni (**1 / "1.0.0"**)
- [ ] AAB potpisan **release** ključem (čeka keystore; bez njega CI potpisuje debug ključem)
- [x] Placeholder ikona/feature graphic i launcher ikone generisane (feature graphic 24-bit)
- [x] Screenshotovi (5 snimaka, 1080×2160) i provjera `pnpm check:play` u CI-ju
- [ ] Finalna ikona/feature graphic od dizajnera (zamijeniti placeholdere)
- [x] Stranice `/privacy` i `/terms` implementirane u webu (javne, bez prijave)
- [ ] Privacy policy i ToS **objavljeni na stabilnim URL-ovima** (čeka domen + pravnika)
- [ ] Data Safety popunjen tačno (gore)
- [ ] Content rating upitnik
- [ ] Interni test na 3 uređaja (jeftin/srednji/nov) — APK/AAB (matrica: `docs/G12_EVIDENCE_PACK.md` §4)
- [x] API URL se postavlja pri build-u (`DA_API_URL` → `src/app-config.json`); release odbija razvojni URL
- [ ] Produkcijski API URL postavljen u repository variable prije release taga
- [ ] Pilot plan ako je account lični (12 testera / 14 dana)
- [ ] Podrška: e-mail i FAQ spremni

## 7. Poslije objave

- Internal → closed → production; prati crash rate i recenzije.
- Za svaku izmjenu: novi `versionCode`, changelog na Play-u, smoke na stagingu prije produkcije.
- Ne mijenjati Data Safety deklaraciju bez provjere da aplikacija i dalje odgovara.