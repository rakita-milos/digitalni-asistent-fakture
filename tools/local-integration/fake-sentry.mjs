// Minimalni Sentry kolektor za lokalnu provjeru web instrumentacije (T12-4).
// Prima envelope POST i upisuje event (tagovi, izuzetak, release) u log.
import http from 'node:http';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT ?? 9012);
const LOG = process.env.LOG ?? fileURLToPath(new URL('./fake-sentry.log', import.meta.url));
const RAW_LOG = process.env.RAW_LOG ?? fileURLToPath(new URL('./fake-sentry-raw.log', import.meta.url));

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    appendFileSync(RAW_LOG, body + '\n---\n');
    const lines = body.split('\n');
    // Envelope: [header, item header, payload, ...] — event payload je JSON sa `platform`/`exception`.
    let parsed = null;
    for (const line of lines) {
      try {
        const candidate = JSON.parse(line);
        if (
          candidate &&
          typeof candidate === 'object' &&
          !Array.isArray(candidate) &&
          (candidate.exception || candidate.platform || candidate.message !== undefined)
        ) {
          parsed = candidate;
          break;
        }
      } catch {
        // nije JSON linija
      }
    }
    const record = {
      at: new Date().toISOString(),
      method: req.method,
      url: req.url,
      auth: req.headers['x-sentry-auth'] ?? null,
      eventId: parsed?.event_id ?? null,
      tags: parsed?.tags ?? null,
      exception: parsed?.exception?.values?.[0]?.value ?? null,
      release: parsed?.release ?? null,
    };
    appendFileSync(LOG, JSON.stringify(record) + '\n');
    console.log('envelope', record.url, record.exception ?? '');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"id":"verify"}');
  });
});

server.listen(PORT, '127.0.0.1', () => console.log(`fake-sentry listening port=${PORT}`));
