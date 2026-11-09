import { ApiError, apiRequest, setAccessToken } from './client';

type FetchMock = jest.Mock<Promise<{ ok: boolean; status: number; text: () => Promise<string> }>, unknown[]>;

function mockFetch(response: { ok: boolean; status: number; body?: unknown }): FetchMock {
  const fn = jest.fn(async () => ({
    ok: response.ok,
    status: response.status,
    text: async () => (response.body === undefined ? '' : JSON.stringify(response.body)),
  }));
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn as unknown as FetchMock;
}

describe('apiRequest', () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  it('vraća parsiran JSON i koristi GET po defaultu', async () => {
    const fetchMock = mockFetch({ ok: true, status: 200, body: { status: 'ok' } });

    const result = await apiRequest<{ status: string }>('/health');

    expect(result).toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(url).toContain('/health');
    expect(options.method).toBe('GET');
  });

  it('dodaje Authorization header kada je token postavljen', async () => {
    setAccessToken('token-123');
    const fetchMock = mockFetch({ ok: true, status: 200, body: {} });

    await apiRequest('/company');

    const [, options] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(options.headers.Authorization).toBe('Bearer token-123');
  });

  it('mapira API grešku u ApiError sa code/message', async () => {
    mockFetch({ ok: false, status: 401, body: { code: 'UNAUTHORIZED', message: 'Niste prijavljeni' } });

    await expect(apiRequest('/company')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Niste prijavljeni',
    });
    await expect(apiRequest('/company')).rejects.toBeInstanceOf(ApiError);
  });

  it('šalje body kao JSON za POST', async () => {
    const fetchMock = mockFetch({ ok: true, status: 200, body: {} });

    await apiRequest('/auth/login', { method: 'POST', body: { identifier: 'a' } });

    const [, options] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(options.body).toBe(JSON.stringify({ identifier: 'a' }));
  });
});
