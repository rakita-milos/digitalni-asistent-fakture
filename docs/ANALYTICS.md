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
| `setup_completed` | poslije `POST /company/setup-complete` (idempotentno) | `companyId` | `company.service.ts` (`markSetupComplete`) |

**Server-side signal:** mobile wizard i dalje čuva napredak lokalno (`setup_progress`), ali pri
završetku zove `POST /company/setup-complete` (best-effort; offline ne blokira završetak).
Ruta upisuje `companies.setup_completed_at` (migracija
`20261113170000_company_setup_completed_at`), idempotentna je i emituje `setup_completed`
samo prvi put. `metrics:platform` i dalje daje proxy (EFD + poreska stopa) za starije naloge
koji su setup završili prije ove migracije.

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

Vraća: **korisnike** (ukupno), **firme** (ukupno, posljednjih 30 dana, po mjesecu — registracija =
nova firma jer `users` nema `created_at`), setup proxy, fakture po statusu i mjesecu izdavanja,
naplate (broj + suma u feningu), podsjetnike (poslani/neuspjeli/zakazani).
Skripta ne vraća PII i može se pokretati na stagingu/produkciji (read-only upiti).

> Popravljeno 23. 11. 2026. (G14): skripta je padala na `Unknown argument createdAt` jer je
> brojala korisnike po nepostojećem `users.created_at`; sada „registracije“ mjeri po
> `companies.created_at`. Bez toga sedmični izvještaj pilota nije mogao raditi.

## 5. Ograničenja i sljedeći koraci

- Logovi se rotiraju — za dugoročne metrike koristiti `metrics:platform` (baza).
- Nema atribucije po korisniku (namjerno, bez PII); NPS i feedback idu kroz pilot upitnik.
- `setup_completed` je best-effort: ako je telefon offline u trenutku završetka setup-a, signal se
  ne šalje (lokalni setup i dalje važi); proxy u `metrics:platform` ostaje rezerva.
- Ako se uvede PostHog, dodati `posthog-node` i env `POSTHOG_KEY`; `AnalyticsService`
  ostaje jedina tačka slanja (bez mijenjanja poziva u servisima).