# Release potpisivanje — keystore i CI tajne (T13-2)

> Prati: `docs/PLAY_RELEASE.md` §2, `PLAN_DALJEG_RADA_v3.md` (G13). Cilj: potpisan AAB za Play,
> bez ikad commitanog keystore-a i bez gubitka ključa.
> Provjera konfiguracije: `pnpm release:check-signing` (ne ispisuje tajne).

## 1. Šta je šta

| Pojam | Šta je | Gdje živi |
|---|---|---|
| **Upload key** (naš keystore) | ključ kojim potpisujemo AAB prije uploada | 2 kopije van repoa + password manager |
| **App signing key** | ključ kojim Play potpisuje instalacije | Google (Play App Signing) |
| `keystore.properties` | lokalna putanja i lozinke | `apps/mobile/android/` (u `.gitignore`) |
| CI secrets | base64 keystore + 3 tajne | GitHub → Settings → Secrets |

**AAB za Play mora biti potpisan upload key-om.** Bez keystore-a Gradle potpisuje debug ključem —
takav AAB je samo dokaz pipeline-a i **ne smije na Play**.

## 2. Generisanje (jednom, lokalno, JDK 17)

```bash
keytool -genkeypair -v \
  -keystore digitalni-asistent-release.keystore \
  -alias digitalni \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=Digitalni Asistent, O=<firma>, C=BA"
```

- Lozinke: minimum 20 znakova, različite za keystore i ključ; u password manager.
- `-validity 10000` (~27 godina) — Play traži ključ koji nadživi aplikaciju.
- Alias `digitalni` je u primjerima; ako ga mijenjaš, promijeni i `DA_KEY_ALIAS`.

**Odmah poslije generisanja:**

1. Kopija 1: offline disk/USB (šifrovan).
2. Kopija 2: drugi offline medij na drugoj lokaciji.
3. Lozinke u password manager (dijeljeni sef, ne u chat).
4. `sha256sum digitalni-asistent-release.keystore` → zapisati hash u isti sef (provjera integriteta).

## 3. Lokalna upotreba

```bash
cp apps/mobile/android/keystore.properties.example apps/mobile/android/keystore.properties
# upiši apsolutnu putanju do keystore-a i lozinke; fajl je u .gitignore

pnpm release:check-signing      # provjera bez ispisivanja tajni
cd apps/mobile/android && ./gradlew bundleRelease
```

`keystore.properties` **nikad** ne ide u git; `.gitignore` pokriva `*.keystore` i `keystore.properties`.

## 4. CI (GitHub-hosted runner)

Runner nema keystore; dostavlja se kao base64. Postavi **4 secrets**:

| Secret | Vrijednost |
|---|---|
| `DA_KEYSTORE_BASE64` | base64 sadržaj `.keystore` fajla |
| `DA_KEYSTORE_PASSWORD` | store lozinka |
| `DA_KEY_ALIAS` | npr. `digitalni` |
| `DA_KEY_PASSWORD` | lozinka ključa |

Base64:

```bash
# Linux/macOS
base64 -w0 digitalni-asistent-release.keystore

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("digitalni-asistent-release.keystore"))
```

Zalijepi **jednu liniju** u secret (bez novih redova). Workflow `android-release`:

1. dekodira `DA_KEYSTORE_BASE64` u `$RUNNER_TEMP/release.keystore`;
2. postavlja `DA_KEYSTORE_PATH` za Gradle;
3. provjerava da keystore postoji; ako ne postoji:
   - `-rc` tag → dozvoljen debug potpis uz upozorenje,
   - pravi release tag ili `allow_debug_signing=false` → **job pada**;
4. pravi AAB i uploaduje artifact `digitalni-asistent-aab`.

Pokretanje: tag `v1.0.0` (pravi release) ili Actions → *Run workflow* sa
`allow_debug_signing=false`.

## 5. Provjera prije uploada

- [ ] `pnpm release:check-signing` → „potpisivanje je kompletno“
- [ ] AAB napravljen sa `DA_KEYSTORE_BASE64` (u logu: „Release keystore je postavljen.“)
- [ ] `versionCode` veći od prethodnog; `versionName` x.y.z
- [ ] AAB instaliran na 2 uređaja kroz internal track
- [ ] Play App Signing uključen; upload key registrovan

## 6. Gubitak i rotacija

- **Izgubljen upload key:** zatraži reset upload key-a u Play Console (Google zadržava app signing key);
  novi keystore → novi secrets → novi AAB.
- **Izgubljen app signing key:** ne postoji recovery; zato je Play App Signing obavezan i uključen
  prije prve objave.
- **Sumnja na curenje:** novi upload key, rotacija secrets, provjeri Play release listu.
- Ne mijenjati `applicationId` poslije prve objave — to je nova aplikacija.

## 7. Šta ne raditi

- Ne commitovati keystore, `keystore.properties` ni base64 u repo/CI log.
- Ne slati keystore e-mailom/chatom; samo kroz password manager ili offline medij.
- Ne koristiti debug keystore za Play (Google ga odbija; iako prolazi lokalno).
- Ne skraćivati lozinke „da bi CI lakše radio“ — koristi secrets.
