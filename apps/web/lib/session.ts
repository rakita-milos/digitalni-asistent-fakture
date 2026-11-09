import { cookies } from 'next/headers';

export const ACCESS_COOKIE = 'da_access';
export const REFRESH_COOKIE = 'da_refresh';

export async function getAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value ?? null;
}

export async function hasSession(): Promise<boolean> {
  return (await getAccessToken()) !== null;
}
