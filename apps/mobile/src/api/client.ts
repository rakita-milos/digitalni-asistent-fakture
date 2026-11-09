import { API_URL } from '../config';

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

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = options.token === undefined ? accessToken : options.token;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

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
