import { cookies } from 'next/headers';

import { ACCESS_COOKIE } from './session-constants';

export { ACCESS_COOKIE, REFRESH_COOKIE } from './session-constants';

export async function getAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value ?? null;
}

export async function hasSession(): Promise<boolean> {
  return (await getAccessToken()) !== null;
}
