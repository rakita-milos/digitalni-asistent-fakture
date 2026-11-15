import { useAuthStore, BIOMETRIC_CANCELLED_MESSAGE, BIOMETRIC_STALE_MESSAGE } from './authStore';
import { login, logout } from '../api/auth';
import { ApiError } from '../api/client';
import {
  clearBiometricCredentials,
  isBiometricLoginEnabled,
  isBiometricSupported,
  readBiometricCredentials,
  saveBiometricCredentials,
} from '../storage/biometricSession';
import { loadSession, saveSession, clearSession } from '../storage/secureStorage';

jest.mock('../api/auth', () => ({ login: jest.fn(), logout: jest.fn(), getCompany: jest.fn() }));
jest.mock('../storage/secureStorage', () => ({
  saveSession: jest.fn(),
  loadSession: jest.fn(),
  clearSession: jest.fn(),
}));
jest.mock('../storage/biometricSession', () => ({
  isBiometricSupported: jest.fn(),
  isBiometricLoginEnabled: jest.fn(),
  saveBiometricCredentials: jest.fn(),
  readBiometricCredentials: jest.fn(),
  clearBiometricCredentials: jest.fn(),
}));

const loginMock = login as jest.MockedFunction<typeof login>;
const logoutMock = logout as jest.MockedFunction<typeof logout>;
const loadSessionMock = loadSession as jest.MockedFunction<typeof loadSession>;
const saveSessionMock = saveSession as jest.MockedFunction<typeof saveSession>;
const clearSessionMock = clearSession as jest.MockedFunction<typeof clearSession>;

const isBiometricSupportedMock = isBiometricSupported as jest.MockedFunction<
  typeof isBiometricSupported
>;
const isBiometricLoginEnabledMock = isBiometricLoginEnabled as jest.MockedFunction<
  typeof isBiometricLoginEnabled
>;
const saveBiometricCredentialsMock = saveBiometricCredentials as jest.MockedFunction<
  typeof saveBiometricCredentials
>;
const readBiometricCredentialsMock = readBiometricCredentials as jest.MockedFunction<
  typeof readBiometricCredentials
>;
const clearBiometricCredentialsMock = clearBiometricCredentials as jest.MockedFunction<
  typeof clearBiometricCredentials
>;

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
    isBiometricSupportedMock.mockResolvedValue(false);
    isBiometricLoginEnabledMock.mockResolvedValue(false);
    clearBiometricCredentialsMock.mockResolvedValue(undefined);
    useAuthStore.setState({
      status: 'signedOut',
      user: null,
      company: null,
      error: null,
      isSubmitting: false,
      biometricAvailable: false,
      biometricEnrolled: false,
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
    loginMock.mockRejectedValue(
      new ApiError(401, 'UNAUTHORIZED', 'Neispravan email/telefon ili lozinka'),
    );

    const result = await useAuthStore.getState().signIn('vlasnik@example.ba', 'pogresna');

    expect(result).toBe(false);
    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(useAuthStore.getState().error).toBe('Neispravan email/telefon ili lozinka');
  });

  it('restore bez biometrije odmah vraća sesiju', async () => {
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

  it('restore sa upamćenom biometrijom zaključava aplikaciju dok se ne otključa', async () => {
    loadSessionMock.mockResolvedValue(session);
    isBiometricSupportedMock.mockResolvedValue(true);
    isBiometricLoginEnabledMock.mockResolvedValue(true);

    await useAuthStore.getState().restore();

    const state = useAuthStore.getState();
    expect(state.status).toBe('locked');
    expect(state.biometricEnrolled).toBe(true);
    expect(state.user).toBeNull();
  });

  it('uspješno biometrijsko otključavanje vraća sesiju', async () => {
    loadSessionMock.mockResolvedValue(session);
    isBiometricSupportedMock.mockResolvedValue(true);
    isBiometricLoginEnabledMock.mockResolvedValue(true);
    readBiometricCredentialsMock.mockResolvedValue({
      identifier: 'vlasnik@example.ba',
      password: 'lozinka123',
    });

    await useAuthStore.getState().restore();
    const unlocked = await useAuthStore.getState().unlockWithBiometrics();

    expect(unlocked).toBe(true);
    expect(useAuthStore.getState().status).toBe('signedIn');
    expect(useAuthStore.getState().user?.email).toBe('vlasnik@example.ba');
  });

  it('otkazano otključavanje ostavlja aplikaciju zaključanom', async () => {
    loadSessionMock.mockResolvedValue(session);
    isBiometricSupportedMock.mockResolvedValue(true);
    isBiometricLoginEnabledMock.mockResolvedValue(true);
    readBiometricCredentialsMock.mockResolvedValue(null);

    await useAuthStore.getState().restore();
    const unlocked = await useAuthStore.getState().unlockWithBiometrics();

    expect(unlocked).toBe(false);
    expect(useAuthStore.getState().status).toBe('locked');
    expect(useAuthStore.getState().error).toBe(BIOMETRIC_CANCELLED_MESSAGE);
  });

  it('„prijavi se lozinkom“ briše sesiju ali ne i upamćenu biometriju', async () => {
    loadSessionMock.mockResolvedValue(session);
    isBiometricSupportedMock.mockResolvedValue(true);
    isBiometricLoginEnabledMock.mockResolvedValue(true);

    await useAuthStore.getState().restore();
    await useAuthStore.getState().continueWithPassword();

    expect(clearSessionMock).toHaveBeenCalled();
    expect(clearBiometricCredentialsMock).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('signedOut');
  });

  it('biometrijska prijava koristi upamćene podatke i pamti novu sesiju', async () => {
    readBiometricCredentialsMock.mockResolvedValue({
      identifier: 'vlasnik@example.ba',
      password: 'lozinka123',
    });
    loginMock.mockResolvedValue(session);
    useAuthStore.setState({ biometricEnrolled: true, biometricAvailable: true });

    const result = await useAuthStore.getState().signInWithBiometrics();

    expect(result).toBe(true);
    expect(loginMock).toHaveBeenCalledWith('vlasnik@example.ba', 'lozinka123');
    expect(saveSessionMock).toHaveBeenCalledWith(session);
    expect(useAuthStore.getState().status).toBe('signedIn');
  });

  it('odustajanje od biometrijske prijave ne zove API', async () => {
    readBiometricCredentialsMock.mockResolvedValue(null);
    useAuthStore.setState({ biometricEnrolled: true, biometricAvailable: true });

    const result = await useAuthStore.getState().signInWithBiometrics();

    expect(result).toBe(false);
    expect(loginMock).not.toHaveBeenCalled();
    expect(useAuthStore.getState().error).toBe(BIOMETRIC_CANCELLED_MESSAGE);
  });

  it('nevažeća upamćena lozinka se briše i traži prijava lozinkom', async () => {
    readBiometricCredentialsMock.mockResolvedValue({
      identifier: 'vlasnik@example.ba',
      password: 'stara',
    });
    loginMock.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Neispravna lozinka'));
    useAuthStore.setState({ biometricEnrolled: true, biometricAvailable: true });

    const result = await useAuthStore.getState().signInWithBiometrics();

    expect(result).toBe(false);
    expect(clearBiometricCredentialsMock).toHaveBeenCalled();
    expect(useAuthStore.getState().biometricEnrolled).toBe(false);
    expect(useAuthStore.getState().error).toBe(BIOMETRIC_STALE_MESSAGE);
  });

  it('uključivanje i isključivanje biometrijske prijave', async () => {
    saveBiometricCredentialsMock.mockResolvedValue(true);

    await expect(
      useAuthStore.getState().enableBiometricLogin('vlasnik@example.ba', 'lozinka123'),
    ).resolves.toBe(true);
    expect(useAuthStore.getState().biometricEnrolled).toBe(true);

    await useAuthStore.getState().disableBiometricLogin();

    expect(clearBiometricCredentialsMock).toHaveBeenCalled();
    expect(useAuthStore.getState().biometricEnrolled).toBe(false);
  });

  it('neuspješno uključivanje biometrije daje jasnu poruku', async () => {
    saveBiometricCredentialsMock.mockResolvedValue(false);

    await expect(
      useAuthStore.getState().enableBiometricLogin('vlasnik@example.ba', 'lozinka123'),
    ).resolves.toBe(false);
    expect(useAuthStore.getState().biometricEnrolled).toBe(false);
    expect(useAuthStore.getState().error).toBe(
      'Biometrijska prijava nije uključena na ovom uređaju.',
    );
  });

  it('applyUser čuva izmijenjeni profil u sesiji', async () => {
    loadSessionMock.mockResolvedValue(session);
    useAuthStore.setState({ status: 'signedIn', user: session.user, company: session.company });

    await useAuthStore.getState().applyUser({ ...session.user, phone: '+38766123999' });

    expect(saveSessionMock).toHaveBeenCalledWith({
      ...session,
      user: { ...session.user, phone: '+38766123999' },
    });
    expect(useAuthStore.getState().user?.phone).toBe('+38766123999');
  });

  it('odjava opoziva server sesiju i briše lokalnu i biometrijsku prijavu', async () => {
    useAuthStore.setState({
      status: 'signedIn',
      user: session.user,
      company: session.company,
      biometricEnrolled: true,
    });
    logoutMock.mockResolvedValue({ loggedOut: true });

    await useAuthStore.getState().signOut();

    expect(logoutMock).toHaveBeenCalled();
    expect(clearSessionMock).toHaveBeenCalled();
    expect(clearBiometricCredentialsMock).toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().biometricEnrolled).toBe(false);
  });

  it('odjava radi i kada server nije dostupan', async () => {
    useAuthStore.setState({ status: 'signedIn', user: session.user, company: session.company });
    logoutMock.mockRejectedValue(new Error('mreža'));

    await useAuthStore.getState().signOut();

    expect(clearSessionMock).toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('signedOut');
  });
});
