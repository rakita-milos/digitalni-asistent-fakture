// Provjera da kompajlirana web instrumentacija zaista šalje grešku u Sentry (T12-4).
// Koristi `.next/server/instrumentation.js` iz produkcijskog builda i lokalni kolektor (fake-sentry.mjs).
// Preduslov: `pnpm --filter web build` i pokrenut fake-sentry na :9012.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

process.env.NEXT_RUNTIME = 'nodejs';
process.env.SENTRY_DSN = 'http://publickey@127.0.0.1:9012/1';
process.env.APP_RELEASE = 'verify-local';
process.env.SENTRY_ENVIRONMENT = 'verification';

const LOG = process.env.SENTRY_LOG ?? fileURLToPath(new URL('./fake-sentry.log', import.meta.url));
const instrumentationPath = new URL('../../apps/web/.next/server/instrumentation.js', import.meta.url);

if (!existsSync(instrumentationPath)) {
  console.log('FAIL  nema builda (.next/server/instrumentation.js) — pokreni `pnpm --filter web build`');
  process.exit(1);
}

const module = await import(instrumentationPath.href);
const instrumentation = module.default ?? module;

await instrumentation.register();
await instrumentation.onRequestError(
  new Error('verify-boom'),
  { path: '/verify', method: 'POST', headers: { 'x-request-id': 'req-verify-1' } },
  { routerKind: 'App Router', routePath: '/verify', routeType: 'action' },
);

let event = null;
for (let attempt = 0; attempt < 20 && !event; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (!existsSync(LOG)) continue;
  const entries = readFileSync(LOG, 'utf8').split('\n').filter(Boolean);
  for (const line of entries) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.exception === 'verify-boom') event = parsed;
    } catch {
      // preskoči
    }
  }
}

const checks = [
  ['Event stigao u kolektor', Boolean(event), event ? `event_id=${event.eventId}` : 'nema eventa'],
  ['Request-id tag', event?.tags?.request_id === 'req-verify-1', `request_id=${event?.tags?.request_id}`],
  ['Ruta u tagovima', event?.tags?.http_path === '/verify' && event?.tags?.route === '/verify', `path=${event?.tags?.http_path}`],
  ['Release se šalje', event?.release === 'verify-local', `release=${event?.release}`],
];

let failed = 0;
for (const [name, ok, detail] of checks) {
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
}

console.log(`\n${checks.length - failed}/${checks.length} provjera prošlo.`);
process.exit(failed === 0 ? 0 : 1);
