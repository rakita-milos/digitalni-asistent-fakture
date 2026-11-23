#!/usr/bin/env node
/**
 * Staging smoke test (S12B-3).
 *
 * Prolazi kroz kritični tok na **stagingu**: health → prijava → kupci → fakture → PDF →
 * draft → izdavanje (mock fiskalizacija) → PFR. Zamjenjuje ručno klikanje i daje dokaz za
 * T12-7 / T13-6 (G12: „staging smoke“).
 *
 * Pokretanje:
 *   STAGING_API_URL=https://api.staging.example \
 *   SMOKE_EMAIL=smoke@example.ba SMOKE_PASSWORD='…' \
 *   node tools/staging-smoke.mjs
 *
 * Opcije:
 *   --json            mašinski čitljiv izlaz (za CI)
 *   --base-url=URL    umjesto STAGING_API_URL
 *   --no-create       preskoči kreiranje/izdavanje fakture (samo čitanje + PDF)
 *   --help
 *
 * Skripta ne ispisuje e-mail, lozinku ni tokene. Kreira jednu DRAFT pa ISSUED fakturu sa
 * napomenom „SMOKE TEST“ na demo firmi — to je namjerno i vidljivo u staging podacima.
 */

const HELP = `staging-smoke — provjera staging tokova

Obavezno:
  STAGING_API_URL   npr. https://api.staging.digitalni-asistent.ba
  SMOKE_EMAIL       nalog demo firme na stagingu
  SMOKE_PASSWORD    lozinka tog naloga

Opciono:
  SMOKE_TIMEOUT_MS  timeout po zahtjevu (default 15000)

Primjer:
  STAGING_API_URL=http://127.0.0.1:3001 SMOKE_EMAIL=demo@digitalni-asistent.ba \\
  SMOKE_PASSWORD=DemoLozinka123 node tools/staging-smoke.mjs
`;

const args = new Set(process.argv.slice(2));
if (args.has('--help') || args.has('-h')) {
  process.stdout.write(HELP);
  process.exit(0);
}

const jsonOutput = args.has('--json');
const createInvoice = !args.has('--no-create');

const baseUrlArg = process.argv
  .slice(2)
  .find((arg) => arg.startsWith('--base-url='))
  ?.split('=')[1];

const baseUrl = (baseUrlArg || process.env.STAGING_API_URL || 'http://127.0.0.1:3001').replace(
  /\/+$/,
  '',
);
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 15_000);

if (!email || !password) {
  process.stderr.write(
    'Nedostaje SMOKE_EMAIL ili SMOKE_PASSWORD (vidi --help).\n',
  );
  process.exit(2);
}

if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120_000) {
  process.stderr.write('SMOKE_TIMEOUT_MS mora biti između 1000 i 120000.\n');
  process.exit(2);
}

/** @type {{ name: string, ok: boolean, ms: number, detail: string }[]} */
const steps = [];
let accessToken = '';
let invoiceNumber = null;

function mask(value) {
  if (!value) return '—';
  return `${String(value).slice(0, 4)}…`;
}

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = {
    accept: 'application/json',
    ...(options.body ? { 'content-type': 'application/json' } : {}),
    ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    ...(options.headers ?? {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
    redirect: options.redirect ?? 'follow',
  });

  return response;
}

async function jsonBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Odgovor nije JSON (${response.status}): ${text.slice(0, 120)}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function step(name, fn) {
  const startedAt = performance.now();
  try {
    const detail = await fn();
    steps.push({ name, ok: true, ms: Math.round(performance.now() - startedAt), detail });
  } catch (error) {
    steps.push({
      name,
      ok: false,
      ms: Math.round(performance.now() - startedAt),
      detail: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/** Lista može biti `{ items, total }` ili goli niz — podržavamo oba oblika. */
function listItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.items)) return payload.items;
  return [];
}

async function main() {
  process.stdout.write(`Staging smoke: ${baseUrl}\n`);

  await step('health (baza + Redis)', async () => {
    const response = await request('/health');
    const body = await jsonBody(response);
    assert(response.status === 200, `HTTP ${response.status}`);
    assert(body?.status === 'ok', `status=${body?.status}`);
    assert(body?.checks?.database === 'ok', 'baza nije ok');
    assert(body?.checks?.redis === 'ok', 'Redis nije ok');
    return 'database=ok, redis=ok';
  });

  await step('prijava demo naloga', async () => {
    const response = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: email,
        password,
        device: { platform: 'web', appVersion: 'staging-smoke' },
      }),
    });
    const body = await jsonBody(response);
    assert(response.status === 200, `HTTP ${response.status}`);
    assert(typeof body?.accessToken === 'string' && body.accessToken.length > 20, 'nema accessToken');
    accessToken = body.accessToken;
    return `nalog ${mask(email)}`;
  });

  let customerId = null;

  await step('kupci (bar jedan)', async () => {
    const response = await request('/customers?limit=1');
    const body = await jsonBody(response);
    assert(response.status === 200, `HTTP ${response.status}`);
    const items = listItems(body);
    assert(items.length > 0, 'demo firma nema kupce — seed nije učitan?');
    customerId = items[0].id;
    assert(typeof customerId === 'string', 'kupac nema id');
    return `nađen ${items.length} kupac`;
  });

  let existingInvoiceId = null;

  await step('lista faktura (bar jedna)', async () => {
    const response = await request('/invoices?limit=1');
    const body = await jsonBody(response);
    assert(response.status === 200, `HTTP ${response.status}`);
    const items = listItems(body);
    assert(items.length > 0, 'nema faktura — seed nije učitan?');
    existingInvoiceId = items[0].id;
    return `ukupno ${body?.total ?? items.length}`;
  });

  if (existingInvoiceId) {
    await step('detalj fakture', async () => {
      const response = await request(`/invoices/${existingInvoiceId}`);
      const body = await jsonBody(response);
      assert(response.status === 200, `HTTP ${response.status}`);
      assert(body?.id === existingInvoiceId, 'id se ne poklapa');
      assert(typeof body?.number === 'string', 'nema broj fakture');
      return `broj ${body.number}, status ${body.status}`;
    });

    await step('PDF (signed URL ili stream)', async () => {
      const response = await request(`/invoices/${existingInvoiceId}/pdf`, {
        redirect: 'manual',
      });

      if (response.status === 302) {
        const location = response.headers.get('location');
        assert(location, '302 bez Location zaglavlja');
        const signed = new URL(location);
        const expires = Number(signed.searchParams.get('X-Amz-Expires') ?? 0);
        assert(expires > 0 && expires <= 900, `X-Amz-Expires=${expires} (očekivano ≤ 900)`);

        const file = await fetch(location, { signal: AbortSignal.timeout(timeoutMs) });
        assert(file.status === 200, `signed URL vratio ${file.status}`);
        const bytes = Buffer.from(await file.arrayBuffer());
        assert(bytes.subarray(0, 4).toString() === '%PDF', 'signed URL ne vraća PDF');
        return `302 → R2, X-Amz-Expires=${expires}, ${bytes.length} B`;
      }

      assert(response.status === 200, `HTTP ${response.status}`);
      assert(
        (response.headers.get('content-type') ?? '').includes('application/pdf'),
        'content-type nije PDF',
      );
      const bytes = Buffer.from(await response.arrayBuffer());
      assert(bytes.subarray(0, 4).toString() === '%PDF', 'tijelo nije PDF');
      return `stream, ${bytes.length} B`;
    });
  }

  if (createInvoice) {
    let createdId = null;

    await step('kreiranje drafta', async () => {
      const issueDate = new Date();
      const dueDate = new Date(issueDate.getTime() + 15 * 24 * 60 * 60 * 1000);

      const response = await request('/invoices', {
        method: 'POST',
        headers: { 'idempotency-key': `staging-smoke-${Date.now()}` },
        body: JSON.stringify({
          customerId,
          type: 'SALE',
          issueDate: issueDate.toISOString(),
          dueDate: dueDate.toISOString(),
          note: 'SMOKE TEST — automatska provjera staginga (tools/staging-smoke.mjs)',
          lines: [
            {
              description: 'SMOKE TEST stavka',
              qtyMilli: 1000,
              unitPriceFening: 10000,
              discountBp: 0,
              taxRateBp: 1700,
            },
          ],
        }),
      });
      const body = await jsonBody(response);
      assert(response.status === 201 || response.status === 200, `HTTP ${response.status}`);
      assert(typeof body?.id === 'string', 'nema id drafta');
      assert(body?.status === 'DRAFT', `status=${body?.status} (očekivan DRAFT)`);
      createdId = body.id;
      return `draft ${body.number}`;
    });

    await step('izdavanje (mock fiskalizacija) + PFR', async () => {
      const response = await request(`/invoices/${createdId}/issue`, { method: 'POST' });
      const body = await jsonBody(response);
      assert(response.status === 200 || response.status === 201, `HTTP ${response.status}`);
      assert(body?.status === 'ISSUED', `status=${body?.status} (očekivan ISSUED)`);
      assert(typeof body?.fiscalPfr === 'string' && body.fiscalPfr.length > 0, 'nema PFR');
      assert(typeof body?.number === 'string' && !body.number.startsWith('DRAFT'), 'broj nije dodijeljen');
      invoiceNumber = body.number;
      return `broj ${body.number}, PFR ${mask(body.fiscalPfr)}`;
    });
  }

  const totalMs = steps.reduce((sum, item) => sum + item.ms, 0);
  const result = {
    ok: steps.every((item) => item.ok),
    baseUrl,
    totalMs,
    invoiceNumber,
    steps,
  };

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    for (const item of steps) {
      process.stdout.write(`${item.ok ? '✓' : '✗'} ${item.name} (${item.ms} ms) — ${item.detail}\n`);
    }
    process.stdout.write(`\nUkupno: ${steps.length} provjera, ${totalMs} ms\n`);
  }

  if (!result.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  if (!jsonOutput) {
    process.stderr.write(`\nSMOKE PAO: ${error instanceof Error ? error.message : String(error)}\n`);
    if (invoiceNumber) {
      process.stderr.write(`Zadnja izdata faktura: ${invoiceNumber}\n`);
    }
  } else {
    process.stdout.write(
      `${JSON.stringify({ ok: false, baseUrl, steps, error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`,
    );
  }
  process.exit(1);
});
