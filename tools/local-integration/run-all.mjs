// Pokreće fake S3/SMS/Sentry + API sa test env-om i izvršava obje integracione provjere.
// Preduslov: `pnpm --filter api build`, `pnpm --filter web build`, migracije i `db:seed`.
// Koristi se lokalno (`pnpm test:integrations`) i u CI-ju.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));
const apiDir = fileURLToPath(new URL('../../apps/api', import.meta.url));
const toolsDir = fileURLToPath(new URL('.', import.meta.url));
const children = [];

function start(name, args, cwd, env = {}) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) console.error(`[${name}] izašao sa kodom ${code} (${signal ?? '-'})`);
  });
  children.push({ name, child });
  return child;
}

async function waitForHealth(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // API još ne sluša
    }
    await sleep(500);
  }
  return false;
}

function runToCompletion(name, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.on('exit', (code) => {
      console.log(`[${name}] exit=${code}`);
      resolve(code ?? 1);
    });
  });
}

async function shutdown() {
  for (const { child } of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  await sleep(500);
}

let exitCode = 1;
try {
  start('fake-s3', [fileURLToPath(new URL('./fake-s3.mjs', import.meta.url))], toolsDir);
  start('fake-sms', [fileURLToPath(new URL('./fake-sms.mjs', import.meta.url))], toolsDir);
  start('fake-sentry', [fileURLToPath(new URL('./fake-sentry.mjs', import.meta.url))], toolsDir);

  start('api', ['dist/main.js'], apiDir, {
    API_PORT: '3001',
    R2_ENDPOINT: 'http://127.0.0.1:9010',
    R2_ACCESS_KEY_ID: 'fake-access',
    R2_SECRET_ACCESS_KEY: 'fake-secret',
    R2_BUCKET: 'digitalni-asistent',
    R2_SIGNED_URL_TTL_SECONDS: '900',
    SMS_PROVIDER: 'http',
    SMS_HTTP_URL: 'http://127.0.0.1:9011/send',
    SMS_HTTP_TOKEN: 'test-token',
    SMS_SENDER_ID: 'DA',
  });

  const healthy = await waitForHealth('http://127.0.0.1:3001/health', 60_000);
  if (!healthy) {
    console.error('API nije postao healthy u 60 s.');
  } else {
    const integrations = await runToCompletion('verify-integrations', [
      fileURLToPath(new URL('./verify-integrations.mjs', import.meta.url)),
    ], toolsDir);
    const sentry = await runToCompletion('verify-sentry', [
      fileURLToPath(new URL('./verify-sentry.mjs', import.meta.url)),
    ], rootDir);
    exitCode = integrations === 0 && sentry === 0 ? 0 : 1;
  }
} catch (error) {
  console.error(error);
} finally {
  await shutdown();
  process.exit(exitCode);
}
