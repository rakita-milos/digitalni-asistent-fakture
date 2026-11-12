import { cookies } from 'next/headers';

import { API_URL } from '@/lib/api';
import { ACCESS_COOKIE } from '@/lib/session';

/** Proxy za GDPR izvoz: API traži Bearer token, browser ima samo httpOnly cookie. */
export async function GET(): Promise<Response> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;

  if (!token) {
    return new Response('Neautorizovano', { status: 401 });
  }

  const response = await fetch(`${API_URL}/account/export`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    return new Response('Izvoz nije dostupan', { status: response.status });
  }

  const today = new Date().toISOString().slice(0, 10);

  return new Response(response.body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="digitalni-asistent-izvoz-${today}.json"`,
    },
  });
}
