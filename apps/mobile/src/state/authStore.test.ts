import { useAuthStore } from './authStore';
import { login, logout } from '../api/auth';
import { ApiError } from '../api/client';
import { loadSession, saveSession, clearSession } from '../storage/secureStorage';

jest.mock('../api/auth', () => ({ login: jest.fn(), logout: jest.fn(), getCompany: jest.fn() }));
jest.mock('../storage/secureStorage', () => ({
  saveSession: jest.fn(),
  loadSession: jest.fn(),
  clearSession: jest.fn(),
}));

const loginMock = login as jest.MockedFunction<typeof login>;
const logoutMock = logout as jest.MockedFunction<typeof logout>;
const loadSessionMock = loadSession as jest.MockedFunction<typeof loadSession>;
const saveSessionMock = saveSession as jest.MockedFunction<typeof saveSession>;
const clearSessionMock = clearSession as jest.MockedFunction<typeof clearSession>;

const session = {
  accessToken: 'access',
  refreshToken: 'refresh',
  user: {
    id: 'u1',
    companyId: 'c1',
    email: 'vlasnik@example.ba',
    phone: '+38766123001',
    role: 'owner',
  },
  company: { id: 'c1', name: 'Majstor d.o.o.' },
};

describe('authStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      status: 'signedOut',
      user: null,
      company: null,
      error: null,
      isSubmitting: false,
    });
  });

  it('prijavljuje korisnika i čuva sesiju u secure storage', async () => {
    loginMock.mockResolvedValue(session);

    const result = await useAuthStore.getState().signIn('vlasnik@example.ba', 'lozinka123');

    expect(result).toBe(true);
    expect(saveSessionMock).toHaveBeenCalledWith(session);
    expect(useAuthStore.getState().status).toBe('signedIn');
    expect(useAuthStore.getState().company?.name).toBe('Majstor d.o.o.');
  });

  it('prikazuje poruku API greške i ostaje odjavljen', async () => {
    loginMock.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Neispravan email/telefon ili lozinka'));

    const result = await useAuthStore.getState().signIn('vlasnik@example.ba', 'pogresna');

    expect(result).toBe(false);
    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(useAuthStore.getState().error).toBe('Neispravan email/telefon ili lozinka');
  });

  it('restore iz secure storage postavlja sesiju', async () => {
    loadSessionMock.mockResolvedValue(session);

    await useAuthStore.getState().restore();

    expect(useAuthStore.getState().status).toBe('signedIn');
    expect(useAuthStore.getState().user?.email).toBe('vlasnik@example.ba');
  });

  it('restore bez sesije vodi na prijavu', async () => {
    loadSessionMock.mockResolvedValue(null);

    await useAuthStore.getState().restore();

    expect(useAuthStore.getState().status).toBe('signedOut');
  });

  it('odjava opoziva server sesiju i briše lokalnu', async () => {
    useAuthStore.setState({ status: 'signedIn', user: session.user, company: session.company });
    logoutMock.mockResolvedValue({ loggedOut: true });

    await useAuthStore.getState().signOut();

    expect(logoutMock).toHaveBeenCalled();
    expect(clearSessionMock).toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('odjava radi i kada server nije dostupan', async () => {
    useAuthStore.setState({ status: 'signedIn', user: session.user, company: session.company });
    logoutMock.mockRejectedValue(new Error('mreža'));

    await useAuthStore.getState().signOut();

    expect(clearSessionMock).toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('signedOut');
  });
});
