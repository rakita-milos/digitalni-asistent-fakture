'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { API_URL } from '@/lib/api';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/session';

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
    maxAge: 15 * 60,
    secure: process.env.NODE_ENV === 'production',
  });
  store.set(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
    secure: process.env.NODE_ENV === 'production',
  });

  redirect('/');
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  redirect('/login');
}
