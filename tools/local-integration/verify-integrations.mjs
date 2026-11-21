// End-to-end provjera lokalnih integracija (T12-5 R2 signed URL, T12-6 SMS http).
// Preduslov: API na :3001 sa R2/SMS env varijablama i pokrenuti fake-s3/fake-sms.
// Primjer pokretanja: node tools/local-integration/verify-integrations.mjs
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const API = process.env.API_URL ?? 'http://127.0.0.1:3001';
const S3_LOG = process.env.S3_LOG ?? fileURLToPath(new URL('./fake-s3.log', import.meta.url));
const SMS_LOG = process.env.SMS_LOG ?? fileURLToPath(new URL('./fake-sms.log', import.meta.url));

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req(path, init = {}) {
  const response = await fetch(API + path, init);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, headers: response.headers, body };
}

function readLog(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
}

const health = await req('/health');
check('API /health', health.status === 200 && health.body?.checks?.database === 'ok', `status=${health.status}`);

const login = await req('/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    identifier: 'demo@digitalni-asistent.ba',
    password: 'DemoLozinka123',
    device: { name: 'integration-verify', platform: 'web' },
  }),
});
check('Prijava demo nalogom', login.status === 200 || login.status === 201, `status=${login.status}`);
const token = login.body?.accessToken;
if (!token) {
  console.log('Nema access tokena — prekidam.');
  process.exit(1);
}
const auth = { authorization: `Bearer ${token}` };

const list = await req('/invoices?limit=50', { headers: auth });
const invoices = Array.isArray(list.body) ? list.body : (list.body?.items ?? []);
check('Lista faktura', list.status === 200 && invoices.length > 0, `status=${list.status}, count=${invoices.length}`);

const issued = invoices.find((invoice) => invoice.status === 'ISSUED' && invoice.type === 'SALE');
check('Postoji izdata SALE faktura', Boolean(issued), issued ? `number=${issued.number}` : 'nema');
if (!issued) process.exit(1);

const pdf = await req(`/invoices/${issued.id}/pdf`, { headers: auth, redirect: 'manual' });
const location = pdf.headers.get('location') ?? '';
check('PDF vraća 302 na R2', pdf.status === 302 && location.length > 0, `status=${pdf.status}`);
check(
  'Signed URL ima potpis i TTL 900',
  /X-Amz-Signature=/i.test(location) && /X-Amz-Expires=900/i.test(location),
  location ? new URL(location).pathname + '…' : 'nema Location',
);
check('Signed URL ide na lokalni S3', location.startsWith('http://127.0.0.1:9010/'), location.split('?')[0]);

if (location) {
  const object = await fetch(location);
  const bytes = Buffer.from(await object.arrayBuffer());
  check(
    'Signed URL servira PDF',
    object.status === 200 && bytes.subarray(0, 4).toString('latin1') === '%PDF',
    `status=${object.status}, bytes=${bytes.length}`,
  );
}

// Ponovni poziv: objekat već postoji (HEAD), ne smije biti novog uploada — samo provjeravamo 302.
const pdfAgain = await req(`/invoices/${issued.id}/pdf`, { headers: auth, redirect: 'manual' });
check('Drugi poziv PDF-a i dalje 302 (ensureObject/HEAD)', pdfAgain.status === 302);

const otp = await req('/auth/otp/request', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ phone: '+38766111222' }),
});
check('OTP request prihvaćen', otp.status === 200 || otp.status === 201, `status=${otp.status}`);

await new Promise((resolve) => setTimeout(resolve, 500));
const otpRecord = readLog(SMS_LOG).at(-1);
let otpBody = {};
try {
  otpBody = JSON.parse(otpRecord?.body ?? '{}');
} catch {
  otpBody = {};
}
check('SMS http adapter poslao OTP', Boolean(otpRecord) && otpBody.to === '+38766111222', `to=${otpBody.to}`);
check(
  'Sender ID i Bearer token stižu do provajdera',
  otpBody.sender === 'DA' && otpRecord?.authorization === 'Bearer test-token',
  `sender=${otpBody.sender}, auth=${otpRecord?.authorization}`,
);
check(
  'OTP poruka sadrži 6-cifreni kod',
  /\b\d{6}\b/.test(String(otpBody.message ?? '')),
  `message=${String(otpBody.message ?? '').slice(0, 60)}`,
);

const debtors = invoices.filter(
  (invoice) =>
    invoice.status === 'ISSUED' &&
    invoice.type === 'SALE' &&
    Number(invoice.totalFening ?? 0) > Number(invoice.paidFening ?? 0),
);

let reminderOk = false;
let reminderDetail = 'nema fakture sa otvorenim dugom';
for (const target of debtors) {
  const remind = await req(`/invoices/${target.id}/remind`, { method: 'POST', headers: auth });
  await new Promise((resolve) => setTimeout(resolve, 400));
  const record = readLog(SMS_LOG).at(-1);
  let body = {};
  try {
    body = JSON.parse(record?.body ?? '{}');
  } catch {
    body = {};
  }
  if (remind.status < 400 && String(body.message ?? '').includes(String(target.number))) {
    reminderOk = true;
    reminderDetail = `status=${remind.status}, number=${target.number}, message=${String(body.message ?? '').slice(0, 70)}`;
    break;
  }
  reminderDetail = `status=${remind.status}, number=${target.number}, body=${JSON.stringify(remind.body).slice(0, 160)}`;
}
check('Ručni podsjetnik ide preko SMS adaptera', reminderOk, reminderDetail);

const s3 = readLog(S3_LOG);
check('S3 je dobio PUT objekta', s3.some((entry) => String(entry.raw ?? '').includes('stored')), `zapisa=${s3.length}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} provjera prošlo.`);
process.exit(failed.length === 0 ? 0 : 1);
