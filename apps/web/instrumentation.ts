/**
 * Next.js instrumentacija (T12-4): server greške idu u Sentry kada je `SENTRY_DSN` postavljen.
 * Bez DSN-a je sve no-op — build i ponašanje su isti kao prije.
 *
 * Klijentska instrumentacija (browser) nije uključena: MVP prati serverske greške
 * (server actions, rute, renderovanje). Vidi `docs/STAGING_DEPLOY.md` i `PROGRESS.md`.
 */
const dsn = process.env.SENTRY_DSN?.trim();

interface RequestInfo {
  path: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
}

interface ErrorContext {
  routerKind: string;
  routePath: string;
  routeType: string;
}

export async function register(): Promise<void> {
  if (!dsn || process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  // webpackIgnore: @sentry/node je Node-only (node:https) i ne smije u edge/client bundle.
  const Sentry = await import(/* webpackIgnore: true */ '@sentry/node');
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.APP_RELEASE,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
  });
}

/** Next 15 hook: greške iz server komponenti/akcija sa request kontekstom. */
export async function onRequestError(
  error: unknown,
  request: RequestInfo,
  context: ErrorContext,
): Promise<void> {
  if (!dsn || process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const Sentry = await import(/* webpackIgnore: true */ '@sentry/node');
  Sentry.withScope((scope) => {
    scope.setTag('request_id', String(request.headers['x-request-id'] ?? ''));
    scope.setTag('http_path', request.path);
    scope.setTag('http_method', request.method);
    scope.setTag('route', context.routePath);
    Sentry.captureException(error);
  });
  await Sentry.flush(2000);
}
