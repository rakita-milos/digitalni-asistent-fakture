// Minimalni SMS provajder za lokalnu provjeru `SMS_PROVIDER=http` adaptera (T12-6).
// Prima JSON POST i upisuje tijelo + Authorization header u log (bez mreže).
import http from 'node:http';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT ?? 9011);
const LOG = process.env.LOG ?? fileURLToPath(new URL('./fake-sms.log', import.meta.url));

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    const record = {
      at: new Date().toISOString(),
      method: req.method,
      url: req.url,
      authorization: req.headers.authorization ?? null,
      contentType: req.headers['content-type'] ?? null,
      body,
    };
    appendFileSync(LOG, JSON.stringify(record) + '\n');
    console.log('sms', record.method, record.url, `auth=${record.authorization ?? 'none'}`);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });
});

server.listen(PORT, '127.0.0.1', () => console.log(`fake-sms listening port=${PORT}`));
