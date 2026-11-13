# Analitika — odluka i minimalni događaji (S11-7)

> Verzija 1.0 · 13. 11. 2026. · Prati: `PLAN_DALJEG_RADA.md` (S11-7), `MASTER_PROMPT` §21.

## 1. Odluka (prije implementacije)

**Za MVP: nema PostHog-a ni nove tabele.** Događaji idu kao **strukturisan log red**
(`ANALYTICS {...}`) preko `AnalyticsService`, a poslovni brojevi se rade iz baze
skriptom `apps/api/scripts/platform-metrics.mjs`.

Zašto:

- nema nove infrastrukture ni kredencijala prije pilota;
- nema PII — allowlist svojstava je `companyId`, `invoiceId`, `channel`;
- logovi već idu u Sentry/hosting, pa se događaji mogu pretraživati bez novog SDK-a;
- audit trag ostaje izvor istine za pravne stvari (`audit_log`), a analitika je izvedena.

**Kada preći na PostHog:** ako pilot traži funnel/retention po koracima i A/B testove —
tada dodati PostHog (EU region) i poslati iste događaje tamo; imena događaja ostaju ista.

## 2. Događaji

| Događaj | Kada | Svojstva | Gdje se emituje |
|---|---|---|---|
| `registration` | poslije uspješne registracije firme | `companyId` | `auth.service.ts` (`register`) |
| `invoice_issued` | poslije uspješne fiskalizacije/izdavanja | `companyId`, `invoiceId` | `invoices.service.ts` (`issue`) |
| `payment_recorded` | poslije upisa naplate | `companyId`, `invoiceId` | `payments.service.ts` (`create`) |
| `reminder_sent` | poslije poslanog podsjetnika | `companyId`, `invoiceId`, `channel` | `reminders.service.ts` (ručni), `worker/reminder.worker.ts` (automatski) |
| `setup_completed` | *nije emitovan* — mobile setup se čuva lokalno u SQLite | — | planirano kada setup bude imao serverski signal |

**Zašto `setup_completed` nedostaje:** mobile wizard čuva napredak u lokalnoj `meta`
tabeli (`setup_progress`), pa server ne zna kada je setup završen. Do tada se „setup“
aproksimira u `metrics:platform` kao firma sa EFD ID **i** bar jednom poreskom stopom.
Ako pilot bude tražio tačan funnel, dodati `POST /company/setup-complete` (jedan flag u
`companies`) — to je mala migracija i jedan poziv iz wizarda.

## 3. Format loga

```
ANALYTICS {"event":"invoice_issued","at":"2026-11-13T12:34:56.789Z","companyId":"...","invoiceId":"..."}
```

- Prefiks `ANALYTICS` je stabilan — po njemu se filtrira u log platformi.
- Nema e-maila, telefona, imena kupca, sadržaja poruke ni iznosa.
- `AnalyticsService` ima runtime allowlist: i da se greškom pošalje PII, neće ući u log
  (pokriveno testom `analytics.service.spec.ts`).

## 4. Platform-metrike iz baze

```bash
cd apps/api
pnpm metrics:platform        # JSON na stdout
```

Vraća: registracije (ukupno, 30 dana, po mjesecu), setup proxy, fakture po statusu i
mjesecu izdavanja, naplate (broj + suma u feningu), podsjetnike (poslani/neuspjeli/zakazani).
Skripta ne vraća PII i može se pokretati na stagingu/produkciji (read-only upiti).

## 5. Ograničenja i sljedeći koraci

- Logovi se rotiraju — za dugoročne metrike koristiti `metrics:platform` (baza).
- Nema atribucije po korisniku (namjerno, bez PII); NPS i feedback idu kroz pilot upitnik.
- Ako se uvede PostHog, dodati `posthog-node` i env `POSTHOG_KEY`; `AnalyticsService`
  ostaje jedina tačka slanja (bez mijenjanja poziva u servisima).
