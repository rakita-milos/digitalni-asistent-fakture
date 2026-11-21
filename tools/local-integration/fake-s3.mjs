// Minimalni S3-kompatibilni server za lokalnu provjeru R2 toka (T12-5).
// Podržava HEAD/PUT/GET na /{bucket}/{key}; presigned GET se samo servira (potpis se ne provjerava).
import http from 'node:http';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT ?? 9010);
const LOG = process.env.LOG ?? fileURLToPath(new URL('./fake-s3.log', import.meta.url));
const objects = new Map();

function log(...parts) {
  const line = `${new Date().toISOString()} ${parts.join(' ')}`;
  console.log(line);
  appendFileSync(LOG, line + '\n');
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const key = url.pathname;
  log(req.method ?? '?', req.url ?? '/', `has_query=${url.search.length > 0}`);

  if (req.method === 'HEAD') {
    const body = objects.get(key);
    if (body) {
      res.writeHead(200, { 'content-length': String(body.length), 'content-type': 'application/pdf' });
    } else {
      res.writeHead(404);
    }
    res.end();
    return;
  }

  if (req.method === 'PUT') {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      objects.set(key, body);
      log('stored', key, `bytes=${body.length}`, `pdf=${body.subarray(0, 4).toString('latin1') === '%PDF'}`);
      res.writeHead(200, { etag: '"fake-etag"', 'content-length': '0' });
      res.end();
    });
    return;
  }

  if (req.method === 'GET') {
    const body = objects.get(key);
    if (!body) {
      res.writeHead(404, { 'content-type': 'application/xml' });
      res.end('<Error><Code>NoSuchKey</Code></Error>');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/pdf', 'content-length': String(body.length) });
    res.end(body);
    return;
  }

  res.writeHead(405);
  res.end();
});

server.listen(PORT, '127.0.0.1', () => log('fake-s3 listening', `port=${PORT}`));
