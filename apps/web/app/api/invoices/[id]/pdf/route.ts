import { cookies } from 'next/headers';

import { API_URL } from '@/lib/api';
import { ACCESS_COOKIE } from '@/lib/session';

/** Proxy za PDF: API traži Bearer token, a browser ima samo httpOnly cookie. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;

  if (!token) {
    return new Response('Neautorizovano', { status: 401 });
  }

  const response = await fetch(`${API_URL}/invoices/${id}/pdf`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    return new Response('PDF nije dostupan', { status: response.status });
  }

  return new Response(response.body, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition':
        response.headers.get('content-disposition') ?? `inline; filename="faktura-${id}.pdf"`,
    },
  });
}
