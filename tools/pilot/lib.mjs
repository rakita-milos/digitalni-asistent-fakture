/**
 * Zajednička logika za pilotske alate (G14).
 *
 * `status.mjs` čita tabelu učesnika (`docs/pilot/tracking.csv`, van gita zbog PII) i računa
 * kriterije kapije G14; `weekly.mjs` pravi sedmični izvještaj od platform-metrika + statusa.
 *
 * Pravilo: izlaz nikad ne sadrži ime, e-mail, telefon ni naziv firme — samo `id` učesnika i
 * agregati. Zato `tracking.csv` ostaje lokalni fajl, a u git idu samo šablon i primjer.
 */

export const TRACKING_COLUMNS = [
  'id',
  'company',
  'contact',
  'phone',
  'device',
  'invited_at',
  'onboarded_at',
  'unaided_invoice',
  'first_invoice_seconds',
  'reminder_sent',
  'feedback_at',
  'nps',
  'blocker_open',
  'notes',
];

export const G14_TARGETS = {
  cohortMin: 12,
  cohortMax: 15,
  onboardingDays: 14,
  unaidedInvoicePct: 70,
  reminderPct: 50,
  nps: 30,
  blockers: 0,
};

const TRUE_VALUES = new Set(['1', 'da', 'yes', 'true', 'y', 'd']);
const FALSE_VALUES = new Set(['0', 'ne', 'no', 'false', 'n', '']);

/** Minimalni CSV parser (zarezi, navodnici, CRLF) — dovoljan za tabelu koju puni čovjek. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

function toBool(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return null;
}

function toDate(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toNumber(value) {
  const trimmed = String(value ?? '').trim().replace(',', '.');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeRow(cells) {
  const row = Object.fromEntries(TRACKING_COLUMNS.map((column) => [column, '']));
  cells.forEach((cell, index) => {
    const column = TRACKING_COLUMNS[index];
    if (column) row[column] = String(cell ?? '').trim();
  });

  return {
    id: row.id,
    company: row.company,
    contact: row.contact,
    phone: row.phone,
    device: row.device,
    invitedAt: toDate(row.invited_at),
    onboardedAt: toDate(row.onboarded_at),
    unaidedInvoice: toBool(row.unaided_invoice),
    firstInvoiceSeconds: toNumber(row.first_invoice_seconds),
    reminderSent: toBool(row.reminder_sent),
    feedbackAt: toDate(row.feedback_at),
    nps: toNumber(row.nps),
    blockerOpen: toBool(row.blocker_open) ?? false,
    notes: row.notes,
  };
}

/**
 * @param {string} text sadržaj CSV-a (prvi red je zaglavlje)
 * @returns {{ rows: ReturnType<typeof normalizeRow>[], errors: string[] }}
 */
export function readTracking(text) {
  const table = parseCsv(text);
  const errors = [];

  if (table.length === 0) {
    return { rows: [], errors: ['Tabela je prazna.'] };
  }

  const header = table[0].map((cell) => cell.trim());
  const missing = TRACKING_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    errors.push(`Nedostaju kolone: ${missing.join(', ')}.`);
  }

  const rows = table
    .slice(1)
    .map((cells) => normalizeRow(header.map((column) => cells[header.indexOf(column)] ?? '')))
    .filter((row) => row.id.length > 0);

  return { rows, errors };
}

export function percent(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/** Bosanski format procenta: 66,7 % (bez lažne preciznosti). */
export function pct(value) {
  if (value === null || value === undefined) return '—';
  return `${String(value).replace('.', ',')} %`;
}

export function formatBam(fening) {
  const amount = Number(fening) / 100;
  return `${amount.toLocaleString('bs-BA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM`;
}

export function isoWeek(date) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc - yearStart) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Računa status pilota i kriterije G14. Denominatori su **kohorta** (svi pozvani), ne samo
 * onboardovani — tako kohorta od 12 ljudi ne može “ispasti” iz kriterija ako neko odustane.
 */
export function computeStatus(rows, { today = new Date() } = {}) {
  const cohort = rows.length;
  const onboarded = rows.filter((row) => row.onboardedAt !== null);
  const unaided = rows.filter((row) => row.unaidedInvoice === true);
  const reminders = rows.filter((row) => row.reminderSent === true);
  const feedback = rows.filter((row) => row.feedbackAt !== null);
  const blockers = rows.filter((row) => row.blockerOpen === true);

  const npsResponses = rows
    .map((row) => row.nps)
    .filter((value) => value !== null && value >= 0 && value <= 10);
  const promoters = npsResponses.filter((value) => value >= 9).length;
  const detractors = npsResponses.filter((value) => value <= 6).length;
  const passives = npsResponses.length - promoters - detractors;
  const npsScore =
    npsResponses.length > 0
      ? Math.round(percent(promoters, npsResponses.length) - percent(detractors, npsResponses.length))
      : null;

  const onboardingDates = onboarded.map((row) => row.onboardedAt.getTime());
  const firstOnboarding = onboardingDates.length > 0 ? Math.min(...onboardingDates) : null;
  const daysSinceFirstOnboarding =
    firstOnboarding === null
      ? 0
      : Math.floor((today.getTime() - firstOnboarding) / 86400000);

  const criteria = [
    {
      key: 'cohort',
      label: `Kohorta ${G14_TARGETS.cohortMin}–${G14_TARGETS.cohortMax}`,
      actual: cohort,
      target: `${G14_TARGETS.cohortMin}–${G14_TARGETS.cohortMax}`,
      met: cohort >= G14_TARGETS.cohortMin,
    },
    {
      key: 'days',
      label: `Bar ${G14_TARGETS.onboardingDays} dana pilota`,
      actual: daysSinceFirstOnboarding,
      target: `≥ ${G14_TARGETS.onboardingDays}`,
      met: daysSinceFirstOnboarding >= G14_TARGETS.onboardingDays,
    },
    {
      key: 'unaided',
      label: `Izdaje račun bez pomoći ≥ ${G14_TARGETS.unaidedInvoicePct} %`,
      actual: percent(unaided.length, cohort),
      target: `≥ ${G14_TARGETS.unaidedInvoicePct} %`,
      met: cohort > 0 && percent(unaided.length, cohort) >= G14_TARGETS.unaidedInvoicePct,
    },
    {
      key: 'reminder',
      label: `Pošalje podsjetnik ≥ ${G14_TARGETS.reminderPct} %`,
      actual: percent(reminders.length, cohort),
      target: `≥ ${G14_TARGETS.reminderPct} %`,
      met: cohort > 0 && percent(reminders.length, cohort) >= G14_TARGETS.reminderPct,
    },
    {
      key: 'nps',
      label: `NPS ≥ ${G14_TARGETS.nps}`,
      actual: npsScore,
      target: `≥ ${G14_TARGETS.nps}`,
      met: npsScore !== null && npsScore >= G14_TARGETS.nps,
    },
    {
      key: 'blockers',
      label: `Otvoreni blokatori = ${G14_TARGETS.blockers}`,
      actual: blockers.length,
      target: String(G14_TARGETS.blockers),
      met: blockers.length === G14_TARGETS.blockers,
    },
  ];

  return {
    generatedAt: today.toISOString(),
    cohort,
    onboarded: onboarded.length,
    onboardingPct: percent(onboarded.length, cohort),
    unaided: unaided.length,
    unaidedPct: percent(unaided.length, cohort),
    reminders: reminders.length,
    reminderPct: percent(reminders.length, cohort),
    feedback: feedback.length,
    feedbackPct: percent(feedback.length, cohort),
    nps: {
      score: npsScore,
      responses: npsResponses.length,
      promoters,
      passives,
      detractors,
    },
    blockers: blockers.length,
    daysSinceFirstOnboarding,
    criteria,
    passed: criteria.every((criterion) => criterion.met),
  };
}

export function formatStatus(status) {
  const mark = (met) => (met ? '✓' : '✗');
  const lines = [];

  lines.push(
    `Kohorta: ${status.cohort} (cilj ${G14_TARGETS.cohortMin}–${G14_TARGETS.cohortMax}) · ` +
      `dana pilota: ${status.daysSinceFirstOnboarding}`,
  );
  lines.push(`Onboarding: ${status.onboarded}/${status.cohort} (${pct(status.onboardingPct)})`);
  lines.push(
    `${mark(status.criteria.find((c) => c.key === 'unaided').met)} Prva faktura bez pomoći: ` +
      `${status.unaided}/${status.cohort} (${pct(status.unaidedPct)})`,
  );
  lines.push(
    `${mark(status.criteria.find((c) => c.key === 'reminder').met)} Podsjetnik poslan: ` +
      `${status.reminders}/${status.cohort} (${pct(status.reminderPct)})`,
  );
  lines.push(
    `${mark(status.criteria.find((c) => c.key === 'nps').met)} NPS: ` +
      `${status.nps.score === null ? '—' : status.nps.score} ` +
      `(${status.nps.promoters} promotera, ${status.nps.passives} pasivnih, ${status.nps.detractors} kritičara; ` +
      `${status.nps.responses} odgovora)`,
  );
  lines.push(
    `${mark(status.criteria.find((c) => c.key === 'blockers').met)} Otvoreni blokatori: ${status.blockers}`,
  );
  lines.push(`Feedback: ${status.feedback}/${status.cohort} (${pct(status.feedbackPct)})`);
  lines.push(
    `Kapija G14: ${status.passed ? 'ISPUNJENA' : 'NIJE ISPUNJENA'} ` +
      `(${status.criteria.filter((c) => c.met).length}/${status.criteria.length} kriterija)`,
  );

  return lines.join('\n');
}

export function statusMarkdown(status) {
  const table = [
    '| Kriterij | Stvarno | Cilj | Status |',
    '|---|---|---|---|',
    ...status.criteria.map((criterion) => {
      const isPercent = criterion.key === 'unaided' || criterion.key === 'reminder';
      const actual = isPercent ? pct(criterion.actual) : (criterion.actual ?? '—');
      return `| ${criterion.label} | ${actual} | ${criterion.target} | ${
        criterion.met ? '✅' : '❌'
      } |`;
    }),
  ].join('\n');

  return table;
}
