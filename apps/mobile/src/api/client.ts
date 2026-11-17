import type { AuthSession } from '@digitalni-asistent/shared';

import { API_URL } from '../config';
import { loadSession, saveSession } from '../storage/secureStorage';

/** Greška API-ja u §6 formatu: `{ code, message, details? }`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Trenutni access token — potreban za `Image` koji ide direktno na API (npr. QR PNG). */
export function getAccessToken(): string | null {
  return accessToken;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

/** Rute na kojima 401 znači pogrešne podatke, ne istekao token — refresh nema smisla. */
const NO_REFRESH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
];

/**
 * Access token traje 15 min (§10). Bez ovoga bi svaki ekran poslije 15 min padao sa
 * „Neispravan ili istekao access token“ (nađeno na emulatoru, T12-3).
 * Refresh je „single-flight“: paralelni zahtjevi dijele isti poziv.
 */
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  const pending = (async (): Promise<string | null> => {
    try {
      const session = await loadSession();
      if (!session?.refreshToken) {
        return null;
      }

      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });

      if (!response.ok) {
        return null;
      }

      const updated = JSON.parse(await response.text()) as AuthSession;
      await saveSession(updated);
      accessToken = updated.accessToken;
      return updated.accessToken;
    } catch {
      return null;
    }
  })();

  refreshPromise = pending;
  try {
    return await pending;
  } finally {
    refreshPromise = null;
  }
}

function send(path: string, options: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = options.token === undefined ? accessToken : options.token;

  let response = await send(path, options, token);

  if (response.status === 401 && !NO_REFRESH_PATHS.some((prefix) => path.startsWith(prefix))) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await send(path, options, refreshed);
    }
  }

  const text = await response.text();
  const data: unknown = text.length > 0 ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const payload = (data ?? {}) as { code?: string; message?: string; details?: unknown[] };
    throw new ApiError(
      response.status,
      payload.code ?? 'HTTP_ERROR',
      payload.message ?? 'Greška u komunikaciji sa serverom',
      payload.details,
    );
  }

  return data as T;
}
