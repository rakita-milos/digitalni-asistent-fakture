import * as Keychain from 'react-native-keychain';

import {
  clearBiometricCredentials,
  isBiometricLoginEnabled,
  isBiometricSupported,
  readBiometricCredentials,
  saveBiometricCredentials,
} from './biometricSession';

jest.mock('react-native-keychain', () => ({
  getSupportedBiometryType: jest.fn(),
  hasGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
  getGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
  ACCESS_CONTROL: { BIOMETRY_ANY: 'BiometryAny' },
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly' },
  BIOMETRY_TYPE: { FINGERPRINT: 'Fingerprint', FACE: 'Face' },
  STORAGE_TYPE: { AES_GCM: 'KeystoreAESGCM' },
}));

const getSupportedBiometryTypeMock = Keychain.getSupportedBiometryType as jest.MockedFunction<
  typeof Keychain.getSupportedBiometryType
>;
const hasGenericPasswordMock = Keychain.hasGenericPassword as jest.MockedFunction<
  typeof Keychain.hasGenericPassword
>;
const setGenericPasswordMock = Keychain.setGenericPassword as jest.MockedFunction<
  typeof Keychain.setGenericPassword
>;
const getGenericPasswordMock = Keychain.getGenericPassword as jest.MockedFunction<
  typeof Keychain.getGenericPassword
>;
const resetGenericPasswordMock = Keychain.resetGenericPassword as jest.MockedFunction<
  typeof Keychain.resetGenericPassword
>;

describe('biometricSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prepoznaje uređaj bez biometrije', async () => {
    getSupportedBiometryTypeMock.mockResolvedValue(null);

    await expect(isBiometricSupported()).resolves.toBe(false);
  });

  it('prepoznaje uređaj sa biometrijom', async () => {
    getSupportedBiometryTypeMock.mockResolvedValue(Keychain.BIOMETRY_TYPE.FINGERPRINT);

    await expect(isBiometricSupported()).resolves.toBe(true);
  });

  it('greška biometrije se tretira kao „nije dostupno“', async () => {
    getSupportedBiometryTypeMock.mockRejectedValue(new Error('nema hardvera'));

    await expect(isBiometricSupported()).resolves.toBe(false);
  });

  it('čuva prijavu uz biometrijsku zaštitu u zasebnom servisu', async () => {
    setGenericPasswordMock.mockResolvedValue({ service: 'digitalni-asistent.biometric' } as never);

    await expect(saveBiometricCredentials('vlasnik@example.ba', 'lozinka123')).resolves.toBe(true);

    expect(setGenericPasswordMock).toHaveBeenCalledWith(
      'vlasnik@example.ba',
      'lozinka123',
      expect.objectContaining({
        service: 'digitalni-asistent.biometric',
        accessControl: 'BiometryAny',
        accessible: 'AccessibleWhenUnlockedThisDeviceOnly',
      }),
    );
  });

  it('ne prijavljuje uspjeh kada Keychain odbije zapis', async () => {
    setGenericPasswordMock.mockResolvedValue(false);

    await expect(saveBiometricCredentials('vlasnik@example.ba', 'lozinka123')).resolves.toBe(false);
  });

  it('čita upamćenu prijavu (uz prompt koji daje Keychain)', async () => {
    getGenericPasswordMock.mockResolvedValue({
      username: 'vlasnik@example.ba',
      password: 'lozinka123',
      service: 'digitalni-asistent.biometric',
      storage: Keychain.STORAGE_TYPE.AES_GCM,
    });

    await expect(readBiometricCredentials()).resolves.toEqual({
      identifier: 'vlasnik@example.ba',
      password: 'lozinka123',
    });
    expect(getGenericPasswordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'digitalni-asistent.biometric',
        authenticationPrompt: expect.objectContaining({ title: 'Prijava biometrijom' }),
      }),
    );
  });

  it('vraća null kada nema zapisa ili je prompt otkazan', async () => {
    getGenericPasswordMock.mockResolvedValue(false);
    await expect(readBiometricCredentials()).resolves.toBeNull();

    getGenericPasswordMock.mockRejectedValue(new Error('korisnik odustao'));
    await expect(readBiometricCredentials()).resolves.toBeNull();
  });

  it('provjerava postoji li upamćena prijava', async () => {
    hasGenericPasswordMock.mockResolvedValue(true);
    await expect(isBiometricLoginEnabled()).resolves.toBe(true);

    hasGenericPasswordMock.mockRejectedValue(new Error('keychain'));
    await expect(isBiometricLoginEnabled()).resolves.toBe(false);
  });

  it('briše upamćenu prijavu i ne pada ako zapisa nema', async () => {
    resetGenericPasswordMock.mockResolvedValue(true);
    await clearBiometricCredentials();
    expect(resetGenericPasswordMock).toHaveBeenCalledWith({
      service: 'digitalni-asistent.biometric',
    });

    resetGenericPasswordMock.mockRejectedValue(new Error('nema zapisa'));
    await expect(clearBiometricCredentials()).resolves.toBeUndefined();
  });
});
