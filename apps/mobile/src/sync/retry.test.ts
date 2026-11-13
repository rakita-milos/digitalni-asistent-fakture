import {
  SYNC_BACKOFF_MS,
  SYNC_MAX_ATTEMPTS,
  isRetryDue,
  isStale,
  planRetry,
  queueAlarmMessage,
  summarizeQueue,
} from './retry';

const NOW = new Date('2026-11-13T12:00:00.000Z');

describe('planRetry', () => {
  it('poslije prvog pada zakazuje pokušaj za 1 minutu', () => {
    const plan = planRetry(0, NOW);
    expect(plan).toEqual({
      attempts: 1,
      status: 'PENDING',
      nextAttemptAt: new Date(NOW.getTime() + 60_000).toISOString(),
    });
  });

  it('koristi rastući backoff po pokušajima', () => {
    const third = planRetry(2, NOW);
    expect(third.attempts).toBe(3);
    expect(third.nextAttemptAt).toBe(new Date(NOW.getTime() + SYNC_BACKOFF_MS[2]).toISOString());
  });

  it('poslije maksimalnog broja pokušaja prelazi u FAILED', () => {
    const plan = planRetry(SYNC_MAX_ATTEMPTS - 1, NOW);
    expect(plan.attempts).toBe(SYNC_MAX_ATTEMPTS);
    expect(plan.status).toBe('FAILED');
    expect(plan.nextAttemptAt).toBeNull();
  });
});

describe('isRetryDue', () => {
  it('bez zakazanog vremena je odmah spreman', () => {
    expect(isRetryDue(null, NOW)).toBe(true);
  });

  it('buduće vrijeme nije spremno, prošlo jeste', () => {
    expect(isRetryDue(new Date(NOW.getTime() + 60_000).toISOString(), NOW)).toBe(false);
    expect(isRetryDue(new Date(NOW.getTime() - 1).toISOString(), NOW)).toBe(true);
  });

  it('neispravan datum tretira kao spreman', () => {
    expect(isRetryDue('nije-datum', NOW)).toBe(true);
  });
});

describe('isStale', () => {
  it('starije od 3 dana je stale, mlađe nije', () => {
    expect(isStale('2026-11-09T12:00:00.000Z', NOW)).toBe(true);
    expect(isStale('2026-11-12T12:00:00.000Z', NOW)).toBe(false);
  });
});

describe('summarizeQueue i poruka', () => {
  it('broji pending, due, failed i stale', () => {
    const summary = summarizeQueue(
      [
        { status: 'PENDING', createdAt: '2026-11-13T11:00:00.000Z', nextAttemptAt: null },
        {
          status: 'PENDING',
          createdAt: '2026-11-10T11:00:00.000Z',
          nextAttemptAt: '2026-11-13T13:00:00.000Z',
        },
        { status: 'FAILED', createdAt: '2026-11-13T10:00:00.000Z' },
      ],
      NOW,
    );

    expect(summary.pending).toBe(2);
    expect(summary.due).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.stale).toBe(1);
  });

  it('prioritet poruke: stale > failed > pending > ništa', () => {
    expect(queueAlarmMessage({ pending: 3, due: 3, failed: 2, stale: 1 })).toContain(
      'više od 3 dana',
    );
    expect(queueAlarmMessage({ pending: 1, due: 1, failed: 2, stale: 0 })).toContain(
      'nisu poslane',
    );
    expect(queueAlarmMessage({ pending: 1, due: 1, failed: 0, stale: 0 })).toContain(
      'čekaju slanje',
    );
    expect(queueAlarmMessage({ pending: 0, due: 0, failed: 0, stale: 0 })).toBeNull();
  });
});
