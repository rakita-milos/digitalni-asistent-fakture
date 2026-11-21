import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const init = vi.fn();
const captureException = vi.fn();
const setTag = vi.fn();
const flush = vi.fn(async () => true);
const withScope = vi.fn((callback: (scope: { setTag: typeof setTag }) => void) => callback({ setTag }));

vi.mock('@sentry/node', () => ({
  init: (...args: unknown[]) => init(...args),
  captureException: (...args: unknown[]) => captureException(...args),
  withScope: (callback: (scope: { setTag: typeof setTag }) => void) => withScope(callback),
  flush: () => flush(),
}));

describe('web Sentry instrumentacija (T12-4)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_RUNTIME = 'nodejs';
  });

  afterEach(() => {
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_RUNTIME;
    delete process.env.APP_RELEASE;
  });

  it('bez DSN-a ne inicijalizuje Sentry', async () => {
    delete process.env.SENTRY_DSN;
    const { register } = await import('./instrumentation');

    await register();

    expect(init).not.toHaveBeenCalled();
  });

  it('sa DSN-om inicijalizuje Sentry sa okruženjem i release-om', async () => {
    process.env.SENTRY_DSN = 'https://key@example.invalid/1';
    process.env.APP_RELEASE = 'abc123';
    const { register } = await import('./instrumentation');

    await register();

    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://key@example.invalid/1',
        release: 'abc123',
      }),
    );
  });

  it('na serversku grešku šalje exception sa request tagovima', async () => {
    process.env.SENTRY_DSN = 'https://key@example.invalid/1';
    const { onRequestError } = await import('./instrumentation');

    await onRequestError(
      new Error('boom'),
      { path: '/settings', method: 'POST', headers: { 'x-request-id': 'req-1' } },
      { routerKind: 'App Router', routePath: '/settings', routeType: 'action' },
    );

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(setTag).toHaveBeenCalledWith('request_id', 'req-1');
    expect(setTag).toHaveBeenCalledWith('http_path', '/settings');
    expect(setTag).toHaveBeenCalledWith('route', '/settings');
  });

  it('bez DSN-a ne šalje ništa', async () => {
    delete process.env.SENTRY_DSN;
    const { onRequestError } = await import('./instrumentation');

    await onRequestError(
      new Error('boom'),
      { path: '/', method: 'GET', headers: {} },
      { routerKind: 'App Router', routePath: '/', routeType: 'render' },
    );

    expect(captureException).not.toHaveBeenCalled();
  });
});
