'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { API_URL } from '@/lib/api';
import { ACCESS_COOKIE, REFRESH_COOKIE, getAccessToken } from '@/lib/session';
import { ACCESS_COOKIE_MAX_AGE, REFRESH_COOKIE_MAX_AGE } from '@/lib/session-constants';

export interface LoginState {
  error?: string;
}

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const identifier = String(formData.get('identifier') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!identifier || !password) {
    return { error: 'Unesite email/telefon i lozinku' };
  }

  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier, password, device: { platform: 'web' } }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    return { error: body.message ?? 'Prijava nije uspjela' };
  }

  const session = (await response.json()) as { accessToken: string; refreshToken: string };
  const store = await cookies();

  store.set(ACCESS_COOKIE, session.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  });
  store.set(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  });

  redirect('/');
}

export async function logoutAction(): Promise<void> {
  const token = await getAccessToken();

  // Opoziv refresh tokena uređaja (§10); ne blokira odjavu ako API nije dostupan.
  if (token) {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
    } catch {
      // lokalna odjava ide dalje
    }
  }

  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  redirect('/login');
}

export interface ForgotPasswordState {
  error?: string;
  success?: boolean;
}

export async function forgotPasswordAction(
  _previous: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get('email') ?? '').trim();

  if (!email) {
    return { error: 'Unesite e-mail adresu' };
  }

  const response = await fetch(`${API_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
    cache: 'no-store',
  });

  if (response.status === 429) {
    return { error: 'Previše zahtjeva — pokušajte ponovo za nekoliko minuta' };
  }

  if (!response.ok) {
    return { error: 'Slanje linka nije uspjelo — pokušajte ponovo' };
  }

  return { success: true };
}

export interface ResetPasswordState {
  error?: string;
}

export async function resetPasswordAction(
  _previous: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = String(formData.get('token') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (!token) {
    return { error: 'Nedostaje token iz e-maila' };
  }

  if (password.length < 8) {
    return { error: 'Lozinka mora imati najmanje 8 znakova' };
  }

  if (password !== confirm) {
    return { error: 'Lozinke se ne poklapaju' };
  }

  const response = await fetch(`${API_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, password }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    return { error: body.message ?? 'Link je istekao ili nije valjan' };
  }

  redirect('/login?reset=1');
}
