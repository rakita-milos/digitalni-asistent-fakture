import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE,
} from './lib/session-constants';

/**
 * Silent refresh: access token traje 15 min, refresh 30 dana.
 * Kad access istekne, middleware ga zamijeni novim (rotacija refresh tokena)
 * prije nego server komponenta uopšte pozove API — korisnik ne ispada na `/login`.
 *
 * Napomena: refresh rotacija poništava stari refresh token; ako dva zahtjeva
 * istovremeno pokušaju refresh, jedan može ostati bez sesije (poznato ograničenje).
 */

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** JWT `exp` provjera bez verifikacije potpisa (potpis provjerava API). */
function isExpired(token: string): boolean {
  try {
    const payloadPart = token.split('.')[1];

    if (!payloadPart) {
      return true;
    }

    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded)) as { exp?: number };

    if (typeof payload.exp !== 'number') {
      return true;
    }

    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

function cookieAttributes(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
    secure: process.env.NODE_ENV === 'production',
  };
}

export async function middleware(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;

  if (!accessToken || !isExpired(accessToken)) {
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.next();
  }

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.next();
    }

    const session = (await response.json()) as { accessToken: string; refreshToken: string };

    // Server komponente čitaju request cookie-je, pa ih moramo zamijeniti prije rendera.
    const headers = new Headers(request.headers);
    const cookieHeader = headers.get('cookie') ?? '';
    const updatedCookie = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(
        (part) =>
          part.length > 0 &&
          !part.startsWith(`${ACCESS_COOKIE}=`) &&
          !part.startsWith(`${REFRESH_COOKIE}=`),
      )
      .concat([
        `${ACCESS_COOKIE}=${session.accessToken}`,
        `${REFRESH_COOKIE}=${session.refreshToken}`,
      ])
      .join('; ');
    headers.set('cookie', updatedCookie);

    const next = NextResponse.next({ request: { headers } });
    next.cookies.set(ACCESS_COOKIE, session.accessToken, cookieAttributes(ACCESS_COOKIE_MAX_AGE));
    next.cookies.set(
      REFRESH_COOKIE,
      session.refreshToken,
      cookieAttributes(REFRESH_COOKIE_MAX_AGE),
    );

    return next;
  } catch {
    // Ako API nije dostupan, ponašamo se kao da refresh nije moguć — stranica odlučuje dalje.
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login).*)'],
};
