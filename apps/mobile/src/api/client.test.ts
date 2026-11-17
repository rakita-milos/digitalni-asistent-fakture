import { ApiError, apiRequest, getAccessToken, setAccessToken } from './client';
import { loadSession, saveSession } from '../storage/secureStorage';

type FetchResponse = { ok: boolean; status: number; text: () => Promise<string> };

jest.mock('../storage/secureStorage', () => ({
  loadSession: jest.fn(),
  saveSession: jest.fn(),
}));

const loadSessionMock = loadSession as jest.MockedFunction<typeof loadSession>;
const saveSessionMock = saveSession as jest.MockedFunction<typeof saveSession>;

function toResponse(response: { ok: boolean; status: number; body?: unknown }): FetchResponse {
  return {
    ok: response.ok,
    status: response.status,
    text: async () => (response.body === undefined ? '' : JSON.stringify(response.body)),
  };
}

function mockFetch(...responses: Array<{ ok: boolean; status: number; body?: unknown }>): jest.Mock {
  const queue = [...responses];
  const fn = jest.fn(async () =>
    toResponse(queue.length > 1 ? (queue.shift() as { ok: boolean; status: number; body?: unknown }) : (queue[0] as { ok: boolean; status: number; body?: unknown })),
  );
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

const session = {
  accessToken: 'access-old',
  refreshToken: 'refresh-1',
  user: {
    id: 'u1',
    companyId: 'c1',
    email: 'demo@digitalni-asistent.ba',
    phone: '+38766123000',
    role: 'owner',
  },
  company: { id: 'c1', name: 'Demo Firma d.o.o.' },
};

describe('apiRequest', () => {
  beforeEach(() => {
    setAccessToken(null);
    jest.clearAllMocks();
    loadSessionMock.mockResolvedValue(null);
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

  it('na 401 osvježi token iz Keychain-a i ponovi zahtjev', async () => {
    setAccessToken('access-old');
    loadSessionMock.mockResolvedValue(session);
    const fetchMock = mockFetch(
      { ok: false, status: 401, body: { code: 'UNAUTHORIZED', message: 'Istekao token' } },
      { ok: true, status: 200, body: { ...session, accessToken: 'access-new' } },
      { ok: true, status: 200, body: { id: 'c1', name: 'Demo Firma d.o.o.' } },
    );

    const result = await apiRequest<{ id: string }>('/company');

    expect(result).toEqual({ id: 'c1', name: 'Demo Firma d.o.o.' });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const refreshCall = fetchMock.mock.calls[1] as [string, { body: string }];
    expect(refreshCall[0]).toContain('/auth/refresh');
    expect(refreshCall[1].body).toBe(JSON.stringify({ refreshToken: 'refresh-1' }));

    const retryCall = fetchMock.mock.calls[2] as [string, { headers: Record<string, string> }];
    expect(retryCall[1].headers.Authorization).toBe('Bearer access-new');

    expect(saveSessionMock).toHaveBeenCalledWith({ ...session, accessToken: 'access-new' });
    expect(getAccessToken()).toBe('access-new');
  });

  it('ne osvježava token na 401 sa ruta za prijavu', async () => {
    const fetchMock = mockFetch({
      ok: false,
      status: 401,
      body: { code: 'UNAUTHORIZED', message: 'Neispravna lozinka' },
    });

    await expect(
      apiRequest('/auth/login', { method: 'POST', body: { identifier: 'a', password: 'b' } }),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(loadSessionMock).not.toHaveBeenCalled();
  });

  it('kada refresh ne uspije, vraća originalnu 401 grešku', async () => {
    setAccessToken('access-old');
    loadSessionMock.mockResolvedValue(session);
    const fetchMock = mockFetch(
      { ok: false, status: 401, body: { code: 'UNAUTHORIZED', message: 'Istekao token' } },
      { ok: false, status: 401, body: { code: 'UNAUTHORIZED', message: 'Sesija je opozvana' } },
      { ok: false, status: 401, body: { code: 'UNAUTHORIZED', message: 'Istekao token' } },
    );

    await expect(apiRequest('/company')).rejects.toMatchObject({
      status: 401,
      message: 'Istekao token',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(saveSessionMock).not.toHaveBeenCalled();
  });

  it('paralelni zahtjevi dijele jedan refresh poziv', async () => {
    setAccessToken('access-old');
    loadSessionMock.mockResolvedValue(session);

    const calls: string[] = [];
    const fetchMock = jest.fn(async (url: string) => {
      calls.push(url);
      if (url.includes('/auth/refresh')) {
        return toResponse({ ok: true, status: 200, body: { ...session, accessToken: 'access-new' } });
      }
      const firstAttempt = calls.filter((entry) => entry === url).length === 1;
      return firstAttempt
        ? toResponse({ ok: false, status: 401, body: { code: 'UNAUTHORIZED', message: 'Istekao token' } })
        : toResponse({ ok: true, status: 200, body: { ok: true } });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const [first, second] = await Promise.all([apiRequest('/company'), apiRequest('/customers')]);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(calls.filter((url) => url.includes('/auth/refresh'))).toHaveLength(1);
    expect(saveSessionMock).toHaveBeenCalledTimes(1);
  });
});
